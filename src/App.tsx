import { useCallback, useEffect, useMemo, useState } from "react";
import { loadUniverse, loadUniverseUrl } from "./import/loadUniverse";
import { runLayout } from "./layout/layoutClient";
import { useAppStore } from "./app/store";
import { visibleNodeIds } from "./domain/filters";
import { SceneCanvas } from "./ui/SceneCanvas";
import type { SceneStats } from "./rendering/SceneController";
import { SearchBox } from "./ui/SearchBox";
import { FiltersPanel } from "./ui/FiltersPanel";
import { DetailsPanel } from "./ui/DetailsPanel";
import { JourneyHud } from "./ui/JourneyHud";
import { sceneBridge } from "./rendering/sceneBridge";

const EMPTY_STATS: SceneStats = {
  fps: 0,
  frameMs: 0,
  drawCalls: 0,
  activeMeshes: 0,
  visibleNodes: 0,
  visibleLabels: 0,
  visibleDetailedEdges: 0,
  visibleAggregateEdges: 0
};

export default function App() {
  const state = useAppStore();
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [detailsCollapsed, setDetailsCollapsed] = useState(false);
  const [stats, setStats] = useState(EMPTY_STATS);
  const initialDataset =
    new URLSearchParams(window.location.search).get("dataset") === "large" ? "large" : "small";
  const [dataset, setDataset] = useState<"small" | "large">(initialDataset);
  const visible = useMemo(
    () => (state.graph ? visibleNodeIds(state.graph, state.filters) : new Set<string>()),
    [state.graph, state.filters]
  );
  const receiveStats = useCallback((value: SceneStats) => setStats(value), []);

  const openDocument = useCallback(async (input: unknown, label: string) => {
    const store = useAppStore.getState();
    store.setLoading(`Validating ${label}…`);
    const result = loadUniverse(input);
    if (!result.ok) {
      store.setIssues(result.issues);
      return;
    }
    store.setLoading(`Charting ${result.graph.document.nodes.length.toLocaleString()} objects in a worker…`);
    try {
      const layout = await runLayout(result.graph);
      store.setData(result.graph, layout, result.normalizationMs);
    } catch (error) {
      store.setIssues([{ path: "/", message: `Layout worker failed: ${String(error)}` }]);
    }
  }, []);

  const loadBundled = useCallback(async (name: "small" | "large") => {
    const store = useAppStore.getState();
    store.setLoading(`Loading ${name} local dataset…`);
    const result = await loadUniverseUrl(`/mock/universe-${name}.json`);
    if (!result.ok) {
      store.setIssues(result.issues);
      return;
    }
    store.setLoading(`Charting ${result.graph.document.nodes.length.toLocaleString()} objects in a worker…`);
    try {
      const layout = await runLayout(result.graph);
      store.setData(result.graph, layout, result.normalizationMs);
    } catch (error) {
      store.setIssues([{ path: "/", message: `Layout worker failed: ${String(error)}` }]);
    }
  }, []);

  useEffect(() => {
    void loadBundled(initialDataset);
  }, [initialDataset, loadBundled]);

  useEffect(() => {
    queueMicrotask(() => sceneBridge()?.setMode(state.mode));
  }, [state.mode]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      await openDocument(JSON.parse(await file.text()), file.name);
    } catch (error) {
      state.setIssues([{ path: "/", message: `Invalid JSON: ${String(error)}` }]);
    }
  }

  const selected = state.selectedNodeId ? state.graph?.nodesById.get(state.selectedNodeId) : undefined;
  const schema = state.activeSchemaId ? state.graph?.schemasById.get(state.activeSchemaId) : undefined;

  return (
    <main className={`app quality-${state.quality.toLowerCase()}`}>
      {state.graph && state.layout && <SceneCanvas onStats={receiveStats} />}
      <div className="vignette" />
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><i /><i /><i /></span>
          <div>
            <h1>ClickHouse <b>Universe</b></h1>
            <p>STATIC LINEAGE NAVIGATOR</p>
          </div>
        </div>
        <SearchBox />
        <div className="dataset-control">
          <label>
            <span>Dataset</span>
            <select
              value={dataset}
              onChange={(event) => {
                const value = event.target.value as "small" | "large";
                setDataset(value);
                void loadBundled(value);
              }}
            >
              <option value="small">Small constellation</option>
              <option value="large">Large benchmark</option>
            </select>
          </label>
          <label className="file-button">
            Import JSON
            <input type="file" accept="application/json,.json" onChange={(event) => void handleFile(event.target.files?.[0])} />
          </label>
        </div>
      </header>

      <nav className="breadcrumbs" aria-label="Current location">
        <button
          className={state.mode === "Universe" ? "active" : ""}
          onClick={() => {
            state.setMode("Universe");
            sceneBridge()?.setMode("Universe");
          }}
        >
          Universe
        </button>
        {schema && (
          <>
            <span>›</span>
            <button
              className={state.mode === "Galaxy" ? "active" : ""}
              onClick={() => {
                state.enterGalaxy(schema.id);
                sceneBridge()?.focusGalaxy(schema.id);
              }}
            >
              {schema.displayName ?? schema.name}
            </button>
          </>
        )}
        {selected && (
          <>
            <span>›</span>
            <button className={state.mode === "Focus" ? "active" : ""} onClick={() => state.selectNode(selected.id)}>
              {selected.name}
            </button>
          </>
        )}
      </nav>

      <div className="mode-indicator">
        <i />
        <span>MODE</span>
        <strong>{state.mode.toUpperCase()}</strong>
      </div>

      <FiltersPanel collapsed={filtersCollapsed} onToggle={() => setFiltersCollapsed(!filtersCollapsed)} />
      <DetailsPanel collapsed={detailsCollapsed} onToggle={() => setDetailsCollapsed(!detailsCollapsed)} />

      {state.loadingMessage && (
        <div className="loading-state">
          <div className="orbit-loader"><i /><i /><i /></div>
          <span className="eyebrow">INITIALIZING NAVIGATION ARRAY</span>
          <h2>{state.loadingMessage}</h2>
          <p>The interface remains responsive while the universe is calculated.</p>
        </div>
      )}

      {state.issues.length > 0 && (
        <div className="validation-state" role="alert">
          <span className="eyebrow">INPUT REJECTED</span>
          <h2>The star chart contains {state.issues.length} problem{state.issues.length === 1 ? "" : "s"}.</h2>
          <ul>
            {state.issues.slice(0, 20).map((issue, index) => (
              <li key={`${issue.path}-${index}`}><code>{issue.path}</code><span>{issue.message}</span></li>
            ))}
          </ul>
          <button className="primary" onClick={() => void loadBundled(dataset)}>Reload bundled dataset</button>
        </div>
      )}

      {state.graph && (
        <div className="statusbar">
          <span><b>{visible.size.toLocaleString()}</b> / {state.graph.nodesById.size.toLocaleString()} objects</span>
          <span><b>{state.graph.schemasById.size}</b> galaxies</span>
          <span><b>{state.graph.edgesById.size.toLocaleString()}</b> indexed routes</span>
          <span>layout <b>{state.layout?.durationMs.toFixed(0)} ms</b></span>
        </div>
      )}

      <div className="quality-control">
        <label>
          <span>Visual fidelity</span>
          <select value={state.quality} onChange={(event) => state.setQuality(event.target.value as typeof state.quality)}>
            <option>Low</option><option>Medium</option><option>High</option>
          </select>
        </label>
        <button className={state.showPerformance ? "active" : ""} onClick={state.togglePerformance}>PERF</button>
      </div>

      {state.showPerformance && (
        <div className="performance-overlay">
          <span>FLIGHT RECORDER</span>
          <dl>
            <dt>FPS</dt><dd className={stats.fps < 30 ? "bad" : ""}>{stats.fps.toFixed(0)}</dd>
            <dt>Frame</dt><dd>{stats.frameMs.toFixed(1)} ms</dd>
            <dt>Draw calls</dt><dd>{stats.drawCalls}</dd>
            <dt>Active meshes</dt><dd>{stats.activeMeshes}</dd>
            <dt>Visible nodes</dt><dd>{stats.visibleNodes}</dd>
            <dt>Labels</dt><dd>{stats.visibleLabels}</dd>
            <dt>Detail routes</dt><dd>{stats.visibleDetailedEdges}</dd>
            <dt>Aggregate routes</dt><dd>{stats.visibleAggregateEdges}</dd>
            <dt>Normalize</dt><dd>{state.normalizationMs.toFixed(1)} ms</dd>
            <dt>Worker layout</dt><dd>{state.layout?.durationMs.toFixed(1)} ms</dd>
          </dl>
        </div>
      )}

      {state.hoveredNodeId && state.mode !== "Journey" && (
        <div className="hover-card">
          <span>{state.graph?.nodesById.get(state.hoveredNodeId)?.kind.replaceAll("_", " ")}</span>
          <strong>{state.graph?.nodesById.get(state.hoveredNodeId)?.qualifiedName}</strong>
        </div>
      )}

      <div className="navigation-hint">
        <span><kbd>drag</kbd> orbit</span>
        <span><kbd>shift + drag</kbd> pan</span>
        <span><kbd>wheel</kbd> zoom</span>
        <span><kbd>double-click</kbd> focus</span>
      </div>
      <JourneyHud />
    </main>
  );
}
