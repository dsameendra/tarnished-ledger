// Progress and settings store.
// Progress is a map of step id -> [done(0|1), timestamp]. Keeping a timestamp per step lets two
// devices merge without a cleared tick on one device being undone by an older tick on the other.
// Found map markers use the same [flag, timestamp] shape, so they merge the same way.
// Display settings (theme, text size, ...) are per device. The profile, counters, ticks, found markers and
// the map filter choices sync.

import { TWINS } from "../data/twins.js";
import { COUNTER_MARKERS, COUNTER_QTY } from "../data/counter-markers.js";

const KEY = "tarnished-ledger:v2";
const BEFORE_KEY = KEY + ":before"; // the state from just before the last Reset or Restore (for Undo)
export const CORRUPT_KEY = KEY + ":corrupt"; // the raw text of a save that could not be read
const CORRUPT_ACK_KEY = KEY + ":corrupt-ack";
const LEGACY_KEY = "er100-v1";

export const DEFAULTS = {
  mode: "system",
  accent: "gold",
  size: "m",
  platform: "ps",
  compact: false,
  hide: false,
  tips: true,
  autoopen: true,
  awake: true,
  dlc: false,
  focus: "both",
};

const PROFILE_KEYS = ["platform", "dlc", "focus"];
export const COUNTER_MAX = { sf: 50, rsa: 25 };
// Allowed values for the settings that are synced as the shared profile.
const PROFILE_VALUES = { platform: ["ps", "xbox", "steam"], dlc: [true, false], focus: ["both", "dlc"] };

const MAP_DEFAULTS = { on: true, hideFound: false, route: true, cats: null };
const fresh = () => ({ v: 5, marks: {}, counters: {}, found: {}, mapPrefs: { ...MAP_DEFAULTS }, mapT: 0, profileT: 0, resetT: 0, settings: { ...DEFAULTS }, closed: {}, lastBackup: 0 });
let state = fresh();
const listeners = new Set();
let storageOK = true;

export const get = () => state;
export const isDone = (id) => state.marks[id]?.[0] === 1;
export const setting = (k) => state.settings[k];
// A blessing counter is the markers found on the map plus a hand-set offset (which can be negative), so finds made on
// two devices both count after a merge.
// A marker can be a pile ("Scadutree Fragment x2"), so each found marker adds its quantity.
const foundCount = (id) => (COUNTER_MARKERS[id] || []).reduce((n, m) => n + (state.found[m]?.[0] === 1 ? COUNTER_QTY[m] || 1 : 0), 0);
export const counter = (id) => Math.max(0, Math.min(COUNTER_MAX[id] ?? 0, (state.counters[id]?.[0] || 0) + foundCount(id)));
export const isFound = (id) => state.found[String(id)]?.[0] === 1;
export const mapPrefs = () => state.mapPrefs;
export const isStorageOK = () => storageOK;
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
// One failing renderer must not stop the others (the sync scheduler is a listener too).
function emit(kind, detail) {
  for (const fn of [...listeners]) {
    try { fn(kind, detail); } catch (e) { console.error("store listener failed", kind, e); }
  }
}

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (o) => Boolean(o) && typeof o === "object" && !Array.isArray(o);
const isId = (id) => typeof id === "string" && id !== "__proto__";

// A new change must always be strictly newer than the record it replaces, even inside one millisecond.
const stamp = (prev) => Math.max(Date.now(), (prev?.[1] ?? 0) + 1);
// Same rule for a single timestamp (map filters, profile) and for found markers and counters, which also have to
// be newer than the last Reset.
const stampT = (prevT) => Math.max(Date.now(), (prevT || 0) + 1);
const stampE = (prev) => Math.max(stamp(prev), state.resetT + 1);
// A remote device with a fast clock cannot win forever: remote timestamps count as at most five minutes ahead.
const FUTURE_MS = 5 * 60 * 1000;
const sane = (t) => Math.min(t, Date.now() + FUTURE_MS);
// Every timestamp this device holds, so a Reset or Restore can be newer than all of them.
function newestStamp() {
  let t = state.resetT;
  for (const m of [state.marks, state.counters, state.found]) for (const v of Object.values(m)) if (v[1] > t) t = v[1];
  return Math.max(t, state.mapT, state.profileT);
}

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    storageOK = true;
  } catch {
    storageOK = false;
  }
}

// Keep only well-formed [done, timestamp] pairs. Anything else in saved or remote data is dropped.
export function cleanMarks(raw) {
  const out = {};
  if (!isObj(raw)) return out;
  for (const [id, m] of Object.entries(raw)) {
    if (!isId(id) || !Array.isArray(m)) continue;
    const t = Number(m[1]);
    if (!Number.isFinite(t) || t < 0) continue;
    out[id] = [m[0] ? 1 : 0, t];
  }
  return out;
}

// Found map markers are keyed by the numeric marker id. Anything else is dropped and the count is bounded, so a
// hostile or broken backup cannot grow the save past the browser quota (the real map has about 7,500 markers).
export const MAX_FOUND = 10000;
const MARKER_ID = /^\d{1,9}$/;
export function cleanFound(raw) {
  const all = Object.entries(cleanMarks(raw)).filter(([id]) => MARKER_ID.test(id));
  if (all.length > MAX_FOUND) all.sort((a, b) => b[1][1] - a[1][1]).length = MAX_FOUND;
  return Object.fromEntries(all);
}

export function cleanCounters(raw) {
  const out = {};
  if (!isObj(raw)) return out;
  for (const [id, c] of Object.entries(raw)) {
    if (!hasOwn(COUNTER_MAX, id) || !Array.isArray(c)) continue;
    const t = Number(c[1]);
    if (!Number.isFinite(t) || t < 0) continue;
    out[id] = [clampCounter(id, c[0]), t];
  }
  return out;
}

function clampCounter(id, value) {
  const n = Math.round(Number(value));
  const max = COUNTER_MAX[id] ?? 0;
  return Number.isFinite(n) ? Math.max(-max, Math.min(max, n)) : 0;
}

// Map filter choices: booleans plus an optional list of category ids (null means the default set).
export function cleanMapPrefs(raw) {
  const out = { ...MAP_DEFAULTS };
  if (!isObj(raw)) return out;
  for (const k of ["on", "hideFound", "route"]) if (typeof raw[k] === "boolean") out[k] = raw[k];
  if (Array.isArray(raw.cats)) out.cats = raw.cats.filter((c) => typeof c === "string" || Number.isFinite(c)).slice(0, 400);
  return out;
}

// Accept only known settings of the right type, so a hand-edited or old save cannot inject odd values.
function cleanSettings(raw) {
  const out = { ...DEFAULTS };
  if (!isObj(raw)) return out;
  for (const k of Object.keys(DEFAULTS)) {
    if (!hasOwn(raw, k) || typeof raw[k] !== typeof DEFAULTS[k]) continue;
    if (PROFILE_VALUES[k] && !PROFILE_VALUES[k].includes(raw[k])) continue;
    out[k] = raw[k];
  }
  return out;
}

export function load() {
  state = fresh();
  storageOK = true;
  let raw = null, old = null;
  try {
    raw = localStorage.getItem(KEY);
    if (!raw) old = localStorage.getItem(LEGACY_KEY);
  } catch {
    storageOK = false;
    return;
  }
  if (raw) {
    let s = null;
    try { s = JSON.parse(raw); } catch { /* handled below */ }
    if (!isObj(s)) {
      // Unreadable save: keep the raw text under another key instead of letting the next write erase it.
      try { localStorage.setItem(CORRUPT_KEY, raw); localStorage.removeItem(CORRUPT_ACK_KEY); } catch { /* ignore */ }
      return;
    }
    state = {
      ...state,
      marks: cleanMarks(s.marks),
      counters: cleanCounters(s.counters),
      found: cleanFound(s.found),
      mapPrefs: cleanMapPrefs(s.mapPrefs),
      mapT: Number(s.mapT) || 0,
      settings: cleanSettings(s.settings),
      closed: isObj(s.closed) ? s.closed : {},
      profileT: Number(s.profileT) || 0,
      resetT: Number(s.resetT) || 0,
      lastBackup: Number(s.lastBackup) || 0,
    };
    adoptLegacyMap();
    if (reconcileTwins()) write();
    return;
  }
  if (old) {
    try {
      const s = JSON.parse(old);
      if (!isObj(s)) return;
      const t = Number(s.t) || Date.now();
      Object.keys(isObj(s.done) ? s.done : {}).forEach((id) => { if (isId(id)) state.marks[id] = [1, t]; });
      state.settings = cleanSettings(s.set);
      state.closed = isObj(s.closed) ? s.closed : {};
      write();
    } catch { /* legacy data unreadable: start fresh */ }
  }
  adoptLegacyMap();
  if (reconcileTwins()) write();
}

// Before found markers and map filters synced, the map kept them under its own keys. Fold them in once.
// They get timestamp 1, so anything another device already decided wins over them.
const OLD_FOUND = "tarnished-ledger:map-found";
const OLD_FILTER = "tarnished-ledger:map-filter";
function adoptLegacyMap() {
  let changed = false;
  try {
    const ids = JSON.parse(localStorage.getItem(OLD_FOUND) || "null");
    if (Array.isArray(ids)) {
      for (const id of ids) if ((typeof id === "string" || Number.isFinite(id)) && MARKER_ID.test(String(id)) && !state.found[String(id)]) state.found[String(id)] = [1, 1];
      localStorage.removeItem(OLD_FOUND);
      changed = true;
    }
    const f = JSON.parse(localStorage.getItem(OLD_FILTER) || "null");
    if (isObj(f) && state.mapT === 0 && ["on", "hideFound", "route", "cats"].some((k) => k in f)) {
      state.mapPrefs = cleanMapPrefs(f);
      state.mapT = 1;
      changed = true;
    }
  } catch { /* old data unreadable: ignore it */ }
  if (changed) write();
}

export function setFound(id, on) {
  state.found[String(id)] = [on ? 1 : 0, stampE(state.found[String(id)])];
  write();
  emit("found");
  if (Object.values(COUNTER_MARKERS).some((l) => l.includes(String(id)))) emit("counters");
}

export function setMapPrefs(patch) {
  state.mapPrefs = cleanMapPrefs({ ...state.mapPrefs, ...patch });
  state.mapT = stampT(state.mapT);
  write();
  emit("mapprefs", "local");
}

const twinOf = (id) => { for (const g of TWINS) if (g.includes(id)) return g.filter((x) => x !== id); return []; };

// Make each pair of twin steps agree. The newer tick wins and keeps its timestamp, so every device settles the same way.
function reconcileTwins() {
  let changed = false;
  for (const [a, b] of TWINS) {
    const x = state.marks[a], y = state.marks[b];
    if (!x && !y) continue;
    if (x && y && x[0] === y[0]) continue;
    const xWins = !y || (x && (x[1] > y[1] || (x[1] === y[1] && x[0] > y[0])));
    const [win, lose] = xWins ? [a, b] : [b, a];
    const w = state.marks[win];
    if (!state.marks[lose] && !w[0]) continue;
    state.marks[lose] = [w[0], w[1]];
    changed = true;
  }
  return changed;
}

export function setDone(id, value) {
  state.marks[id] = [value ? 1 : 0, stamp(state.marks[id])];
  for (const t of twinOf(id)) state.marks[t] = [value ? 1 : 0, stamp(state.marks[t])];
  write();
  emit("marks");
}

// Set several steps at once (a whole phase): one save and one update instead of one per step.
export function setDoneMany(ids, value) {
  for (const id of new Set([...ids, ...ids.flatMap(twinOf)])) state.marks[id] = [value ? 1 : 0, stamp(state.marks[id])];
  write();
  emit("marks");
}

export function setSetting(key, value) {
  state.settings[key] = value;
  if (PROFILE_KEYS.includes(key)) state.profileT = stampT(state.profileT);
  write();
  emit("settings", key);
}

export function setCounter(id, value) {
  if (!hasOwn(COUNTER_MAX, id)) return;
  const shown = Math.max(0, Math.min(COUNTER_MAX[id], Math.round(Number(value)) || 0));
  state.counters[id] = [clampCounter(id, shown - foundCount(id)), stampE(state.counters[id])];
  write();
  emit("counters");
}

export function setClosed(id, closed) {
  state.closed[id] = closed;
  write();
}

export function markBackup() {
  state.lastBackup = Date.now();
  write();
}

// What a Reset or a Restore would replace: done steps, found map markers and hand-set counters.
export function progressInfo() {
  const steps = doneIds().length;
  const found = Object.values(state.found).filter((f) => f[0] === 1).length;
  const counters = Object.values(state.counters).filter((c) => c[0] !== 0).length;
  return { steps, found, counters, any: steps + found + counters > 0 };
}

// Reset and Restore keep one compact copy of what they replace (done ids only, bounded) so Settings can offer Undo.
function keepBefore(reason) {
  if (!progressInfo().any) return; // never overwrite a useful older copy with an empty one
  const saved = {
    v: 1, at: Date.now(), reason,
    marks: doneIds().slice(0, 5000),
    found: Object.keys(state.found).filter((id) => state.found[id][0] === 1).slice(0, MAX_FOUND),
    counters: Object.fromEntries(Object.entries(state.counters).filter(([, c]) => c[0] !== 0).map(([id, c]) => [id, c[0]])),
  };
  try { localStorage.setItem(BEFORE_KEY, JSON.stringify(saved)); } catch { /* no room: Undo is simply not offered */ }
}

function readBefore() {
  try {
    const b = JSON.parse(localStorage.getItem(BEFORE_KEY) || "null");
    if (!isObj(b) || !Array.isArray(b.marks) || !Array.isArray(b.found)) return null;
    return {
      at: Number(b.at) || 0, reason: b.reason === "restore" ? "restore" : "reset",
      marks: b.marks.filter(isId).slice(0, 5000),
      found: b.found.map(String).filter((id) => MARKER_ID.test(id)).slice(0, MAX_FOUND),
      counters: cleanCounters(Object.fromEntries(Object.entries(isObj(b.counters) ? b.counters : {}).map(([id, v]) => [id, [v, 1]]))),
    };
  } catch { return null; }
}

// { at, reason, steps, found } for the saved "before the last reset or restore" copy, or null.
export function beforeInfo() {
  const b = readBefore();
  return b && { at: b.at, reason: b.reason, steps: b.marks.length, found: b.found.length };
}

// Put the saved copy back. Everything is stamped newer than anything this device holds (including the reset
// watermark), so the undo also wins when it syncs to the other devices.
export function undoLast() {
  const b = readBefore();
  if (!b) return null;
  const t = Math.max(Date.now(), newestStamp() + 1);
  const keep = new Set(b.marks), keepFound = new Set(b.found);
  for (const id of Object.keys(state.marks)) state.marks[id] = [keep.has(id) ? 1 : 0, t];
  for (const id of keep) state.marks[id] = [1, t];
  for (const id of Object.keys(state.found)) state.found[id] = [keepFound.has(id) ? 1 : 0, t];
  for (const id of keepFound) state.found[id] = [1, t];
  for (const id of Object.keys(COUNTER_MAX)) state.counters[id] = [b.counters[id]?.[0] ?? 0, t];
  reconcileTwins();
  try { localStorage.removeItem(BEFORE_KEY); } catch { /* ignore */ }
  write();
  emit("marks");
  emit("counters");
  emit("found");
  return { at: b.at, reason: b.reason, steps: doneIds().length, found: keepFound.size };
}

// The raw text of a save that could not be read, until the player dismisses the notice.
export function corruptCopy() {
  try { return localStorage.getItem(CORRUPT_ACK_KEY) ? null : localStorage.getItem(CORRUPT_KEY); } catch { return null; }
}
export function dismissCorrupt() {
  try { localStorage.setItem(CORRUPT_ACK_KEY, "1"); } catch { /* ignore */ }
}

// Clears every tick, counter and found marker. Passing the list of valid step ids also stamps steps this device has
// never seen, so an older remote tick for them cannot come back through the next sync. The reset watermark (resetT)
// does the same for found markers and counters this device has never seen: nothing stamped at or before it is accepted.
export function resetProgress(ids = []) {
  keepBefore("reset");
  const now = Math.max(Date.now(), newestStamp() + 1);
  state.resetT = now;
  for (const id of [...Object.keys(state.marks), ...ids]) if (isId(id)) state.marks[id] = [0, now];
  for (const id of Object.keys(COUNTER_MAX)) state.counters[id] = [0, now];
  for (const id of Object.keys(state.found)) state.found[id] = [0, now];
  write();
  emit("marks");
  emit("counters");
  emit("found");
}

export function doneIds() {
  return Object.keys(state.marks).filter((id) => state.marks[id][0] === 1);
}

// Merge remote marks into local state. Returns true when local state changed.
// The newer timestamp wins; on an exact tie "done" wins so both devices settle on the same value.
export function mergeMarks(remote, validIds) {
  let changed = false;
  for (const [id, raw] of Object.entries(cleanMarks(remote))) {
    if (validIds && !validIds.has(id)) continue;
    const r = [raw[0], sane(raw[1])];
    const l = state.marks[id];
    if (!l || r[1] > l[1] || (r[1] === l[1] && r[0] > l[0])) {
      state.marks[id] = r;
      changed = true;
    }
  }
  if (reconcileTwins()) changed = true;
  if (changed) { write(); emit("marks"); }
  return changed;
}

// Merge counters, found markers, map filters and the shared profile (platform, DLC choice) from a remote snapshot.
export function mergeExtras(remote) {
  let counters = false, found = false, wrote = false;
  const rr = sane(Number(remote?.resetT) || 0);
  if (rr > state.resetT) {
    // Another device reset after everything this one holds for these: drop what the reset covers.
    state.resetT = rr;
    wrote = true;
    for (const [id, v] of Object.entries(state.counters)) if (v[1] <= rr) { if (v[0] !== 0) counters = true; delete state.counters[id]; }
    for (const [id, v] of Object.entries(state.found)) if (v[1] <= rr) { if (v[0] === 1) found = true; delete state.found[id]; }
  }
  for (const [id, raw] of Object.entries(cleanCounters(remote?.counters))) {
    const r = [raw[0], sane(raw[1])];
    if (r[1] <= state.resetT) continue;
    const l = state.counters[id];
    if (!l || r[1] > l[1]) { state.counters[id] = r; counters = true; }
  }
  for (const [id, raw] of Object.entries(cleanFound(remote?.found))) {
    const r = [raw[0], sane(raw[1])];
    if (r[1] <= state.resetT) continue;
    const l = state.found[id];
    if (!l && Object.keys(state.found).length >= MAX_FOUND) continue;
    if (!l || r[1] > l[1] || (r[1] === l[1] && r[0] > l[0])) { state.found[id] = r; found = true; }
  }
  let prefs = false;
  const rp = remote?.mapPrefs;
  if (isObj(rp) && sane(Number(rp.t) || 0) > state.mapT) {
    state.mapPrefs = cleanMapPrefs(rp);
    state.mapT = sane(Number(rp.t));
    prefs = true;
  }
  const prof = remote?.profile;
  const changed = [];
  if (isObj(prof) && sane(Number(prof.t) || 0) > state.profileT) {
    for (const k of PROFILE_KEYS) {
      if (hasOwn(prof, k) && PROFILE_VALUES[k].includes(prof[k]) && prof[k] !== state.settings[k]) { state.settings[k] = prof[k]; changed.push(k); }
    }
    state.profileT = sane(Number(prof.t));
  }
  if (wrote || counters || found || prefs || changed.length) write();
  if (counters) emit("counters");
  if (found) { emit("found"); emit("counters"); }
  if (prefs) emit("mapprefs", "remote");
  changed.forEach((k) => emit("settings", k));
  return counters || found || prefs || changed.length > 0;
}

// True when remote already holds everything local knows.
export function remoteCovers(remote) {
  const marks = cleanMarks(remote?.marks);
  const okMarks = Object.entries(state.marks).every(([id, l]) => {
    const r = marks[id];
    return r && (r[1] > l[1] || (r[1] === l[1] && r[0] >= l[0]));
  });
  const counters = cleanCounters(remote?.counters);
  const okCounters = Object.entries(state.counters).every(([id, l]) => (counters[id]?.[1] ?? -1) >= l[1]);
  const found = cleanFound(remote?.found);
  const okFound = Object.entries(state.found).every(([id, l]) => {
    const r = found[id];
    return r && (r[1] > l[1] || (r[1] === l[1] && r[0] >= l[0]));
  });
  const okMap = (Number(remote?.mapPrefs?.t) || 0) >= state.mapT;
  const okReset = (Number(remote?.resetT) || 0) >= state.resetT;
  return okMarks && okCounters && okFound && okMap && okReset && (Number(remote?.profile?.t) || 0) >= state.profileT;
}

export function snapshot() {
  const profile = { t: state.profileT };
  PROFILE_KEYS.forEach((k) => { profile[k] = state.settings[k]; });
  return {
    app: "tarnished-ledger", v: 5, savedAt: Date.now(), marks: structuredClone(state.marks), counters: structuredClone(state.counters),
    found: structuredClone(state.found), mapPrefs: { ...structuredClone(state.mapPrefs), t: state.mapT }, profile, resetT: state.resetT,
  };
}

// Reads a v2-v5 snapshot, a legacy "ER1:" code or a v1 backup without touching any state. Throws when it is not recognised.
function parseImport(input, validIds) {
  let marks = null, counters = null, found = null, mapPrefs = null;
  if (typeof input === "string") {
    const text = input.trim();
    if (text.startsWith("ER1:")) {
      const ids = atob(text.slice(4)).split(",").filter(Boolean);
      marks = Object.fromEntries(ids.map((id) => [id, [1, 0]]));
      input = null;
    } else {
      input = JSON.parse(text);
    }
  }
  if (!marks && isObj(input)) {
    if (isObj(input.marks)) marks = input.marks;
    else if (isObj(input.done)) marks = Object.fromEntries(Object.keys(input.done).map((id) => [id, [1, 0]]));
    if (isObj(input.counters)) counters = input.counters;
    if (isObj(input.found)) found = cleanFound(input.found);
    if (isObj(input.mapPrefs)) mapPrefs = cleanMapPrefs(input.mapPrefs);
  }
  if (!marks) throw new Error("Unrecognised backup");
  const done = new Set();
  const list = [];
  for (const [id, m] of Object.entries(marks)) {
    if (!isId(id) || (validIds && !validIds.has(id))) continue;
    const d = Array.isArray(m) ? m[0] : m;
    list.push([id, d ? 1 : 0]);
    if (d) { done.add(id); twinOf(id).forEach((t) => done.add(t)); }
  }
  return { list, counters, found, mapPrefs, steps: done.size };
}

// What a backup file or code holds, for the confirmation: { steps, found (a count, or null when it carries no found markers), counters }.
export function previewImport(input, validIds) {
  const p = parseImport(input, validIds);
  return { steps: p.steps, found: p.found ? Object.values(p.found).filter((f) => f[0] === 1).length : null, counters: Boolean(p.counters) };
}

// Replaces local progress with a backup. Returns the number of done steps afterwards. The pieces a backup does not
// carry (an ER1 code has steps only) are left as they are.
export function importData(input, validIds) {
  const { list, counters, found, mapPrefs } = parseImport(input, validIds);
  keepBefore("restore");
  const now = Math.max(Date.now(), newestStamp() + 1);
  Object.keys(state.marks).forEach((id) => { state.marks[id] = [0, now]; });
  for (const [id, d] of list) state.marks[id] = [d, now + 1];
  if (counters) {
    for (const [id, c] of Object.entries(counters)) {
      if (hasOwn(COUNTER_MAX, id) && Array.isArray(c)) state.counters[id] = [clampCounter(id, c[0]), now + 1];
    }
  }
  if (found) {
    // the backup's markers replace all of them, including ones other devices found that this one has not seen yet
    state.resetT = now;
    Object.keys(state.found).forEach((id) => { state.found[id] = [0, now]; });
    for (const [id, m] of Object.entries(found)) state.found[id] = [m[0], now + 1];
  }
  if (mapPrefs) { state.mapPrefs = mapPrefs; state.mapT = Math.max(now + 1, state.mapT + 1); }
  reconcileTwins();
  write();
  if (counters) emit("counters");
  if (found) { emit("found"); emit("counters"); }
  if (mapPrefs) emit("mapprefs", "remote");
  emit("marks");
  return doneIds().length;
}
