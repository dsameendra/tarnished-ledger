// Turns the route steps and their linked markers into a walkable path: ordered stops, and the legs between them.
// Pure (no DOM), so it is unit tested. A step contributes the markers it is linked to, in visiting order.

const SKIP_KINDS = new Set(["tip", "warn"]);
const MERGE_PX = 14; // stops closer than this are one place (a grace and the NPC standing at it)
const SPREAD_PX = 260; // a step with more than three markers is a path only if they are all close together

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Visit the markers of one step nearest-first, starting from where the player is.
function order(list, from) {
  if (!from || list.length < 2) return list.slice();
  const left = list.slice(), out = [];
  let at = from;
  while (left.length) {
    let bi = 0;
    for (let i = 1; i < left.length; i++) if (dist(left[i], at) < dist(left[bi], at)) bi = i;
    at = left.splice(bi, 1)[0];
    out.push(at);
  }
  return out;
}

const spread = (list) => Math.max(0, ...list.flatMap((a, i) => list.slice(i + 1).filter((b) => a.layer === b.layer).map((b) => dist(a, b))));

// phases: the phases of one world in route order. steps: all steps ({id, kind, pi}). D: { byId, stepLocs, pathSkip? }.
export function buildRoute(D, phases, steps, phaseIndex) {
  const stops = [];
  let prev = null;
  for (const p of phases) {
    const pi = phaseIndex(p);
    let seq = 0;
    for (const s of steps) {
      if (s.pi !== pi || SKIP_KINDS.has(s.kind) || D.pathSkip?.has(s.id)) continue;
      let ms = (D.stepLocs[s.id] || []).map((id) => D.byId.get(String(id))).filter(Boolean);
      if (!ms.length) continue;
      // One layer per step: stay where the player is, otherwise follow the first marker.
      const layer = prev && ms.some((m) => m.layer === prev.layer) ? prev.layer : ms[0].layer;
      ms = ms.filter((m) => m.layer === layer);
      if (ms.length > 3 && spread(ms) > SPREAD_PX) continue; // a collection step, not a leg of the route
      for (const m of order(ms, prev && prev.layer === layer ? prev : null)) {
        if (prev && prev.layer === m.layer && (prev.markers.some((x) => x.id === m.id) || dist(prev, m) < MERGE_PX)) {
          if (!prev.markers.some((x) => x.id === m.id)) prev.markers.push(m);
          if (!prev.steps.includes(s.id)) prev.steps.push(s.id);
          continue;
        }
        prev = { x: m.x, y: m.y, layer: m.layer, markers: [m], steps: [s.id], phase: p.id, pi, seq: ++seq, i: stops.length };
        stops.push(prev);
      }
    }
  }
  // Legs join neighbouring stops on the same layer. A change of layer ends the line (it cannot cross images).
  const legs = [], breaks = [];
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1], b = stops[i];
    if (a.layer === b.layer) legs.push({ a, b, i });
    else breaks.push({ from: a, to: b, i });
  }
  return { stops, legs, breaks };
}

// Where each phase starts: its first stop.
export function phaseStarts(route) {
  const out = new Map();
  for (const s of route.stops) if (!out.has(s.phase)) out.set(s.phase, s);
  return out;
}

// State of each stop: a stop is done when every step that visits it is done. The first stop that is not done is "next".
export function stopStates(route, isStepDone) {
  const done = route.stops.map((s) => s.steps.every(isStepDone));
  const next = done.indexOf(false);
  return { done, next };
}
