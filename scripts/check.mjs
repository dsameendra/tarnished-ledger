// Sanity checks for the route data and the shipped files. Run with `npm run check`.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PHASES } from "../js/data/route.js";
import { DLC_PHASES } from "../js/data/dlc-route.js";
import { GOALS, COUNTERS } from "../js/data/dlc-goals.js";
import { TROPHIES, COLLECTIONS } from "../js/data/trophies.js";
import { CATS } from "../js/data/map-categories.js";
import { STEP_LOCS, PHASE_FOCUS, TROPHY_LOCS, COLLECT_LOCS, GOAL_LOCS } from "../js/data/map-guide.js";
import { PINS, DLC_PINS, DLC_EDGES, DLC_AREAS, AREAS } from "../js/data/map.js";
import { parseSw, shellHash } from "./shell-hash.mjs";
import { COUNTER_MAX } from "../js/lib/store.js";
import { COUNTER_MARKERS, COUNTER_QTY } from "../js/data/counter-markers.js";
import { counterMarkersSource, readRows } from "./counter-markers.mjs";

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
for (const id of Object.keys(AREAS)) if (!seenPhase.has(id)) err(`AREAS has unknown phase ${id}`);

// The same sentence on two steps usually means a copy and paste slip.
const seenText = new Map();
for (const p of [...PHASES, ...DLC_PHASES]) {
  p.s.forEach(([, text], i) => {
    const at = `${p.id}.${i}`;
    if (text !== text.trim()) err(`${at}: text has leading or trailing space`);
    const key = text.trim().toLowerCase();
    if (seenText.has(key)) err(`${at}: same text as ${seenText.get(key)}`);
    seenText.set(key, at);
  });
}

// Goals and counters must agree with the store and the model.
const goalAll = GOALS.flatMap(([, items]) => items.map(([k]) => k));
if (new Set(goalAll).size !== goalAll.length) err("duplicate goal key");
const counterIds = COUNTERS.map((c) => c.id);
if (new Set(counterIds).size !== counterIds.length) err("duplicate counter id");
if (JSON.stringify([...counterIds].sort()) !== JSON.stringify(Object.keys(COUNTER_MAX).sort())) err(`COUNTERS ids [${counterIds}] do not match store COUNTER_MAX [${Object.keys(COUNTER_MAX)}]`);
for (const c of COUNTERS) {
  if (COUNTER_MAX[c.id] !== c.max) err(`counter ${c.id}: max ${c.max} != store COUNTER_MAX ${COUNTER_MAX[c.id]}`);
  if (c.levels.at(-1) !== c.max) err(`counter ${c.id}: last level ${c.levels.at(-1)} != max ${c.max}`);
  if (c.levels.some((v, i) => i > 0 && v <= c.levels[i - 1])) err(`counter ${c.id}: levels are not strictly increasing`);
}
// Blessing counters: markers found on the map add their quantity, and finding them all must give exactly the maximum.
for (const [id, list] of Object.entries(COUNTER_MARKERS)) {
  const total = list.reduce((n, m) => n + (COUNTER_QTY[m] || 1), 0);
  if (total !== COUNTER_MAX[id]) err(`counter ${id}: map markers add up to ${total}, not ${COUNTER_MAX[id]}`);
}
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (f) => readFileSync(join(root, f), "utf8");
const blessTotal = Number(/blessings: \[[^\]]*,\s*(\d+)\]/.exec(read("js/lib/model.js"))?.[1]);
if (blessTotal !== COUNTERS.reduce((n, c) => n + c.max, 0)) err(`model.js blessings total ${blessTotal} != sum of counter maxima`);

if (read("js/data/counter-markers.js") !== counterMarkersSource(readRows())) err("js/data/counter-markers.js is out of date: run node scripts/counter-markers.mjs");

// The service worker precache list must match what ships.
const swSrc = read("sw.js");
const shell = JSON.parse("[" + /const SHELL = \[([\s\S]*?)\];/.exec(swSrc)[1].replace(/,\s*$/, "") + "]");
const shellSet = new Set(shell.map((f) => (f === "./" ? "index.html" : f)));
if (shell.length !== new Set(shell).size) err("SHELL has duplicate entries");
for (const f of shellSet) if (!existsSync(join(root, f))) err(`SHELL lists missing file ${f}`);
const walk = (dir) => readdirSync(join(root, dir)).flatMap((n) => {
  const rel = join(dir, n);
  return statSync(join(root, rel)).isDirectory() ? walk(rel) : [rel];
});
// Map tiles are cached as you view them; the map images and marker data are in MAP_PACK (fetched after install).
const mapPack = JSON.parse("[" + /const MAP_PACK = \[([\s\S]*?)\];/.exec(swSrc)[1].replace(/,\s*$/, "") + "]");
for (const f of mapPack) if (!existsSync(join(root, f))) err(`MAP_PACK lists missing file ${f}`);
const lazy = (f) => f.startsWith("assets/map/tiles/") || mapPack.includes(f);
for (const f of walk("assets/map")) if (!f.startsWith("assets/map/tiles/") && !f.endsWith(".DS_Store") && !mapPack.includes(f)) err(`${f} ships but is not in the sw.js MAP_PACK`);
const shipped = ["js", "css", "assets", "vendor"].flatMap(walk).filter((f) => !f.endsWith(".DS_Store") && !f.endsWith("LICENSE") && !lazy(f));
for (const f of [...shipped, "manifest.webmanifest"]) if (!shellSet.has(f)) err(`${f} ships but is not in the sw.js SHELL`);
if (parseSw(swSrc).hash !== shellHash(swSrc)) err("files the service worker serves cache-first changed since the last bump: run `npm run bump`");
if (!/const CACHE = PREFIX \+ "v\d+"/.test(swSrc)) err('sw.js CACHE must be PREFIX + "v<number>"');

// index.html: local links exist, ids are unique, and every id the code looks up by name is present.
const html = read("index.html");
for (const m of html.matchAll(/(?:src|href)="([^"#?]+)"/g)) {
  if (/^(https?:|mailto:|data:)/.test(m[1])) continue;
  if (!existsSync(join(root, m[1]))) err(`index.html references missing file ${m[1]}`);
}
const idList = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const dup = idList.filter((v, i) => idList.indexOf(v) !== i);
if (dup.length) err(`index.html has duplicate ids: ${[...new Set(dup)]}`);
const ids = new Set(idList);
const made = new Set(["counters", "goalGroups", "mapSaveNote", "nextDone", "nextShow", "nextTicked", "mapLayerNote"]); // created by JavaScript
for (const f of shipped.filter((f) => f.endsWith(".js") && !f.includes("data"))) {
  for (const m of read(f).matchAll(/\$\("([A-Za-z][\w-]*)"\)/g)) {
    if (!ids.has(m[1]) && !made.has(m[1])) err(`${f}: looks up #${m[1]} which is not in index.html`);
  }
}

// Manifest: relative paths so it works under a GitHub Pages sub-path, real icons of the stated size.
const man = JSON.parse(read("manifest.webmanifest"));
for (const key of ["name", "short_name", "start_url", "scope", "display", "theme_color", "background_color", "icons"]) if (!man[key]) err(`manifest is missing ${key}`);
if (String(man.start_url).startsWith("/")) err("manifest start_url must be relative so it works under a sub-path");
if (String(man.scope).startsWith("/")) err("manifest scope must be relative so it works under a sub-path");
const startFile = String(man.start_url || "").split(/[?#]/)[0];
if (startFile && startFile !== "./" && !existsSync(join(root, startFile))) err(`manifest start_url ${man.start_url} does not exist`);
for (const ic of man.icons || []) {
  if (!existsSync(join(root, ic.src))) { err(`manifest icon ${ic.src} is missing`); continue; }
  const b = readFileSync(join(root, ic.src));
  if (b.toString("latin1", 1, 4) !== "PNG") err(`${ic.src} is not a PNG`);
  else if (ic.sizes !== `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`) err(`${ic.src}: manifest says ${ic.sizes} but the file is ${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`);
}
const themeMeta = /<meta name="theme-color" content="(#[0-9a-fA-F]+)"/.exec(html)?.[1];
if (themeMeta && man.theme_color && themeMeta.toLowerCase() !== man.theme_color.toLowerCase()) err(`index.html theme-color ${themeMeta} != manifest ${man.theme_color}`);


// Map markers and the guide links. Dangling ids fail; unresolved items are only warned about.
const warnings = [];
const markerIds = new Set();
const catIds = new Set(CATS.map((k) => k.id));
for (const layer of ["base", "under", "hub", "dlc"]) {
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
console.log(`ok: ${seenPhase.size} phases, ${trophyKeys.size} trophies, ${goalKeys.size} goals, ${shellSet.size} shell files, ${markerIds.size} markers`);
