// Sanity checks for the route data. Run with `npm run check`.
import { PHASES } from "../js/data/route.js";
import { DLC_PHASES } from "../js/data/dlc-route.js";
import { GOALS, COUNTERS } from "../js/data/dlc-goals.js";
import { TROPHIES, COLLECTIONS } from "../js/data/trophies.js";
import { readFileSync } from "node:fs";
import { CATS } from "../js/data/map-categories.js";
import { STEP_LOCS, PHASE_FOCUS, TROPHY_LOCS, COLLECT_LOCS, GOAL_LOCS } from "../js/data/map-guide.js";
import { PINS, DLC_PINS, DLC_EDGES, DLC_AREAS, AREAS } from "../js/data/map.js";

const errors = [];
const err = (m) => errors.push(m);
const KINDS = new Set(["go", "boss", "item", "quest", "warn", "map", "key", "tip"]);
const trophyKeys = new Set(TROPHIES.map((t) => t[0]));
const collectibles = new Set(Object.values(COLLECTIONS).flatMap(([, items]) => items.map(([id]) => id)));
const goalKeys = new Set(GOALS.flatMap(([, items]) => items.map(([k]) => k)));

const seenPhase = new Set();
const seenTr = new Map(), seenC = new Map(), seenG = new Map();
for (const [list, dlc] of [[PHASES, false], [DLC_PHASES, true]]) {
  for (const p of list) {
    if (seenPhase.has(p.id)) err(`duplicate phase id ${p.id}`);
    seenPhase.add(p.id);
    p.s.forEach(([kind, text, o = {}], i) => {
      const at = `${p.id}.${i}`;
      if (!KINDS.has(kind)) err(`${at}: unknown kind ${kind}`);
      if (!text) err(`${at}: empty text`);
      if (o.tr) { if (!trophyKeys.has(o.tr)) err(`${at}: unknown trophy ${o.tr}`); if (seenTr.has(o.tr)) err(`${at}: trophy ${o.tr} also on ${seenTr.get(o.tr)}`); seenTr.set(o.tr, at); }
      if (o.c) { if (!collectibles.has(o.c)) err(`${at}: unknown collectible ${o.c}`); if (seenC.has(o.c)) err(`${at}: collectible ${o.c} also on ${seenC.get(o.c)}`); seenC.set(o.c, at); }
      if (o.g) { if (!goalKeys.has(o.g)) err(`${at}: unknown goal ${o.g}`); if (seenG.has(o.g)) err(`${at}: goal ${o.g} also on ${seenG.get(o.g)}`); seenG.set(o.g, at); if (!dlc) err(`${at}: goal on a base phase`); }
      if (o.tr && dlc) err(`${at}: trophy on a DLC phase`);
    });
    if (dlc) { if (!DLC_PINS[p.id]) err(`no DLC pin for ${p.id}`); if (!DLC_AREAS[p.id]) err(`no DLC area for ${p.id}`); }
    else if (p.id !== "prep" && !PINS[p.id]) err(`no map pin for ${p.id}`);
  }
}
for (const k of trophyKeys) if (k !== "platinum" && !COLLECTIONS[k] && !seenTr.has(k)) err(`trophy ${k} has no step`);
for (const c of collectibles) if (!seenC.has(c)) err(`collectible ${c} has no step`);
for (const k of goalKeys) if (!seenG.has(k)) err(`goal ${k} has no step`);
for (const [a, b] of DLC_EDGES) if (!DLC_PINS[a] || !DLC_PINS[b]) err(`edge ${a}-${b} references a missing pin`);
for (const c of COUNTERS) if (c.levels.at(-1) !== c.max) err(`counter ${c.id}: last level ${c.levels.at(-1)} != max ${c.max}`);
for (const id of Object.keys(AREAS)) if (!seenPhase.has(id)) err(`AREAS has unknown phase ${id}`);


// Map markers and the guide links. Dangling ids fail; unresolved items are only warned about.
const warnings = [];
const markerIds = new Set();
const catIds = new Set(CATS.map((k) => k.id));
for (const layer of ["base", "under", "dlc"]) {
  for (const r of JSON.parse(readFileSync(new URL(`../assets/map/data/${layer}.json`, import.meta.url), "utf8"))) {
    if (markerIds.has(r[0])) err(`duplicate marker id ${r[0]}`);
    markerIds.add(r[0]);
    if (!catIds.has(r[1])) err(`marker ${r[0]}: unknown category ${r[1]}`);
  }
}
const stepIds = new Set([...PHASES, ...DLC_PHASES].flatMap((p) => p.s.map((_, i) => `${p.id}.${i}`)));
const chk = (what, ids) => { for (const id of ids) if (!markerIds.has(id)) err(`${what}: location ${id} is not in the marker data`); };
for (const [k, v] of Object.entries(STEP_LOCS)) { if (!stepIds.has(k)) err(`STEP_LOCS: unknown step ${k}`); chk(`STEP_LOCS ${k}`, v); }
for (const [k, v] of Object.entries(PHASE_FOCUS)) { if (!seenPhase.has(k)) err(`PHASE_FOCUS: unknown phase ${k}`); chk(`PHASE_FOCUS ${k}`, [v]); }
for (const [k, v] of Object.entries(TROPHY_LOCS)) { if (!trophyKeys.has(k)) err(`TROPHY_LOCS: unknown trophy ${k}`); chk(`TROPHY_LOCS ${k}`, v); }
for (const [k, v] of Object.entries(COLLECT_LOCS)) { if (!collectibles.has(k)) err(`COLLECT_LOCS: unknown collectible ${k}`); chk(`COLLECT_LOCS ${k}`, [v]); }
for (const [k, v] of Object.entries(GOAL_LOCS)) { if (!goalKeys.has(k)) err(`GOAL_LOCS: unknown goal ${k}`); chk(`GOAL_LOCS ${k}`, v); }
for (const id of seenPhase) if (!PHASE_FOCUS[id]) err(`phase ${id} has no PHASE_FOCUS`);
for (const c of collectibles) if (!COLLECT_LOCS[c]) warnings.push(`collectible ${c} has no map location`);
for (const k of trophyKeys) if (!TROPHY_LOCS[k]) warnings.push(`trophy ${k} has no map location`);
for (const k of goalKeys) if (!GOAL_LOCS[k]) warnings.push(`goal ${k} has no map location`);
if (warnings.length) console.warn("warnings (unresolved map links):\n  " + warnings.join("\n  "));

if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`ok: ${seenPhase.size} phases, ${trophyKeys.size} trophies, ${goalKeys.size} goals, ${markerIds.size} markers`);
