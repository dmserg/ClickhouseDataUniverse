import {
  AbstractMesh,
  Animation,
  ArcRotateCamera,
  Color3,
  Color4,
  Curve3,
  DynamicTexture,
  Engine,
  GlowLayer,
  HemisphericLight,
  Matrix,
  Mesh,
  MeshBuilder,
  PointerEventTypes,
  Quaternion,
  Scene,
  SceneInstrumentation,
  StandardMaterial,
  Vector3
} from "@babylonjs/core";
import type { AppMode, QualityPreset } from "../app/store";
import type { DomainGraph, EdgeType } from "../domain/types";
import type { LayoutResult, Vector3Tuple } from "../layout/types";
import { engineColor } from "./renderModel";
import {
  buildPolylineMetrics,
  calculateRouteArrowPlacement,
  cargoShipBudget,
  samplePolyline,
  type PolylineMetrics
} from "./routeGeometry";
import type { SceneBridge } from "./sceneBridge";
import {
  estimateLabelWidth,
  labelBudget,
  MAX_SCENE_LABELS,
  selectNonOverlappingLabels,
  truncateLabel,
  type SceneLabelKind,
  type ScreenLabelCandidate
} from "./labelLayout";

export interface SceneProjection {
  mode: AppMode;
  activeSchemaId: string | null;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  visibleNodeIds: ReadonlySet<string>;
  lineageEdgeIds: ReadonlySet<string>;
  pathEdgeIds: ReadonlySet<string>;
  edgeTypes: readonly EdgeType[];
  quality: QualityPreset;
  cargoShipsEnabled: boolean;
}

interface SceneCallbacks {
  onSelectNode(id: string): void;
  onHoverNode(id: string | null): void;
  onEnterGalaxy(id: string): void;
  onStats(stats: SceneStats): void;
}

export interface SceneStats {
  fps: number;
  frameMs: number;
  drawCalls: number;
  activeMeshes: number;
  visibleNodes: number;
  visibleLabels: number;
  visibleDetailedEdges: number;
  visibleAggregateEdges: number;
  animatedCargoShips: number;
}

interface RuntimeLabelCandidate extends ScreenLabelCandidate {
  position: Vector3;
  worldWidth: number;
  worldHeight: number;
}

interface LabelSlot {
  mesh: Mesh;
  texture: DynamicTexture;
  contentKey: string;
  labelId: string | null;
}

interface CargoShipAnimation {
  mesh: AbstractMesh;
  metrics: PolylineMetrics;
  progress: number;
  speed: number;
  startProgress: number;
  progressSpan: number;
}

const KIND_COLORS: Record<string, Color3> = {
  view: Color3.FromHexString("#70d7ff"),
  materialized_view: Color3.FromHexString("#ff8cf0"),
  distributed_table: Color3.FromHexString("#45f3ff"),
  external_table: Color3.FromHexString("#57f2a7"),
  special_table: Color3.FromHexString("#ff6f85")
};

const EDGE_COLORS: Record<string, string> = {
  etl_transfer: "#ffb84a",
  view_dependency: "#5bd7ff",
  materialized_view_input: "#f17cff",
  materialized_view_target: "#ff6e97",
  distributed_reference: "#42f1c1",
  manual_dependency: "#a7b2cf",
  unknown: "#727d99"
};

function vector(value: Vector3Tuple) {
  return new Vector3(value[0], value[1], value[2]);
}

function deterministicPhase(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

export class SceneController implements SceneBridge {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: ArcRotateCamera;
  private readonly graph: DomainGraph;
  private readonly layout: LayoutResult;
  private readonly callbacks: SceneCallbacks;
  private readonly nodeMeshes = new Map<string, AbstractMesh>();
  private readonly galaxyMeshes = new Map<string, AbstractMesh>();
  private readonly aggregateRoutes: Mesh[] = [];
  private readonly detailedRoutes: Mesh[] = [];
  private readonly detailedRouteArrows: AbstractMesh[] = [];
  private readonly routeArrowSources = new Map<string, Mesh>();
  private readonly cargoShips: CargoShipAnimation[] = [];
  private readonly cargoShipSources = new Map<string, Mesh>();
  private readonly labelSlots: LabelSlot[] = [];
  private readonly nodeIdsByImportance: string[];
  private readonly glowLayer: GlowLayer;
  private selectionMarker: Mesh | null = null;
  private readonly instrumentation: SceneInstrumentation;
  private projection: SceneProjection;
  private statsTick = 0;

  constructor(
    canvas: HTMLCanvasElement,
    graph: DomainGraph,
    layout: LayoutResult,
    projection: SceneProjection,
    callbacks: SceneCallbacks
  ) {
    this.graph = graph;
    this.layout = layout;
    this.projection = projection;
    this.callbacks = callbacks;
    this.nodeIdsByImportance = Object.values(layout.nodes)
      .sort((a, b) => b.importance - a.importance || a.nodeId.localeCompare(b.nodeId))
      .map((item) => item.nodeId);
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true });
    this.scene = new Scene(this.engine);
    this.instrumentation = new SceneInstrumentation(this.scene);
    this.scene.clearColor = new Color4(0.008, 0.012, 0.035, 1);
    this.scene.ambientColor = new Color3(0.13, 0.16, 0.3);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.0016;
    this.scene.fogColor = new Color3(0.008, 0.012, 0.035);
    this.camera = new ArcRotateCamera(
      "universe-camera",
      -Math.PI / 2,
      1.06,
      145,
      Vector3.Zero(),
      this.scene
    );
    this.camera.lowerRadiusLimit = 3;
    this.camera.upperRadiusLimit = 420;
    this.camera.wheelPrecision = 7;
    this.camera.panningSensibility = 90;
    this.camera.attachControl(canvas, true);
    new HemisphericLight("shared-fill", new Vector3(0, 1, 0), this.scene).intensity = 0.32;
    this.glowLayer = new GlowLayer("shared-glow", this.scene, {
      mainTextureFixedSize: projection.quality === "Low" ? 256 : 512,
      blurKernelSize: projection.quality === "High" ? 64 : 32
    });
    this.glowLayer.intensity = 0.7;
    this.buildGalaxies();
    this.buildNodes();
    this.buildLabelPool();
    this.buildAggregateRoutes();
    this.installPicking();
    this.applyProjection(projection);
    this.rebuildDetailedRoutes();
    this.engine.runRenderLoop(() => {
      if (this.statsTick % 6 === 0) this.updateLabels();
      this.updateCargoShips(this.engine.getDeltaTime());
      this.scene.render();
      this.statsTick += 1;
      if (this.statsTick % 24 === 0) this.reportStats();
    });
    window.addEventListener("resize", this.resize);
  }

  private buildLabelPool() {
    for (let index = 0; index < MAX_SCENE_LABELS; index += 1) {
      const texture = new DynamicTexture(
        `scene-label-texture:${index}`,
        { width: 1024, height: 128 },
        this.scene,
        false
      );
      texture.hasAlpha = true;
      const material = new StandardMaterial(`scene-label-material:${index}`, this.scene);
      material.diffuseTexture = texture;
      material.opacityTexture = texture;
      material.emissiveColor = Color3.White();
      material.diffuseColor = Color3.White();
      material.specularColor = Color3.Black();
      material.useAlphaFromDiffuseTexture = true;
      material.disableLighting = true;
      material.disableDepthWrite = true;
      material.backFaceCulling = false;
      material.fogEnabled = false;
      const mesh = MeshBuilder.CreatePlane(`scene-label:${index}`, { size: 1 }, this.scene);
      mesh.material = material;
      mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
      mesh.isPickable = false;
      mesh.renderingGroupId = 2;
      this.glowLayer.addExcludedMesh(mesh);
      mesh.setEnabled(false);
      this.labelSlots.push({ mesh, texture, contentKey: "", labelId: null });
    }
  }

  private drawLabel(slot: LabelSlot, text: string, kind: SceneLabelKind) {
    const contentKey = `${kind}:${text}`;
    if (slot.contentKey === contentKey) return;
    const context = slot.texture.getContext();
    const screenHeight = kind === "galaxy" ? 34 : 28;
    const contentWidth = Math.min(
      1024,
      Math.ceil((estimateLabelWidth(text, kind) / screenHeight) * 128)
    );
    slot.texture.uScale = contentWidth / 1024;
    slot.texture.uOffset = 0;
    context.clearRect(0, 0, 1024, 128);
    context.font =
      kind === "galaxy"
        ? '600 55px "Segoe UI", Arial, sans-serif'
        : '600 59px "Segoe UI", Arial, sans-serif';
    context.lineJoin = "round";
    context.lineWidth = 7;
    context.strokeStyle = "rgba(2, 7, 18, 0.94)";
    context.fillStyle = kind === "galaxy" ? "#b8d8ea" : "#e0edf7";
    const availableWidth = contentWidth - 54;
    const measuredWidth = Math.min(availableWidth, context.measureText(text).width);
    const textX = contentWidth / 2 - measuredWidth / 2;
    context.strokeText(text, textX, 86, availableWidth);
    context.fillText(text, textX, 86, availableWidth);
    // DynamicTexture defaults to canvas-style Y orientation. Disabling it uploads text upside down.
    slot.texture.update();
    slot.contentKey = contentKey;
  }

  private relevantNodeIds(edgeIds: ReadonlySet<string>): Set<string> {
    const ids = new Set<string>();
    for (const edgeId of edgeIds) {
      const edge = this.graph.edgesById.get(edgeId);
      if (!edge) continue;
      ids.add(edge.sourceNodeId);
      ids.add(edge.targetNodeId);
    }
    return ids;
  }

  private nodeLabelIds(): string[] {
    const required = new Set<string>();
    if (this.projection.selectedNodeId) required.add(this.projection.selectedNodeId);
    if (this.projection.hoveredNodeId) required.add(this.projection.hoveredNodeId);
    const relevant =
      this.projection.mode === "Journey"
        ? this.relevantNodeIds(this.projection.pathEdgeIds)
        : this.relevantNodeIds(this.projection.lineageEdgeIds);
    for (const id of relevant) required.add(id);

    if (this.projection.mode === "Journey") return [...required];
    const contextual =
      this.projection.mode === "Universe"
        ? this.nodeIdsByImportance.slice(0, 220)
        : this.nodeIdsByImportance.filter(
            (id) => this.graph.nodesById.get(id)?.schemaId === this.projection.activeSchemaId
          );
    return [...required, ...contextual.filter((id) => !required.has(id))];
  }

  private createProjectedLabel(
    id: string,
    kind: SceneLabelKind,
    text: string,
    anchor: Vector3,
    objectRadius: number,
    priority: number,
    pinned: boolean,
    viewportWidth: number,
    viewportHeight: number
  ): RuntimeLabelCandidate | null {
    const distance = Vector3.Distance(this.camera.globalPosition, anchor);
    if (!Number.isFinite(distance) || distance <= 0) return null;
    const worldPerPixel = (2 * distance * Math.tan(this.camera.fov / 2)) / viewportHeight;
    const height = kind === "galaxy" ? 34 : 28;
    const displayText = truncateLabel(text, kind === "galaxy" ? 34 : 30);
    const width = estimateLabelWidth(displayText, kind);
    const position = anchor.add(
      this.camera.upVector.normalize().scale(objectRadius + worldPerPixel * (height / 2 + 7))
    );
    const projected = Vector3.Project(
      position,
      Matrix.Identity(),
      this.scene.getTransformMatrix(),
      this.camera.viewport.toGlobal(viewportWidth, viewportHeight)
    );
    return {
      id,
      kind,
      text: displayText,
      x: projected.x,
      y: projected.y,
      width,
      height,
      depth: projected.z,
      priority,
      pinned,
      position,
      worldWidth: width * worldPerPixel,
      worldHeight: height * worldPerPixel
    };
  }

  private updateLabels() {
    const viewportWidth = this.engine.getRenderWidth();
    const viewportHeight = this.engine.getRenderHeight();
    if (viewportWidth <= 0 || viewportHeight <= 0) return;
    const candidates: RuntimeLabelCandidate[] = [];

    if (this.projection.mode === "Universe") {
      for (const [schemaId, galaxy] of Object.entries(this.layout.galaxies)) {
        if (!this.galaxyMeshes.get(schemaId)?.isEnabled()) continue;
        const schema = this.graph.schemasById.get(schemaId);
        const candidate = this.createProjectedLabel(
          `galaxy:${schemaId}`,
          "galaxy",
          schema?.displayName ?? schema?.name ?? schemaId,
          vector(galaxy.position),
          galaxy.radius * 0.28,
          5_000 + galaxy.nodeCount,
          false,
          viewportWidth,
          viewportHeight
        );
        if (candidate) candidates.push(candidate);
      }
    }

    const relevantNodes =
      this.projection.mode === "Journey"
        ? this.relevantNodeIds(this.projection.pathEdgeIds)
        : this.relevantNodeIds(this.projection.lineageEdgeIds);
    for (const nodeId of this.nodeLabelIds()) {
      const mesh = this.nodeMeshes.get(nodeId);
      const item = this.layout.nodes[nodeId];
      const node = this.graph.nodesById.get(nodeId);
      if (!mesh?.isEnabled() || !item || !node) continue;
      const distance = Vector3.Distance(this.camera.globalPosition, vector(item.position));
      const worldPerPixel = (2 * distance * Math.tan(this.camera.fov / 2)) / viewportHeight;
      const screenRadius = item.radius / Math.max(worldPerPixel, Number.EPSILON);
      const isSelected = nodeId === this.projection.selectedNodeId;
      const isHovered = nodeId === this.projection.hoveredNodeId;
      const isRelevant = relevantNodes.has(nodeId);
      if (this.projection.mode === "Universe" && !isSelected && !isHovered && screenRadius < 4.2) {
        continue;
      }
      const priority = isSelected
        ? 10_000
        : isHovered
          ? 9_500
          : isRelevant
            ? 7_000 + item.importance
            : 1_000 + item.importance;
      const candidate = this.createProjectedLabel(
        `node:${nodeId}`,
        "node",
        node.name,
        vector(item.position),
        item.radius,
        priority,
        isSelected || isHovered,
        viewportWidth,
        viewportHeight
      );
      if (candidate) candidates.push(candidate);
    }

    const selected = selectNonOverlappingLabels(
      candidates,
      { width: viewportWidth, height: viewportHeight },
      labelBudget(this.projection.mode, this.projection.quality)
    );
    const selectedIds = new Set(selected.map((candidate) => candidate.id));
    for (const slot of this.labelSlots) {
      if (slot.labelId && !selectedIds.has(slot.labelId)) {
        slot.mesh.setEnabled(false);
        slot.labelId = null;
      }
    }
    const availableSlots = this.labelSlots.filter((slot) => slot.labelId === null);
    for (const candidate of selected) {
      const slot =
        this.labelSlots.find((candidateSlot) => candidateSlot.labelId === candidate.id) ??
        availableSlots.shift();
      if (!slot) break;
      slot.labelId = candidate.id;
      this.drawLabel(slot, candidate.text, candidate.kind);
      slot.mesh.position.copyFrom(candidate.position);
      slot.mesh.scaling.set(candidate.worldWidth, candidate.worldHeight, 1);
      slot.mesh.setEnabled(true);
    }
  }

  private readonly resize = () => this.engine.resize();

  private material(name: string, color: Color3, alpha = 1) {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = color.scale(0.12);
    material.emissiveColor = color;
    material.specularColor = Color3.Black();
    material.alpha = alpha;
    material.disableLighting = true;
    return material;
  }

  private buildGalaxies() {
    const source = MeshBuilder.CreateSphere(
      "batch:galaxies",
      { diameter: 2, segments: 12 },
      this.scene
    );
    source.material = this.material("batch-mat:galaxies", Color3.FromHexString("#324b9c"), 0.13);
    source.isVisible = false;
    source.isPickable = false;
    for (const galaxy of Object.values(this.layout.galaxies)) {
      const mesh = source.createInstance(`galaxy:${galaxy.schemaId}`);
      mesh.position = vector(galaxy.position);
      mesh.scaling.setAll(galaxy.radius);
      mesh.isPickable = true;
      mesh.metadata = { type: "galaxy", id: galaxy.schemaId };
      this.galaxyMeshes.set(galaxy.schemaId, mesh);
    }
  }

  private buildNodes() {
    const groups = new Map<string, typeof this.graph.document.nodes>();
    for (const node of this.graph.nodesById.values()) {
      const key = `${node.kind}:${node.table?.engineFamily ?? "Virtual"}`;
      const bucket = groups.get(key);
      if (bucket) bucket.push(node);
      else groups.set(key, [node]);
    }
    for (const [groupKey, nodes] of groups) {
      const first = nodes[0];
      if (!first) continue;
      const isView = first.kind === "view";
      const isStation = first.kind === "materialized_view";
      const isPortal = first.kind === "distributed_table";
      const source = isStation
        ? MeshBuilder.CreateTorus(
            `batch:${groupKey}`,
            { diameter: 2, thickness: 0.38, tessellation: 12 },
            this.scene
          )
        : isPortal
          ? MeshBuilder.CreateTorus(
              `batch:${groupKey}`,
              { diameter: 2, thickness: 0.32, tessellation: 16 },
              this.scene
            )
          : MeshBuilder.CreateSphere(
              `batch:${groupKey}`,
              { diameter: 2, segments: isView ? 6 : 8 },
              this.scene
            );
      const color =
        KIND_COLORS[first.kind] ??
        (() => {
          const [r, g, b] = engineColor(first.table?.engineFamily);
          return new Color3(r, g, b);
        })();
      source.material = this.material(`batch-mat:${groupKey}`, color);
      source.isVisible = false;
      source.isPickable = false;
      nodes.forEach((node) => {
        const item = this.layout.nodes[node.id];
        if (!item) return;
        const mesh = source.createInstance(`node:${node.id}`);
        mesh.position = vector(item.position);
        mesh.scaling.setAll(item.radius);
        mesh.isPickable = true;
        mesh.metadata = { type: "node", id: node.id };
        mesh.freezeWorldMatrix();
        this.nodeMeshes.set(node.id, mesh);
      });
    }
  }

  private route(
    name: string,
    points: Vector3[],
    color: Color3,
    alpha: number,
    metadata: Record<string, unknown>
  ) {
    const mesh = MeshBuilder.CreateLines(name, { points }, this.scene);
    mesh.color = color;
    mesh.alpha = alpha;
    mesh.isPickable = false;
    mesh.metadata = metadata;
    return mesh;
  }

  private buildAggregateRoutes() {
    const routes = this.layout.aggregateRoutes.slice(0, 120);
    if (routes.length === 0) return;
    const lines = routes.map((route) =>
      Curve3.CreateCatmullRomSpline(route.points.map(vector), 12, false).getPoints()
    );
    const mesh = MeshBuilder.CreateLineSystem("aggregate-routes", { lines }, this.scene);
    mesh.color = Color3.FromHexString("#527bff");
    mesh.alpha = 0.5;
    mesh.isPickable = false;
    mesh.metadata = { type: "aggregate-batch", count: routes.length };
    this.aggregateRoutes.push(mesh);
  }

  private routeArrowSource(edgeType: string, color: Color3) {
    const existing = this.routeArrowSources.get(edgeType);
    if (existing) return existing;

    const source = MeshBuilder.CreateCylinder(
      `route-arrow-source:${edgeType}`,
      { height: 1, diameterTop: 0, diameterBottom: 1, tessellation: 8 },
      this.scene
    );
    source.rotation.x = Math.PI / 2;
    source.bakeCurrentTransformIntoVertices();
    source.material = this.material(`route-arrow-mat:${edgeType}`, color, 0.82);
    source.isVisible = false;
    source.isPickable = false;
    this.routeArrowSources.set(edgeType, source);
    return source;
  }

  private addRouteArrow(
    edgeId: string,
    edgeType: string,
    color: Color3,
    approach: Vector3,
    target: Vector3,
    targetRadius: number,
    routeDistance: number
  ) {
    const placement = calculateRouteArrowPlacement(
      [approach.x, approach.y, approach.z],
      [target.x, target.y, target.z],
      targetRadius,
      routeDistance
    );
    if (!placement) return;

    const direction = vector(placement.direction);
    const up =
      Math.abs(Vector3.Dot(direction, Vector3.Up())) > 0.96 ? Vector3.Right() : Vector3.Up();
    const arrow = this.routeArrowSource(edgeType, color).createInstance(`edge-arrow:${edgeId}`);
    arrow.position = vector(placement.position);
    arrow.scaling.set(placement.width, placement.width, placement.length);
    arrow.rotationQuaternion = Quaternion.FromLookDirectionLH(direction, up);
    arrow.isPickable = false;
    arrow.metadata = { type: "edge-arrow", id: edgeId };
    arrow.freezeWorldMatrix();
    this.detailedRouteArrows.push(arrow);
  }

  private cargoShipSource(edgeType: string, color: Color3) {
    const existing = this.cargoShipSources.get(edgeType);
    if (existing) return existing;

    const body = MeshBuilder.CreateBox(
      `cargo-body:${edgeType}`,
      { width: 0.2, height: 0.14, depth: 0.62 },
      this.scene
    );
    const hold = MeshBuilder.CreateBox(
      `cargo-hold:${edgeType}`,
      { width: 0.36, height: 0.2, depth: 0.3 },
      this.scene
    );
    hold.position.z = -0.2;
    const wings = MeshBuilder.CreateBox(
      `cargo-wings:${edgeType}`,
      { width: 0.72, height: 0.045, depth: 0.22 },
      this.scene
    );
    wings.position.z = -0.05;
    const nose = MeshBuilder.CreateCylinder(
      `cargo-nose:${edgeType}`,
      { height: 0.28, diameterTop: 0, diameterBottom: 0.2, tessellation: 4 },
      this.scene
    );
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 0.45;
    const source = Mesh.MergeMeshes([body, hold, wings, nose], true, true);
    if (!source) throw new Error(`Could not build cargo ship mesh for ${edgeType}`);
    source.name = `cargo-ship-source:${edgeType}`;
    source.material = this.material(
      `cargo-ship-mat:${edgeType}`,
      Color3.Lerp(color, Color3.White(), 0.45),
      0.96
    );
    source.isVisible = false;
    source.isPickable = false;
    this.cargoShipSources.set(edgeType, source);
    return source;
  }

  private addCargoShip(
    edgeId: string,
    edgeType: string,
    color: Color3,
    curvePoints: readonly Vector3[],
    sourceRadius: number,
    targetRadius: number
  ) {
    const metrics = buildPolylineMetrics(
      curvePoints.map((point): Vector3Tuple => [point.x, point.y, point.z])
    );
    if (!metrics) return;
    const startProgress = Math.min(0.22, (sourceRadius + 0.45) / metrics.totalLength);
    const endProgress = Math.max(
      startProgress + 0.08,
      1 - Math.min(0.28, (targetRadius + 0.85) / metrics.totalLength)
    );
    const progressSpan = Math.min(1, endProgress) - startProgress;
    if (progressSpan < 0.05) return;
    const phase = deterministicPhase(edgeId);
    const ship: CargoShipAnimation = {
      mesh: this.cargoShipSource(edgeType, color).createInstance(`cargo-ship:${edgeId}`),
      metrics,
      progress: phase,
      speed: (2.4 + phase * 0.9) / (metrics.totalLength * progressSpan),
      startProgress,
      progressSpan
    };
    ship.mesh.scaling.setAll(1.05);
    ship.mesh.rotationQuaternion = Quaternion.Identity();
    ship.mesh.isPickable = false;
    ship.mesh.metadata = { type: "cargo-ship", id: edgeId };
    this.cargoShips.push(ship);
    this.positionCargoShip(ship);
  }

  private positionCargoShip(ship: CargoShipAnimation) {
    const sample = samplePolyline(
      ship.metrics,
      ship.startProgress + ship.progress * ship.progressSpan
    );
    if (!sample) return;
    const direction = vector(sample.direction);
    const up =
      Math.abs(Vector3.Dot(direction, Vector3.Up())) > 0.96 ? Vector3.Right() : Vector3.Up();
    ship.mesh.position.copyFrom(vector(sample.position));
    ship.mesh.rotationQuaternion?.copyFrom(Quaternion.FromLookDirectionLH(direction, up));
  }

  private updateCargoShips(deltaMs: number) {
    const deltaSeconds = Math.min(50, Math.max(0, deltaMs)) / 1000;
    for (const ship of this.cargoShips) {
      ship.progress = (ship.progress + deltaSeconds * ship.speed) % 1;
      this.positionCargoShip(ship);
    }
  }

  private animatedEdgeIds(candidates: ReadonlySet<string>) {
    if (!this.projection.cargoShipsEnabled) return new Set<string>();

    const prioritized =
      this.projection.mode === "Journey" && this.projection.pathEdgeIds.size > 0
        ? [...this.projection.pathEdgeIds]
        : this.projection.mode === "Focus" && this.projection.lineageEdgeIds.size > 0
          ? [...this.projection.lineageEdgeIds]
          : [...candidates].sort((leftId, rightId) => {
              const left = this.graph.edgesById.get(leftId);
              const right = this.graph.edgesById.get(rightId);
              const leftImportance = left
                ? (this.layout.nodes[left.sourceNodeId]?.importance ?? 0) +
                  (this.layout.nodes[left.targetNodeId]?.importance ?? 0)
                : 0;
              const rightImportance = right
                ? (this.layout.nodes[right.sourceNodeId]?.importance ?? 0) +
                  (this.layout.nodes[right.targetNodeId]?.importance ?? 0)
                : 0;
              return rightImportance - leftImportance || leftId.localeCompare(rightId);
            });
    return new Set(prioritized.slice(0, cargoShipBudget(this.projection.quality)));
  }

  private rebuildDetailedRoutes() {
    this.detailedRoutes.forEach((mesh) => mesh.dispose());
    this.detailedRoutes.length = 0;
    this.detailedRouteArrows.forEach((mesh) => mesh.dispose());
    this.detailedRouteArrows.length = 0;
    this.cargoShips.forEach((ship) => ship.mesh.dispose());
    this.cargoShips.length = 0;
    const candidates =
      this.projection.mode === "Journey"
        ? this.projection.pathEdgeIds
        : this.projection.mode === "Focus"
          ? this.projection.lineageEdgeIds
          : new Set(
              [...this.graph.edgesById.values()]
                .filter((edge) => {
                  const source = this.graph.nodesById.get(edge.sourceNodeId);
                  return source?.schemaId === this.projection.activeSchemaId;
                })
                .slice(0, 260)
                .map((edge) => edge.id)
            );
    const animatedEdgeIds = this.animatedEdgeIds(candidates);
    for (const id of [...candidates].slice(0, 420)) {
      const edge = this.graph.edgesById.get(id);
      if (
        edge &&
        this.projection.edgeTypes.length > 0 &&
        !this.projection.edgeTypes.includes(edge.type)
      ) {
        continue;
      }
      const source = edge ? this.layout.nodes[edge.sourceNodeId] : undefined;
      const target = edge ? this.layout.nodes[edge.targetNodeId] : undefined;
      if (!edge || !source || !target) continue;
      const a = vector(source.position);
      const b = vector(target.position);
      const middle = Vector3.Center(a, b).add(
        new Vector3(0, Math.min(5, Vector3.Distance(a, b) * 0.12), 0)
      );
      const color = Color3.FromHexString(EDGE_COLORS[edge.type] ?? "#727d99");
      const emphasized = this.projection.pathEdgeIds.has(id);
      const curvePoints = Curve3.CreateCatmullRomSpline([a, middle, b], 12, false).getPoints();
      this.detailedRoutes.push(
        this.route(`edge:${id}`, curvePoints, color, emphasized ? 1 : 0.72, { type: "edge", id })
      );
      this.addRouteArrow(id, edge.type, color, middle, b, target.radius, Vector3.Distance(a, b));
      if (animatedEdgeIds.has(id)) {
        this.addCargoShip(id, edge.type, color, curvePoints, source.radius, target.radius);
      }
    }
  }

  private installPicking() {
    let lastHovered: string | null = null;
    this.scene.onPointerObservable.add((info) => {
      const picked = info.pickInfo?.pickedMesh;
      const metadata = picked?.metadata as { type?: string; id?: string } | undefined;
      if (info.type === PointerEventTypes.POINTERMOVE) {
        const next = metadata?.type === "node" ? (metadata.id ?? null) : null;
        if (next !== lastHovered) {
          lastHovered = next;
          this.callbacks.onHoverNode(next);
        }
      }
      if (info.type === PointerEventTypes.POINTERDOUBLETAP && metadata?.id) {
        if (metadata.type === "node") this.callbacks.onSelectNode(metadata.id);
        if (metadata.type === "galaxy") this.callbacks.onEnterGalaxy(metadata.id);
      }
      if (info.type === PointerEventTypes.POINTERPICK && metadata?.type === "node" && metadata.id) {
        this.callbacks.onSelectNode(metadata.id);
      }
    });
  }

  applyProjection(projection: SceneProjection) {
    const modeChanged =
      projection.mode !== this.projection.mode ||
      projection.activeSchemaId !== this.projection.activeSchemaId;
    const edgesChanged =
      projection.lineageEdgeIds !== this.projection.lineageEdgeIds ||
      projection.pathEdgeIds !== this.projection.pathEdgeIds ||
      projection.edgeTypes.join("|") !== this.projection.edgeTypes.join("|");
    const qualityChanged = projection.quality !== this.projection.quality;
    const cargoShipsChanged =
      projection.cargoShipsEnabled !== this.projection.cargoShipsEnabled;
    this.projection = projection;
    for (const [id, mesh] of this.nodeMeshes) {
      const node = this.graph.nodesById.get(id);
      const schemaVisible =
        projection.mode === "Universe" ||
        projection.mode === "Focus" ||
        projection.mode === "Journey" ||
        node?.schemaId === projection.activeSchemaId;
      const importanceVisible =
        projection.mode !== "Universe" || (this.layout.nodes[id]?.importance ?? 0) >= 7;
      mesh.setEnabled(projection.visibleNodeIds.has(id) && schemaVisible && importanceVisible);
    }
    for (const route of this.aggregateRoutes) route.setEnabled(projection.mode === "Universe");
    for (const [id, mesh] of this.galaxyMeshes) {
      mesh.setEnabled(
        projection.mode === "Universe" ||
          id === projection.activeSchemaId ||
          (projection.mode === "Focus" &&
            this.graph.nodesById.get(projection.selectedNodeId ?? "")?.schemaId === id)
      );
    }
    if (modeChanged || edgesChanged || qualityChanged || cargoShipsChanged) {
      this.rebuildDetailedRoutes();
    }
    this.updateSelection();
    this.updateLabels();
  }

  private updateSelection() {
    this.selectionMarker?.dispose();
    this.selectionMarker = null;
    const id = this.projection.selectedNodeId ?? this.projection.hoveredNodeId;
    const item = id ? this.layout.nodes[id] : undefined;
    if (!id || !item) return;
    const marker = MeshBuilder.CreateTorus(
      "selection-marker",
      { diameter: item.radius * 2.7, thickness: 0.09, tessellation: 24 },
      this.scene
    );
    marker.position = vector(item.position);
    marker.billboardMode = Mesh.BILLBOARDMODE_ALL;
    marker.material = this.material("selection-marker-mat", Color3.FromHexString("#ffffff"));
    marker.isPickable = false;
    this.selectionMarker = marker;
  }

  private animateCamera(target: Vector3, radius: number) {
    this.scene.stopAnimation(this.camera);
    Animation.CreateAndStartAnimation(
      "camera-target",
      this.camera,
      "target",
      60,
      55,
      this.camera.target.clone(),
      target,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    Animation.CreateAndStartAnimation(
      "camera-radius",
      this.camera,
      "radius",
      60,
      55,
      this.camera.radius,
      radius,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
  }

  focusNode(id: string) {
    const item = this.layout.nodes[id];
    if (item) this.animateCamera(vector(item.position), Math.max(7, item.radius * 6));
  }

  focusGalaxy(id: string) {
    const item = this.layout.galaxies[id];
    if (item) this.animateCamera(vector(item.position), item.radius * 2.8);
  }

  setMode(mode: AppMode) {
    if (mode === "Universe") this.animateCamera(Vector3.Zero(), 145);
    if (mode === "Galaxy" && this.projection.activeSchemaId)
      this.focusGalaxy(this.projection.activeSchemaId);
    if (mode === "Focus" && this.projection.selectedNodeId)
      this.focusNode(this.projection.selectedNodeId);
  }

  jumpJourneySegment(segment: number, progress = 0) {
    const edgeId = [...this.projection.pathEdgeIds][segment];
    const edge = edgeId ? this.graph.edgesById.get(edgeId) : undefined;
    if (!edge) return;
    const a = this.layout.nodes[edge.sourceNodeId];
    const b = this.layout.nodes[edge.targetNodeId];
    if (!a || !b) return;
    const position = Vector3.Lerp(vector(a.position), vector(b.position), progress);
    const target = vector(b.position);
    this.camera.setPosition(position.add(new Vector3(0, 2.2, -4.5)));
    this.camera.setTarget(target);
  }

  private reportStats() {
    this.callbacks.onStats({
      fps: this.engine.getFps(),
      frameMs: this.engine.getDeltaTime(),
      drawCalls: this.instrumentation.drawCallsCounter.current,
      activeMeshes: this.scene.getActiveMeshes().length,
      visibleNodes: [...this.nodeMeshes.values()].filter((mesh) => mesh.isEnabled()).length,
      visibleLabels: this.labelSlots.filter((slot) => slot.mesh.isEnabled()).length,
      visibleDetailedEdges: this.detailedRoutes.length,
      animatedCargoShips: this.cargoShips.length,
      visibleAggregateEdges:
        this.projection.mode === "Universe" ? Math.min(120, this.layout.aggregateRoutes.length) : 0
    });
  }

  dispose() {
    window.removeEventListener("resize", this.resize);
    this.engine.stopRenderLoop();
    this.instrumentation.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}
