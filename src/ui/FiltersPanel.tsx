import { EDGE_TYPES, NODE_KINDS, type EdgeType, type FilterState, type NodeKind } from "../domain/types";
import { useAppStore } from "../app/store";

function toggle<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function CheckGroup<T extends string>({
  label,
  options,
  values,
  onChange
}: {
  label: string;
  options: readonly T[];
  values: T[];
  onChange: (values: T[]) => void;
}) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <div className="check-grid">
        {options.map((option) => (
          <label key={option}>
            <input
              type="checkbox"
              checked={values.includes(option)}
              onChange={() => onChange(toggle(values, option))}
            />
            <span>{option.replaceAll("_", " ")}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function FiltersPanel({ collapsed, onToggle }: { collapsed: boolean; onToggle(): void }) {
  const graph = useAppStore((state) => state.graph);
  const filters = useAppStore((state) => state.filters);
  const setFilters = useAppStore((state) => state.setFilters);
  const reset = useAppStore((state) => state.resetFilters);
  if (!graph) return null;
  const patch = (value: Partial<FilterState>) => setFilters({ ...filters, ...value });
  const schemas = [...graph.schemasById.values()];
  const engines = [
    ...new Set([...graph.nodesById.values()].map((node) => node.table?.engineFamily ?? "Unknown"))
  ].sort();
  const owners = [
    ...new Set([...graph.nodesById.values()].map((node) => node.owner ?? "Unknown"))
  ].sort();
  const tags = [
    ...new Set([...graph.nodesById.values()].flatMap((node) => node.tags ?? []))
  ].sort();
  const activeCount = Object.entries(filters).filter(([, value]) =>
    Array.isArray(value) ? value.length > 0 : value !== null && value !== false
  ).length;

  return (
    <aside className={`panel filters-panel ${collapsed ? "collapsed" : ""}`}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">SIGNAL CONTROL</span>
          <h2>Filters {activeCount > 0 && <b className="count-chip">{activeCount}</b>}</h2>
        </div>
        <button className="icon-button" onClick={onToggle} aria-label="Toggle filter panel">
          {collapsed ? "›" : "‹"}
        </button>
      </div>
      {!collapsed && (
        <div className="panel-scroll">
          <button className="secondary full" onClick={reset}>Reset filters</button>
          <CheckGroup
            label="Schema"
            options={schemas.map((schema) => schema.id)}
            values={filters.schemaIds}
            onChange={(schemaIds) => patch({ schemaIds })}
          />
          <CheckGroup<NodeKind>
            label="Object kind"
            options={NODE_KINDS}
            values={filters.kinds}
            onChange={(kinds) => patch({ kinds })}
          />
          <CheckGroup
            label="Engine family"
            options={engines}
            values={filters.engineFamilies}
            onChange={(engineFamilies) => patch({ engineFamilies })}
          />
          <CheckGroup<EdgeType>
            label="Route type"
            options={EDGE_TYPES}
            values={filters.edgeTypes}
            onChange={(edgeTypes) => patch({ edgeTypes })}
          />
          <fieldset>
            <legend>Compressed size (GiB)</legend>
            <div className="range-row">
              <input
                aria-label="Minimum size in GiB"
                type="number"
                min="0"
                placeholder="Min"
                value={filters.minBytes === null ? "" : filters.minBytes / 1073741824}
                onChange={(event) =>
                  patch({
                    minBytes: event.target.value ? Number(event.target.value) * 1073741824 : null
                  })
                }
              />
              <span>—</span>
              <input
                aria-label="Maximum size in GiB"
                type="number"
                min="0"
                placeholder="Max"
                value={filters.maxBytes === null ? "" : filters.maxBytes / 1073741824}
                onChange={(event) =>
                  patch({
                    maxBytes: event.target.value ? Number(event.target.value) * 1073741824 : null
                  })
                }
              />
            </div>
          </fieldset>
          <CheckGroup
            label="Owner"
            options={owners}
            values={filters.owners}
            onChange={(owners) => patch({ owners })}
          />
          <CheckGroup
            label="Tags"
            options={tags.slice(0, 12)}
            values={filters.tags}
            onChange={(value) => patch({ tags: value })}
          />
          <label className="switch-row">
            <input
              type="checkbox"
              checked={filters.hideIsolated}
              onChange={(event) => patch({ hideIsolated: event.target.checked })}
            />
            <span>Hide isolated objects</span>
          </label>
          <fieldset className="legend">
            <legend>Navigation legend</legend>
            <p><i className="legend-star" /> Table · sized star</p>
            <p><i className="legend-planet" /> View · planet</p>
            <p><i className="legend-station" /> Materialized view · station</p>
            <p><i className="legend-portal" /> Distributed · portal</p>
            <p><i className="legend-route etl" /> ETL cargo route</p>
            <p><i className="legend-route dependency" /> Dependency route</p>
          </fieldset>
        </div>
      )}
    </aside>
  );
}
