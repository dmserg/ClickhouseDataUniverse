import {
  AbstractMesh,
  Animation,
  ArcRotateCamera,
  Color3,
  Color4,
  Curve3,
  Engine,
  GlowLayer,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PointerEventTypes,
  Scene,
  SceneInstrumentation,
  StandardMaterial,
  Vector3
} from "@babylonjs/core";
import type { AppMode, QualityPreset } from "../app/store";
import type { DomainGraph, EdgeType } from "../domain/types";
import type { LayoutResult, Vector3Tuple } from "../layout/types";
import { engineColor } from "./renderModel";
import type { SceneBridge } from "./sceneBridge";

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
  visibleDetailedEdges: number;
  visibleAggregateEdges: number;
}

const KIND_COLORS: Record<string, Color3> = {
  view: Color3.FromHexString("#70d7ff"),
  materialized_view: Color3.FromHexString("#ff8cf0"),
  distributed_table: Color3.FromHexString("#45f3ff"),
  external_table: Color3.FromHexString("#57f2a7"),
  special_table: Color3.FromHexString("#ff6f85")
};

function vector(value: Vector3Tuple) {
  return new Vector3(value[0], value[1], value[2]);
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
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true });
    this.scene = new Scene(this.engine);
    this.instrumentation = new SceneInstrumentation(this.scene);
    this.scene.clearColor = new Color4(0.008, 0.012, 0.035, 1);
    this.scene.ambientColor = new Color3(0.13, 0.16, 0.3);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.0016;
    this.scene.fogColor = new Color3(0.008, 0.012, 0.035);
    this.camera = new ArcRotateCamera("universe-camera", -Math.PI / 2, 1.06, 145, Vector3.Zero(), this.scene);
    this.camera.lowerRadiusLimit = 3;
    this.camera.upperRadiusLimit = 420;
    this.camera.wheelPrecision = 7;
    this.camera.panningSensibility = 90;
    this.camera.attachControl(canvas, true);
    new HemisphericLight("shared-fill", new Vector3(0, 1, 0), this.scene).intensity = 0.32;
    new GlowLayer("shared-glow", this.scene, {
      mainTextureFixedSize: projection.quality === "Low" ? 256 : 512,
      blurKernelSize: projection.quality === "High" ? 64 : 32
    }).intensity = 0.7;
    this.buildGalaxies();
    this.buildNodes();
    this.buildAggregateRoutes();
    this.installPicking();
    this.applyProjection(projection);
    this.engine.runRenderLoop(() => {
      this.scene.render();
      this.statsTick += 1;
      if (this.statsTick % 24 === 0) this.reportStats();
    });
    window.addEventListener("resize", this.resize);
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
    source.material = this.material(
      "batch-mat:galaxies",
      Color3.FromHexString("#324b9c"),
      0.13
    );
    source.isVisible = false;
    source.isPickable = false;
    for (const galaxy of Object.values(this.layout.galaxies)) {
      const mesh = source.createInstance(`galaxy:${galaxy.schemaId}`);
      mesh.position = vector(galaxy.position);
      mesh.scaling = new Vector3(galaxy.radius, galaxy.radius * 0.26, galaxy.radius);
      mesh.visibility = 0.36;
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
    const curve = Curve3.CreateCatmullRomSpline(points, 12, false);
    const mesh = MeshBuilder.CreateLines(name, { points: curve.getPoints() }, this.scene);
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

  private rebuildDetailedRoutes() {
    this.detailedRoutes.forEach((mesh) => mesh.dispose());
    this.detailedRoutes.length = 0;
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
    const colors: Record<string, string> = {
      etl_transfer: "#ffb84a",
      view_dependency: "#5bd7ff",
      materialized_view_input: "#f17cff",
      materialized_view_target: "#ff6e97",
      distributed_reference: "#42f1c1",
      manual_dependency: "#a7b2cf",
      unknown: "#727d99"
    };
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
      const middle = Vector3.Center(a, b).add(new Vector3(0, Math.min(5, Vector3.Distance(a, b) * 0.12), 0));
      this.detailedRoutes.push(
        this.route(
          `edge:${id}`,
          [a, middle, b],
          Color3.FromHexString(colors[edge.type] ?? "#727d99"),
          this.projection.pathEdgeIds.has(id) ? 1 : 0.72,
          { type: "edge", id }
        )
      );
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
    if (modeChanged || edgesChanged) this.rebuildDetailedRoutes();
    this.updateSelection();
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
      visibleDetailedEdges: this.detailedRoutes.length,
      visibleAggregateEdges:
        this.projection.mode === "Universe"
          ? Math.min(120, this.layout.aggregateRoutes.length)
          : 0
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
