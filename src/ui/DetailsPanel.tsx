import { useMemo } from "react";
import { findPath, traverse } from "../domain/algorithms";
import { allowedPathTypes, useAppStore } from "../app/store";
import { sceneBridge } from "../rendering/sceneBridge";

function formatBytes(bytes: number | undefined) {
  if (bytes === undefined) return "Unknown";
  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${units[unit]}`;
}

export function DetailsPanel({ collapsed, onToggle }: { collapsed: boolean; onToggle(): void }) {
  const state = useAppStore();
  const node = state.selectedNodeId ? state.graph?.nodesById.get(state.selectedNodeId) : undefined;
  const hidden = useMemo(
    () =>
      node
        ? !(
            (state.filters.schemaIds.length === 0 ||
              state.filters.schemaIds.includes(node.schemaId)) &&
            (state.filters.kinds.length === 0 || state.filters.kinds.includes(node.kind))
          )
        : false,
    [node, state.filters]
  );
  if (!state.graph) return null;

  function showLineage() {
    if (!state.graph || !node) return;
    const upstream =
      state.lineageDirection === "downstream"
        ? { nodeIds: new Set<string>(), edgeIds: new Set<string>() }
        : traverse(state.graph, node.id, "upstream", state.lineageDepth);
    const downstream =
      state.lineageDirection === "upstream"
        ? { nodeIds: new Set<string>(), edgeIds: new Set<string>() }
        : traverse(state.graph, node.id, "downstream", state.lineageDepth);
    state.setLineage(
      new Set([node.id, ...upstream.nodeIds, ...downstream.nodeIds]),
      new Set([...upstream.edgeIds, ...downstream.edgeIds])
    );
  }

  function runPathfinding() {
    if (!state.graph || !state.sourceNodeId || !state.destinationNodeId) {
      state.setPath(null, "Choose both a source and destination.");
      return;
    }
    const path = findPath(
      state.graph,
      state.sourceNodeId,
      state.destinationNodeId,
      allowedPathTypes(state.pathMode)
    );
    state.setPath(path, path ? `${path.edgeIds.length} hop route locked.` : "No directed route found.");
  }

  return (
    <aside className={`panel details-panel ${collapsed ? "collapsed" : ""}`}>
      <div className="panel-heading">
        <button className="icon-button" onClick={onToggle} aria-label="Toggle details panel">
          {collapsed ? "‹" : "›"}
        </button>
        {!collapsed && (
          <div>
            <span className="eyebrow">OBJECT TELEMETRY</span>
            <h2>{node ? node.name : "No selection"}</h2>
          </div>
        )}
      </div>
      {!collapsed && (
        <div className="panel-scroll">
          {!node ? (
            <div className="empty-panel">
              <div className="radar-glyph">⌁</div>
              <p>Select a star, planet, station, or portal to inspect its lineage.</p>
            </div>
          ) : (
            <>
              {hidden && (
                <div className="warning-banner">
                  Active filters hide this object. The selection is preserved.
                </div>
              )}
              <div className="object-title">
                <span className={`object-symbol ${node.kind}`} />
                <div>
                  <strong>{node.qualifiedName}</strong>
                  <span>{node.kind.replaceAll("_", " ")}</span>
                </div>
              </div>
              <dl className="details-grid">
                <dt>Schema</dt><dd>{state.graph.schemasById.get(node.schemaId)?.displayName ?? node.schemaId}</dd>
                <dt>Engine</dt><dd>{node.table?.engine ?? "Virtual"}</dd>
                <dt>Family</dt><dd>{node.table?.engineFamily ?? "Unknown"}</dd>
                <dt>Size</dt><dd>{formatBytes(node.table?.size?.bytes)}</dd>
                <dt>Semantics</dt><dd>{node.table?.size ? `${node.table.size.kind} · ${node.table.size.scope}${node.table.size.isApproximate ? " · approx." : ""}` : "Not applicable"}</dd>
                <dt>Rows</dt><dd>{node.table?.rows?.toLocaleString() ?? "Unknown"}</dd>
                <dt>Owner</dt><dd>{node.owner ?? "Unknown"}</dd>
                <dt>Upstream</dt><dd>{state.graph.incomingEdgeIdsByNodeId.get(node.id)?.length ?? 0}</dd>
                <dt>Downstream</dt><dd>{state.graph.outgoingEdgeIdsByNodeId.get(node.id)?.length ?? 0}</dd>
              </dl>
              {node.tags && <div className="tags">{node.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
              <div className="action-row">
                <button className="secondary" onClick={() => state.setSource(node.id)}>Set source</button>
                <button className="secondary" onClick={() => state.setDestination(node.id)}>Set destination</button>
              </div>
              <section className="control-section">
                <div className="section-title"><span>Lineage scan</span><b>{state.lineageEdgeIds.size} routes</b></div>
                <div className="segmented">
                  {(["upstream", "both", "downstream"] as const).map((value) => (
                    <button
                      key={value}
                      className={state.lineageDirection === value ? "active" : ""}
                      onClick={() => state.setLineageDirection(value)}
                    >
                      {value === "upstream" ? "↑ Up" : value === "downstream" ? "↓ Down" : "↕ Both"}
                    </button>
                  ))}
                </div>
                <label className="depth-control">
                  <span>Depth</span>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    value={state.lineageDepth}
                    onChange={(event) => state.setLineageDepth(Number(event.target.value))}
                  />
                  <b>{state.lineageDepth}</b>
                </label>
                <button className="primary full" onClick={showLineage}>Illuminate lineage</button>
              </section>
              <section className="control-section">
                <div className="section-title"><span>Route planner</span></div>
                <div className="route-endpoints">
                  <p><i>A</i><span>{state.graph.nodesById.get(state.sourceNodeId ?? "")?.qualifiedName ?? "Choose source"}</span></p>
                  <p><i>B</i><span>{state.graph.nodesById.get(state.destinationNodeId ?? "")?.qualifiedName ?? "Choose destination"}</span></p>
                </div>
                <select
                  aria-label="Path mode"
                  value={state.pathMode}
                  onChange={(event) => state.setPathMode(event.target.value as typeof state.pathMode)}
                >
                  <option value="any">Fewest hops · any route</option>
                  <option value="etl">ETL transfers only</option>
                  <option value="view">View dependencies only</option>
                </select>
                <button className="primary full" onClick={runPathfinding}>Calculate route</button>
                {state.pathMessage && <p className={state.activePath ? "success-message" : "warning-message"}>{state.pathMessage}</p>}
                {state.activePath && (
                  <ol className="path-list">
                    {state.activePath.nodeIds.map((id, index) => (
                      <li key={id}>
                        <button onClick={() => sceneBridge()?.focusNode(id)}>
                          <b>{String(index + 1).padStart(2, "0")}</b>
                          {state.graph?.nodesById.get(id)?.qualifiedName}
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
                <button
                  className="journey-button full"
                  disabled={!state.activePath || state.activePath.edgeIds.length === 0}
                  onClick={state.startJourney}
                >
                  ▶ Begin journey
                </button>
              </section>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
