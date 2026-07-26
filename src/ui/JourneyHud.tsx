import { useEffect } from "react";
import { useAppStore } from "../app/store";
import { sceneBridge } from "../rendering/sceneBridge";

export function JourneyHud() {
  const mode = useAppStore((state) => state.mode);
  const graph = useAppStore((state) => state.graph);
  const path = useAppStore((state) => state.activePath);
  const journey = useAppStore((state) => state.journey);
  const update = useAppStore((state) => state.updateJourney);
  const exit = useAppStore((state) => state.exitJourney);

  useEffect(() => {
    if (mode !== "Journey" || !path) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (time: number) => {
      const currentState = useAppStore.getState();
      if (currentState.mode !== "Journey" || !currentState.journey.playing) {
        previous = time;
        frame = requestAnimationFrame(tick);
        return;
      }
      const delta = Math.min(100, time - previous);
      previous = time;
      let progress =
        currentState.journey.progress + (delta / 5000) * currentState.journey.speed;
      let segment = currentState.journey.segment;
      if (progress >= 1) {
        progress = 0;
        segment += 1;
        if (segment >= path.edgeIds.length) {
          segment = Math.max(0, path.edgeIds.length - 1);
          progress = 1;
          update({ playing: false, segment, progress });
          sceneBridge()?.jumpJourneySegment(segment, progress);
          return;
        }
      }
      update({ segment, progress });
      sceneBridge()?.jumpJourneySegment(segment, progress);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mode, path, update]);

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape" && useAppStore.getState().mode === "Journey") {
        useAppStore.getState().exitJourney();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);

  if (mode !== "Journey" || !graph || !path) return null;
  const currentId = path.nodeIds[journey.segment];
  const nextId = path.nodeIds[Math.min(path.nodeIds.length - 1, journey.segment + 1)];
  const current = graph.nodesById.get(currentId ?? "");
  const next = graph.nodesById.get(nextId ?? "");
  const move = (delta: number) => {
    const segment = Math.max(0, Math.min(path.edgeIds.length - 1, journey.segment + delta));
    update({ segment, progress: 0 });
    sceneBridge()?.jumpJourneySegment(segment, 0);
  };
  return (
    <div className="journey-hud" role="region" aria-label="Journey controls">
      <div className="hud-corners" />
      <div className="journey-status">
        <span className="eyebrow">AUTOPILOT · SEGMENT {journey.segment + 1}/{path.edgeIds.length}</span>
        <strong>{current?.qualifiedName}</strong>
        <small>NEXT VECTOR · {next?.qualifiedName}</small>
      </div>
      <div className="journey-progress">
        <div><span style={{ width: `${journey.progress * 100}%` }} /></div>
        <b>{Math.round(journey.progress * 100)}%</b>
      </div>
      <div className="journey-controls">
        <button onClick={() => move(-1)} aria-label="Previous segment">|◀</button>
        <button className="play" onClick={() => update({ playing: !journey.playing })}>
          {journey.playing ? "Ⅱ" : "▶"}
        </button>
        <button onClick={() => move(1)} aria-label="Next segment">▶|</button>
        <label>
          <span>Warp</span>
          <select value={journey.speed} onChange={(event) => update({ speed: Number(event.target.value) })}>
            <option value="0.5">0.5×</option>
            <option value="1">1×</option>
            <option value="2">2×</option>
            <option value="4">4×</option>
          </select>
        </label>
        <button className="exit-journey" onClick={exit}>Exit · Esc</button>
      </div>
    </div>
  );
}
