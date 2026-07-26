import { useEffect, useMemo, useRef, useState } from "react";
import { visibleNodeIds } from "../domain/filters";
import { SceneController, type SceneStats } from "../rendering/SceneController";
import { registerSceneBridge } from "../rendering/sceneBridge";
import { useAppStore } from "../app/store";
import { useShallow } from "zustand/react/shallow";

export function SceneCanvas({ onStats }: { onStats: (stats: SceneStats) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<SceneController | null>(null);
  const [readyKey, setReadyKey] = useState(0);
  const graph = useAppStore((state) => state.graph);
  const layout = useAppStore((state) => state.layout);
  const projectionState = useAppStore(
    useShallow((state) => ({
      mode: state.mode,
      activeSchemaId: state.activeSchemaId,
      selectedNodeId: state.selectedNodeId,
      hoveredNodeId: state.hoveredNodeId,
      graph: state.graph,
      filters: state.filters,
      lineageEdgeIds: state.lineageEdgeIds,
      pathEdgeIds: state.activePath?.edgeIds,
      quality: state.quality
    }))
  );
  const projection = useMemo(
    () => ({
      mode: projectionState.mode,
      activeSchemaId: projectionState.activeSchemaId,
      selectedNodeId: projectionState.selectedNodeId,
      hoveredNodeId: projectionState.hoveredNodeId,
      visibleNodeIds: projectionState.graph
        ? visibleNodeIds(projectionState.graph, projectionState.filters)
        : new Set<string>(),
      lineageEdgeIds: projectionState.lineageEdgeIds,
      pathEdgeIds: new Set(projectionState.pathEdgeIds ?? []),
      edgeTypes: projectionState.filters.edgeTypes,
      quality: projectionState.quality
    }),
    [projectionState]
  );

  useEffect(() => {
    if (!canvasRef.current || !graph || !layout) return;
    const controller = new SceneController(canvasRef.current, graph, layout, projection, {
      onSelectNode: (id) => {
        useAppStore.getState().selectNode(id);
        queueMicrotask(() => controller.focusNode(id));
      },
      onHoverNode: (id) => useAppStore.getState().hoverNode(id),
      onEnterGalaxy: (id) => {
        useAppStore.getState().enterGalaxy(id);
        queueMicrotask(() => controller.focusGalaxy(id));
      },
      onStats
    });
    controllerRef.current = controller;
    registerSceneBridge(controller);
    setReadyKey((key) => key + 1);
    return () => {
      registerSceneBridge(null);
      controller.dispose();
      controllerRef.current = null;
    };
    // The scene lifecycle follows loaded document identity only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, layout, onStats]);

  useEffect(() => {
    controllerRef.current?.applyProjection(projection);
  }, [projection, readyKey]);

  return <canvas ref={canvasRef} className="universe-canvas" aria-label="3D ClickHouse universe" />;
}
