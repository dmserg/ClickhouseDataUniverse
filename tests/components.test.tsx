import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { normalizeGraph } from "../src/domain/graph";
import { DEFAULT_FILTERS } from "../src/domain/filters";
import { useAppStore } from "../src/app/store";
import { fixtureDocument } from "../src/testing/fixture";
import { SearchBox } from "../src/ui/SearchBox";
import { DetailsPanel } from "../src/ui/DetailsPanel";
import { JourneyHud } from "../src/ui/JourneyHud";

describe("search UI", () => {
  beforeEach(() => {
    useAppStore.setState({
      graph: normalizeGraph(fixtureDocument()),
      filters: DEFAULT_FILTERS,
      selectedNodeId: null
    });
  });

  it("shows results and selects an object", () => {
    render(<SearchBox />);
    fireEvent.change(screen.getByLabelText("Search objects"), { target: { value: "b.target" } });
    fireEvent.click(screen.getByText("b.target"));
    expect(useAppStore.getState().selectedNodeId).toBe("c");
  });

  it("calculates a route from selected endpoints", () => {
    useAppStore.setState({
      selectedNodeId: "c",
      sourceNodeId: "a",
      destinationNodeId: "c",
      activePath: null,
      pathMessage: null
    });
    render(<DetailsPanel collapsed={false} onToggle={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Calculate route" }));
    expect(screen.getByText("2 hop route locked.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "▶ Begin journey" })).toBeEnabled();
  });

  it("shows journey context and exits immediately with Escape", () => {
    useAppStore.setState({
      selectedNodeId: "c",
      mode: "Journey",
      activePath: { nodeIds: ["a", "b", "c"], edgeIds: ["ab", "bc"] },
      journey: { playing: false, speed: 1, segment: 0, progress: 0 }
    });
    render(<JourneyHud />);
    const hud = screen.getByRole("region", { name: "Journey controls" });
    expect(within(hud).getByText("a.source")).toBeInTheDocument();
    expect(within(hud).getByText(/a\.middle/)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useAppStore.getState().mode).toBe("Focus");
    expect(useAppStore.getState().journey.playing).toBe(false);
  });
});
