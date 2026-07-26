/// <reference lib="webworker" />
import { normalizeGraph } from "../domain/graph";
import type { UniverseDocument } from "../domain/types";
import { calculateLayout } from "../layout/layout";

interface LayoutRequest {
  document: UniverseDocument;
  seed: number;
}

self.onmessage = (event: MessageEvent<LayoutRequest>) => {
  const graph = normalizeGraph(event.data.document);
  const result = calculateLayout(graph, event.data.seed);
  self.postMessage(result);
};
