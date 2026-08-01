import { describe, expect, it } from "vitest";
import {
  labelBudget,
  MAX_SCENE_LABELS,
  selectNonOverlappingLabels,
  truncateLabel,
  type ScreenLabelCandidate
} from "../src/rendering/labelLayout";

function candidate(
  id: string,
  x: number,
  priority: number,
  pinned = false
): ScreenLabelCandidate {
  return {
    id,
    kind: "node",
    text: id,
    x,
    y: 80,
    width: 80,
    height: 24,
    depth: 0.5,
    priority,
    pinned
  };
}

describe("semantic scene labels", () => {
  it("uses bounded budgets that respond to mode and quality", () => {
    expect(labelBudget("Universe", "Low")).toBeLessThan(labelBudget("Universe", "High"));
    expect(labelBudget("Journey", "Medium")).toBeLessThan(labelBudget("Galaxy", "Medium"));
    expect(labelBudget("Universe", "High")).toBe(MAX_SCENE_LABELS);
  });

  it("keeps the highest-priority label and suppresses optional overlaps", () => {
    const selected = selectNonOverlappingLabels(
      [candidate("lower", 100, 10), candidate("higher", 105, 20), candidate("separate", 240, 5)],
      { width: 400, height: 200 },
      10
    );
    expect(selected.map((label) => label.id)).toEqual(["higher", "separate"]);
  });

  it("keeps pinned hover and selection labels even when they overlap", () => {
    const selected = selectNonOverlappingLabels(
      [candidate("selected", 100, 100, true), candidate("hovered", 102, 90, true)],
      { width: 400, height: 200 },
      10
    );
    expect(selected.map((label) => label.id)).toEqual(["selected", "hovered"]);
  });

  it("rejects off-screen labels and respects the hard result limit", () => {
    const selected = selectNonOverlappingLabels(
      [candidate("offscreen", -200, 100), candidate("a", 80, 10), candidate("b", 220, 9)],
      { width: 400, height: 200 },
      1
    );
    expect(selected.map((label) => label.id)).toEqual(["a"]);
  });

  it("shortens long database object names without changing short names", () => {
    expect(truncateLabel("events", 12)).toBe("events");
    expect(truncateLabel("a_very_long_object_name", 12)).toBe("a_very_long…");
  });
});
