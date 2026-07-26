import type { DomainGraph } from "../domain/types";
import { calculateLayout } from "./layout";
import type { LayoutResult } from "./types";

export function runLayout(graph: DomainGraph): Promise<LayoutResult> {
  if (typeof Worker === "undefined") {
    return Promise.resolve(calculateLayout(graph, graph.document.universe.layoutSeed));
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/layout.worker.ts", import.meta.url), {
      type: "module"
    });
    worker.onmessage = (event: MessageEvent<LayoutResult>) => {
      resolve(event.data);
      worker.terminate();
    };
    worker.onerror = (event) => {
      reject(new Error(event.message || "Layout worker failed"));
      worker.terminate();
    };
    worker.postMessage({
      document: graph.document,
      seed: graph.document.universe.layoutSeed
    });
  });
}
