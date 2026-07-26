import { useMemo, useState } from "react";
import { searchNodes } from "../domain/algorithms";
import { useAppStore } from "../app/store";
import { sceneBridge } from "../rendering/sceneBridge";

export function SearchBox() {
  const [query, setQuery] = useState("");
  const graph = useAppStore((state) => state.graph);
  const selectNode = useAppStore((state) => state.selectNode);
  const results = useMemo(() => (graph ? searchNodes(graph, query) : []), [graph, query]);
  return (
    <div className="search-shell">
      <span className="search-icon">⌕</span>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Find object, owner, or tag"
        aria-label="Search objects"
      />
      {query && (
        <button className="clear-search" onClick={() => setQuery("")} aria-label="Clear search">×</button>
      )}
      {query && (
        <div className="search-results">
          {results.length === 0 && <p>No signals found.</p>}
          {results.map((node) => (
            <button
              key={node.id}
              onClick={() => {
                selectNode(node.id);
                setQuery("");
                queueMicrotask(() => sceneBridge()?.focusNode(node.id));
              }}
            >
              <span className={`kind-dot ${node.kind}`} />
              <span>
                <strong>{node.qualifiedName}</strong>
                <small>{node.kind.replaceAll("_", " ")} · {node.table?.engineFamily ?? "virtual"}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
