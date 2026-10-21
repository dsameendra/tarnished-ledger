import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATS, GROUPS, GLYPHS, DEFAULT_VISIBLE } from "../js/data/map-categories.js";
import { MARKER_COUNTS } from "../js/data/map-markers.js";
import { STEP_LOCS, PHASE_FOCUS } from "../js/data/map-guide.js";
import { PHASES } from "../js/data/route.js";
import { DLC_PHASES } from "../js/data/dlc-route.js";

const load = (l) => JSON.parse(readFileSync(new URL(`../assets/map/data/${l}.json`, import.meta.url), "utf8"));
const data = { base: load("base"), under: load("under"), hub: load("hub"), dlc: load("dlc") };
const all = Object.values(data).flat();
const catIds = new Set(CATS.map((k) => k.id));

test("categories are well formed", () => {
  assert.equal(catIds.size, CATS.length, "duplicate category id");
  const groups = new Set(GROUPS.map((g) => g.id));
  for (const k of CATS) {
    assert.ok(groups.has(k.group), `${k.id} group`);
    assert.ok(GLYPHS.includes(k.glyph), `${k.id} glyph ${k.glyph}`);
    assert.ok(k.title, `${k.id} title`);
    assert.equal(typeof k.guide, "boolean");
  }
  assert.ok(DEFAULT_VISIBLE.length > 5 && DEFAULT_VISIBLE.length < CATS.length);
});

test("markers: counts, unique ids, known categories, no empty titles", () => {
  for (const [l, rows] of Object.entries(data)) assert.equal(rows.length, MARKER_COUNTS[l]);
  assert.equal(new Set(all.map((r) => r[0])).size, all.length, "duplicate marker ids");
  for (const r of all) {
    assert.ok(catIds.has(r[1]), `marker ${r[0]} category ${r[1]}`);
    assert.ok(typeof r[4] === "string" && r[4].trim(), `marker ${r[0]} title`);
    if (r[7]) assert.ok(r[7].length <= 160, `marker ${r[0]} note length`);
  }
});

test("markers: coordinates, layers and sub-maps", () => {
  const SUB = ["_", "ainsel", "siofra", "mohgwyn", "deeproot"];
  for (const [layer, rows] of Object.entries(data)) {
    for (const r of rows) {
      assert.equal(r[5], layer);
      assert.ok(SUB.includes(r[6]), `marker ${r[0]} sub ${r[6]}`);
      assert.equal(r[6] === "_", layer !== "under", `marker ${r[0]} sub/layer`);
      const [lat, lng] = [r[2], r[3]];
      assert.ok(lat > 0.26 && lat < 0.92 && lng > -1.13 && lng < -0.5, `marker ${r[0]} out of range ${lat},${lng}`);
      if (layer === "dlc") assert.ok(lat > 0.57 && lat < 0.75 && lng > -0.77 && lng < -0.63, `dlc marker ${r[0]} range`);
      if (layer === "under") assert.ok(lat < 0.45, `under marker ${r[0]} lat`);
      assert.equal(Math.round(lat * 1e6) / 1e6, lat);
    }
  }
});

test("no exact duplicate markers", () => {
  const seen = new Set();
  for (const r of all) {
    const k = [r[1], r[4], r[2], r[3], r[5]].join("|");
    assert.ok(!seen.has(k), `duplicate ${k}`);
    seen.add(k);
  }
});

test("every legendary item exists once in its route category", () => {
  for (const [cat, n] of [[90001, 9], [90002, 6], [90003, 7], [90004, 8]]) assert.equal(all.filter((r) => r[1] === cat).length, n, `category ${cat}`);
});

test("guide links point at existing markers and cover every phase", () => {
  const ids = new Set(all.map((r) => r[0]));
  for (const v of Object.values(STEP_LOCS).flat()) assert.ok(ids.has(v), `STEP_LOCS ${v}`);
  for (const p of [...PHASES, ...DLC_PHASES]) {
    assert.ok(ids.has(PHASE_FOCUS[p.id]), `phase ${p.id} focus`);
    p.s.forEach((_, i) => { const k = `${p.id}.${i}`; if (STEP_LOCS[k]) assert.ok(STEP_LOCS[k].length > 0); });
  }
  for (const k of Object.keys(STEP_LOCS)) assert.ok(PHASES.concat(DLC_PHASES).some((p) => k.startsWith(p.id + ".")), k);
});

test("transferred size stays small", () => {
  const bytes = all.reduce((n, r) => n + JSON.stringify(r).length, 0);
  assert.ok(bytes < 1_500_000);
});

test("every map category has its own icon: a known glyph and a unique glyph + colour pair", async () => {
  const { CATS } = await import("../js/data/map-categories.js");
  const { ICONS } = await import("../js/data/map-icons.js");
  const { GLYPHS } = await import("../js/ui/map-glyphs.js");
  const seen = new Map();
  for (const c of CATS) {
    const ic = ICONS[c.id];
    assert.ok(ic, `category ${c.id} (${c.title}) has no icon`);
    assert.ok(GLYPHS.includes(ic[0]), `${c.title}: unknown glyph ${ic[0]}`);
    assert.match(ic[1], /^#[0-9a-f]{6}$/i, `${c.title}: bad colour`);
    const key = ic.join("|").toLowerCase();
    assert.ok(!seen.has(key), `${c.title} and ${seen.get(key)} share the same icon`);
    seen.set(key, c.title);
  }
  for (const id of Object.keys(ICONS)) assert.ok(CATS.some((c) => String(c.id) === id), `icon for unknown category ${id}`);
});

test("map wording: every category has a verb, and bosses say defeated while items say picked up", async () => {
  const { verbFor, VERBS } = await import("../js/data/map-verbs.js");
  for (const c of CATS) assert.ok(Object.values(VERBS).includes(verbFor(c)), `${c.title} has no verb`);
  const by = (t) => CATS.find((c) => c.title === t);
  assert.equal(verbFor(by("Boss")).done, "Defeated");
  assert.equal(verbFor(by("Great Boss")).done, "Defeated");
  assert.equal(verbFor(by("Weapon")).done, "Picked up");
  assert.equal(verbFor(by("Map Fragment")).done, "Picked up");
  assert.equal(verbFor(by("Site of Grace")).done, "Discovered");
  assert.equal(verbFor(by("Legacy Dungeon")).done, "Cleared");
  assert.equal(verbFor(by("Merchant")).done, "Met");
});

test("progress: a marker counts as done from its own tick or from a covering route step", async () => {
  const { markerDone, summarize, layersFor } = await import("../js/ui/map-progress.js");
  const D = {
    stepsOf: new Map([["2", ["a.1"]]]),
    byLayer: { base: [{ id: "1", cat: "9", title: "B", layer: "base" }, { id: "2", cat: "9", title: "A", layer: "base" }, { id: "3", cat: "9", title: "C", layer: "base" }], under: [], dlc: [{ id: "4", cat: "9", title: "D", layer: "dlc" }] },
  };
  const found = new Set(["1"]), steps = new Set(["a.1"]);
  const isDone = (m) => markerDone(D, m.id, (id) => found.has(id), (s) => steps.has(s));
  assert.equal(isDone({ id: "1" }), true);
  assert.equal(isDone({ id: "2" }), true);
  assert.equal(isDone({ id: "3" }), false);
  const s = summarize(D, isDone, layersFor("base"), ["9"]);
  assert.equal(s.total, 3);
  assert.equal(s.done, 2);
  assert.deepEqual(s.cats.get("9").todo.map((m) => m.title), ["C"]);
  assert.equal(summarize(D, isDone, layersFor("both"), ["9"]).total, 4);
  assert.equal(summarize(D, isDone, layersFor("dlc"), ["9"]).total, 1);
});

test("map links: trophies, legendaries and goals also cover their markers through their route step", async () => {
  const { byTrophy, byCollectible, byGoal } = await import("../js/lib/model.js");
  const { TROPHY_LOCS, COLLECT_LOCS, GOAL_LOCS, STEP_LOCS } = await import("../js/data/map-guide.js");
  for (const [k, locs] of Object.entries(TROPHY_LOCS)) if (byTrophy[k] && locs.length === 1) assert.ok((STEP_LOCS[byTrophy[k].id] || []).map(String).includes(String(locs[0])), `trophy ${k}`);
  for (const [k, loc] of Object.entries(COLLECT_LOCS)) assert.ok((STEP_LOCS[byCollectible[k].id] || []).map(String).includes(String(loc)), `collectible ${k}`);
  for (const [k, locs] of Object.entries(GOAL_LOCS)) for (const l of locs) assert.ok((STEP_LOCS[byGoal[k].id] || []).map(String).includes(String(l)), `goal ${k}`);
});

test("route path: stops follow step order, merge stacked markers, skip collections and break at layer changes", async () => {
  const { buildRoute, phaseStarts, stopStates } = await import("../js/ui/map-route.js");
  const mk = (id, x, y, layer = "base") => ({ id: String(id), x, y, layer });
  const byId = new Map([mk(1, 100, 100), mk(2, 102, 101), mk(3, 400, 100), mk(4, 700, 100), mk(5, 100, 900), mk(6, 900, 900), mk(7, 50, 50, "under"), mk(8, 55, 55, "under")].map((m) => [m.id, m]));
  const D = { byId, stepLocs: { "a.0": ["1", "2"], "a.1": ["3"], "a.2": ["5", "6", "4", "3"], "a.3": ["7", "8"], "b.0": ["4"], "a.tip": ["1"] } };
  const phases = [{ id: "a" }, { id: "b" }];
  const steps = [{ id: "a.0", kind: "go", pi: 0 }, { id: "a.1", kind: "boss", pi: 0 }, { id: "a.2", kind: "item", pi: 0 }, { id: "a.3", kind: "go", pi: 0 }, { id: "a.tip", kind: "tip", pi: 0 }, { id: "b.0", kind: "boss", pi: 1 }];
  const r = buildRoute(D, phases, steps, (p) => (p.id === "a" ? 0 : 1));
  // a.0 merges markers 1 and 2 into one stop, a.1 is a second stop, a.2 is a spread-out collection (skipped), a.3 moves to another layer
  assert.deepEqual(r.stops.map((s) => s.markers.map((m) => m.id).join("+")), ["1+2", "3", "7+8", "4"]);
  assert.equal(r.stops[0].steps.length, 1);
  assert.equal(r.stops.length, 4);
  assert.equal(r.legs.length, 1, "one leg on the surface, then the line breaks for the underground and again back to the surface");
  assert.equal(r.breaks.length, 2);
  assert.equal(phaseStarts(r).get("b").markers[0].id, "4");
  const st = stopStates(r, (id) => id === "a.0");
  assert.deepEqual(st.done, [true, false, false, false]);
  assert.equal(st.next, 1);
});

test("route path: a vague 'head toward X' step in PATH_SKIP is not a stop, so the path goes straight to the boss", async () => {
  const { buildRoute } = await import("../js/ui/map-route.js");
  const mk = (id, x, y) => ({ id: String(id), x, y, layer: "base" });
  const byId = new Map([mk(1, 600, 1500), mk(2, 500, 1450), mk(3, 540, 1470), mk(4, 520, 1465)].map((m) => [m.id, m]));
  const D = { byId, pathSkip: new Set(["p.1"]), stepLocs: { "p.0": ["1"], "p.1": ["2"], "p.2": ["3"], "p.3": ["4"] } };
  const steps = ["p.0", "p.1", "p.2", "p.3"].map((id) => ({ id, kind: "go", pi: 0 }));
  const r = buildRoute(D, [{ id: "p" }], steps, () => 0);
  assert.deepEqual(r.stops.map((s) => s.markers[0].id), ["1", "3", "4"]);
  assert.ok(D.pathSkip.size === 1);
});

test("PATH_SKIP and the twin steps only name real steps", async () => {
  const { PATH_SKIP } = await import("../js/data/map-guide.js");
  const { TWINS } = await import("../js/data/twins.js");
  const { steps } = await import("../js/lib/model.js");
  const ids = new Set(steps.map((s) => s.id));
  for (const id of PATH_SKIP) assert.ok(ids.has(id), "PATH_SKIP " + id);
  for (const g of TWINS) for (const id of g) assert.ok(ids.has(id), "TWINS " + id);
});
