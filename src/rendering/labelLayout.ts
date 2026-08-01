import type { AppMode, QualityPreset } from "../app/store";

export type SceneLabelKind = "galaxy" | "node";

export interface ScreenLabelCandidate {
  id: string;
  kind: SceneLabelKind;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  priority: number;
  pinned: boolean;
}

export interface LabelViewport {
  width: number;
  height: number;
}

const LABEL_BUDGETS: Record<AppMode, Record<QualityPreset, number>> = {
  Universe: { Low: 26, Medium: 38, High: 50 },
  Galaxy: { Low: 18, Medium: 32, High: 44 },
  Focus: { Low: 14, Medium: 28, High: 38 },
  Journey: { Low: 8, Medium: 14, High: 20 }
};

export const MAX_SCENE_LABELS = 50;

export function labelBudget(mode: AppMode, quality: QualityPreset): number {
  return LABEL_BUDGETS[mode][quality];
}

export function truncateLabel(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

export function estimateLabelWidth(text: string, kind: SceneLabelKind): number {
  const maximum = kind === "galaxy" ? 286 : 250;
  const minimum = kind === "galaxy" ? 108 : 82;
  const perCharacter = kind === "galaxy" ? 8.1 : 7.4;
  return Math.min(maximum, Math.max(minimum, 30 + text.length * perCharacter));
}

function overlaps(a: ScreenLabelCandidate, b: ScreenLabelCandidate, padding: number): boolean {
  return !(
    a.x + a.width / 2 + padding <= b.x - b.width / 2 ||
    a.x - a.width / 2 - padding >= b.x + b.width / 2 ||
    a.y + a.height / 2 + padding <= b.y - b.height / 2 ||
    a.y - a.height / 2 - padding >= b.y + b.height / 2
  );
}

function isOnScreen(candidate: ScreenLabelCandidate, viewport: LabelViewport): boolean {
  return (
    Number.isFinite(candidate.x) &&
    Number.isFinite(candidate.y) &&
    Number.isFinite(candidate.depth) &&
    candidate.depth >= 0 &&
    candidate.depth <= 1 &&
    candidate.x + candidate.width / 2 >= 0 &&
    candidate.x - candidate.width / 2 <= viewport.width &&
    candidate.y + candidate.height / 2 >= 0 &&
    candidate.y - candidate.height / 2 <= viewport.height
  );
}

/**
 * Selects a deterministic, bounded set of labels in screen space. Pinned labels
 * (selection and hover) survive collisions; optional labels yield to higher-priority labels.
 */
export function selectNonOverlappingLabels<T extends ScreenLabelCandidate>(
  candidates: readonly T[],
  viewport: LabelViewport,
  maximum: number,
  padding = 5
): T[] {
  const ordered = candidates
    .filter((candidate) => isOnScreen(candidate, viewport))
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        b.priority - a.priority ||
        a.depth - b.depth ||
        a.id.localeCompare(b.id)
    );
  const accepted: T[] = [];
  for (const candidate of ordered) {
    if (accepted.length >= maximum) break;
    if (!candidate.pinned && accepted.some((label) => overlaps(candidate, label, padding))) continue;
    accepted.push(candidate);
  }
  return accepted;
}
