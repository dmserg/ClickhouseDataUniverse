import { create } from "zustand";
import type {
  DomainGraph,
  EdgeType,
  FilterState,
  GraphPath,
  ValidationIssue
} from "../domain/types";
import { DEFAULT_FILTERS } from "../domain/filters";
import type { LayoutResult } from "../layout/types";

export type AppMode = "Universe" | "Galaxy" | "Focus" | "Journey";
export type QualityPreset = "Low" | "Medium" | "High";
export type PathMode = "any" | "etl" | "view";

export interface JourneyState {
  playing: boolean;
  speed: number;
  segment: number;
  progress: number;
}

interface AppState {
  graph: DomainGraph | null;
  layout: LayoutResult | null;
  loadingMessage: string | null;
  issues: ValidationIssue[];
  normalizationMs: number;
  mode: AppMode;
  activeSchemaId: string | null;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  filters: FilterState;
  lineageDirection: "upstream" | "downstream" | "both";
  lineageDepth: number;
  lineageNodeIds: Set<string>;
  lineageEdgeIds: Set<string>;
  sourceNodeId: string | null;
  destinationNodeId: string | null;
  pathMode: PathMode;
  activePath: GraphPath | null;
  pathMessage: string | null;
  quality: QualityPreset;
  showPerformance: boolean;
  journey: JourneyState;
  setData: (graph: DomainGraph, layout: LayoutResult, normalizationMs: number) => void;
  setLoading: (message: string | null) => void;
  setIssues: (issues: ValidationIssue[]) => void;
  selectNode: (id: string | null) => void;
  hoverNode: (id: string | null) => void;
  setMode: (mode: AppMode) => void;
  enterGalaxy: (schemaId: string) => void;
  setFilters: (filters: FilterState) => void;
  resetFilters: () => void;
  setLineage: (nodeIds: Set<string>, edgeIds: Set<string>) => void;
  setLineageDirection: (direction: "upstream" | "downstream" | "both") => void;
  setLineageDepth: (depth: number) => void;
  setSource: (id: string | null) => void;
  setDestination: (id: string | null) => void;
  setPathMode: (mode: PathMode) => void;
  setPath: (path: GraphPath | null, message: string | null) => void;
  setQuality: (quality: QualityPreset) => void;
  togglePerformance: () => void;
  startJourney: () => void;
  exitJourney: () => void;
  updateJourney: (patch: Partial<JourneyState>) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  graph: null,
  layout: null,
  loadingMessage: "Reading local star charts…",
  issues: [],
  normalizationMs: 0,
  mode: "Universe",
  activeSchemaId: null,
  selectedNodeId: null,
  hoveredNodeId: null,
  filters: DEFAULT_FILTERS,
  lineageDirection: "both",
  lineageDepth: 1,
  lineageNodeIds: new Set(),
  lineageEdgeIds: new Set(),
  sourceNodeId: null,
  destinationNodeId: null,
  pathMode: "any",
  activePath: null,
  pathMessage: null,
  quality: "Medium",
  showPerformance: false,
  journey: { playing: false, speed: 1, segment: 0, progress: 0 },
  setData: (graph, layout, normalizationMs) =>
    set({ graph, layout, normalizationMs, loadingMessage: null, issues: [] }),
  setLoading: (loadingMessage) => set({ loadingMessage }),
  setIssues: (issues) => set({ issues, loadingMessage: null }),
  selectNode: (selectedNodeId) => {
    const graph = get().graph;
    const schemaId = selectedNodeId ? graph?.nodesById.get(selectedNodeId)?.schemaId : undefined;
    set({
      selectedNodeId,
      mode: selectedNodeId ? "Focus" : get().activeSchemaId ? "Galaxy" : "Universe",
      activeSchemaId: schemaId ?? get().activeSchemaId,
      lineageNodeIds: new Set(selectedNodeId ? [selectedNodeId] : []),
      lineageEdgeIds: new Set()
    });
  },
  hoverNode: (hoveredNodeId) => set({ hoveredNodeId }),
  setMode: (mode) =>
    set({
      mode,
      activeSchemaId: mode === "Universe" ? null : get().activeSchemaId,
      journey: mode === "Journey" ? get().journey : { ...get().journey, playing: false }
    }),
  enterGalaxy: (activeSchemaId) => set({ activeSchemaId, mode: "Galaxy", selectedNodeId: null }),
  setFilters: (filters) => set({ filters }),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),
  setLineage: (lineageNodeIds, lineageEdgeIds) => set({ lineageNodeIds, lineageEdgeIds }),
  setLineageDirection: (lineageDirection) => set({ lineageDirection }),
  setLineageDepth: (lineageDepth) => set({ lineageDepth }),
  setSource: (sourceNodeId) => set({ sourceNodeId, activePath: null, pathMessage: null }),
  setDestination: (destinationNodeId) =>
    set({ destinationNodeId, activePath: null, pathMessage: null }),
  setPathMode: (pathMode) => set({ pathMode, activePath: null, pathMessage: null }),
  setPath: (activePath, pathMessage) => set({ activePath, pathMessage }),
  setQuality: (quality) => set({ quality }),
  togglePerformance: () => set((state) => ({ showPerformance: !state.showPerformance })),
  startJourney: () =>
    set({
      mode: "Journey",
      journey: { ...get().journey, playing: true, segment: 0, progress: 0 }
    }),
  exitJourney: () =>
    set({
      mode: get().selectedNodeId ? "Focus" : get().activeSchemaId ? "Galaxy" : "Universe",
      journey: { ...get().journey, playing: false, segment: 0, progress: 0 }
    }),
  updateJourney: (patch) => set({ journey: { ...get().journey, ...patch } })
}));

export function allowedPathTypes(mode: PathMode): ReadonlySet<EdgeType> | undefined {
  if (mode === "etl") return new Set(["etl_transfer"]);
  if (mode === "view") return new Set(["view_dependency"]);
  return undefined;
}
