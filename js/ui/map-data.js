// Loads the map data modules (calibration, categories, markers, guide mapping) and builds lookups.
import { COLORS } from "./map-glyphs.js";
import { ICONS } from "../data/map-icons.js";
import { byTrophy, byCollectible, byGoal } from "../lib/model.js";

// Mohgwyn Palace markers are filed under the Siofra region but share its sub-map transform.
const SUB = { mohgwyn: "siofra" };

export async function loadMapData() {
  const [a, b, c, guide] = await Promise.all([
    import("../data/map-calib.js"), import("../data/map-categories.js"), import("../data/map-markers.js"),
    import("../data/map-guide.js").catch(() => ({})),
  ]);
  const { CALIB: calib, project } = a;
  const { GROUPS: groups, CATS: cats } = b;
  const rows = (await Promise.all(Object.keys(c.MARKER_FILES).map((l) => c.loadMarkers(l)))).flat();
  // Ids are numbers in the data files; the DOM hands them back as strings, so everything is keyed by string.
  const catById = new Map(cats.map((c) => { const ic = ICONS[c.id]; return [String(c.id), { ...c, id: String(c.id), glyph: ic?.[0] ?? c.glyph, color: ic?.[1] ?? c.color ?? COLORS[c.glyph] ?? COLORS.misc }]; }));
  const list = [];
  const byId = new Map();
  const byLayer = { base: [], under: [], hub: [], dlc: [] };
  for (const [id, cat, lat, lng, title, layer, sub, note, wiki] of rows) {
    const c = catById.get(String(cat));
    if (!c || !byLayer[layer] || !calib[layer]) continue;
    const [x, y] = project(layer, SUB[sub] || sub || "_", lat, lng);
    // Markers that project outside the image (for example Roundtable Hold) are never drawn.
    if (!(x >= 0 && y >= 0 && x <= calib[layer].w && y <= calib[layer].h)) continue;
    const m = { id: String(id), cat: String(cat), title, layer, sub, note, wiki, x, y, glyph: c.glyph, color: c.color };
    list.push(m);
    byId.set(m.id, m);
    byLayer[layer].push(m);
  }
  // Which route steps cover which markers. STEP_LOCS is the main table; trophies, legendary items and DLC goals
  // are linked through the step that completes them, so ticking that step marks its markers done on the map.
  const stepLocs = {};
  const link = (step, ids) => { const l = (stepLocs[step] ||= []); for (const i of ids.map(String)) if (!l.includes(i)) l.push(i); };
  for (const [step, locs] of Object.entries(guide.STEP_LOCS || {})) link(step, locs);
  for (const [k, locs] of Object.entries(guide.TROPHY_LOCS || {})) if (byTrophy[k] && locs.length === 1) link(byTrophy[k].id, locs);
  for (const [k, loc] of Object.entries(guide.COLLECT_LOCS || {})) if (byCollectible[k]) link(byCollectible[k].id, [loc]);
  for (const [k, locs] of Object.entries(guide.GOAL_LOCS || {})) if (byGoal[k]) link(byGoal[k].id, locs);
  const stepsOf = new Map();
  for (const [step, locs] of Object.entries(stepLocs)) for (const l of locs) (stepsOf.get(l) || stepsOf.set(l, []).get(l)).push(step);
  return { calib, groups, cats: [...catById.values()], catById, list, byId, byLayer, stepsOf, stepLocs, focus: Object.fromEntries(Object.entries(guide.PHASE_FOCUS || {}).map(([k, v]) => [k, String(v)])) };
}
