import type { AppMode } from "../app/store";

export interface SceneBridge {
  focusNode(id: string): void;
  focusGalaxy(id: string): void;
  setMode(mode: AppMode): void;
  jumpJourneySegment(segment: number, progress?: number): void;
}

let active: SceneBridge | null = null;
export function registerSceneBridge(bridge: SceneBridge | null) {
  active = bridge;
}
export function sceneBridge() {
  return active;
}
