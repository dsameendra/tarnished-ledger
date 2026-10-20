// Progress and settings store.
// Progress is a map of step id -> [done(0|1), timestamp]. Keeping a timestamp per step lets two
// devices merge without a cleared tick on one device being undone by an older tick on the other.
// Settings are per device and never synced.

const KEY = "tarnished-ledger:v2";
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

const fresh = () => ({ v: 3, marks: {}, counters: {}, profileT: 0, settings: { ...DEFAULTS }, closed: {}, lastBackup: 0 });
let state = fresh();
const listeners = new Set();
let storageOK = true;

export const get = () => state;
export const isDone = (id) => state.marks[id]?.[0] === 1;
export const setting = (k) => state.settings[k];
export const counter = (id) => state.counters[id]?.[0] || 0;
export const isStorageOK = () => storageOK;
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(kind, detail) { listeners.forEach((fn) => fn(kind, detail)); }

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (o) => Boolean(o) && typeof o === "object" && !Array.isArray(o);
const isId = (id) => typeof id === "string" && id !== "__proto__";

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
  return Number.isFinite(n) ? Math.max(0, Math.min(COUNTER_MAX[id] ?? 0, n)) : 0;
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
      try { localStorage.setItem(KEY + ":corrupt", raw); } catch { /* ignore */ }
      return;
    }
    state = {
      ...state,
      marks: cleanMarks(s.marks),
      counters: cleanCounters(s.counters),
      settings: cleanSettings(s.settings),
      closed: isObj(s.closed) ? s.closed : {},
      profileT: Number(s.profileT) || 0,
      lastBackup: Number(s.lastBackup) || 0,
    };
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
}

export function setDone(id, value) {
  state.marks[id] = [value ? 1 : 0, Date.now()];
  write();
  emit("marks");
}

export function setSetting(key, value) {
  state.settings[key] = value;
  if (PROFILE_KEYS.includes(key)) state.profileT = Date.now();
  write();
  emit("settings", key);
}

export function setCounter(id, value) {
  if (!hasOwn(COUNTER_MAX, id)) return;
  state.counters[id] = [clampCounter(id, value), Date.now()];
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

// Clears every tick and counter. Passing the list of valid step ids also stamps steps this device has
// never seen, so an older remote tick for them cannot come back through the next sync.
export function resetProgress(ids = []) {
  const now = Date.now();
  for (const id of [...Object.keys(state.marks), ...ids]) state.marks[id] = [0, now];
  for (const id of Object.keys(COUNTER_MAX)) state.counters[id] = [0, now];
  write();
  emit("marks");
  emit("counters");
}

export function doneIds() {
  return Object.keys(state.marks).filter((id) => state.marks[id][0] === 1);
}

// Merge remote marks into local state. Returns true when local state changed.
// The newer timestamp wins; on an exact tie "done" wins so both devices settle on the same value.
export function mergeMarks(remote, validIds) {
  let changed = false;
  for (const [id, r] of Object.entries(cleanMarks(remote))) {
    if (validIds && !validIds.has(id)) continue;
    const l = state.marks[id];
    if (!l || r[1] > l[1] || (r[1] === l[1] && r[0] > l[0])) {
      state.marks[id] = r;
      changed = true;
    }
  }
  if (changed) { write(); emit("marks"); }
  return changed;
}

// Merge counters and the shared profile (platform, DLC choice) from a remote snapshot.
export function mergeExtras(remote) {
  let counters = false;
  for (const [id, r] of Object.entries(cleanCounters(remote?.counters))) {
    const l = state.counters[id];
    if (!l || r[1] > l[1]) { state.counters[id] = r; counters = true; }
  }
  const prof = remote?.profile;
  const changed = [];
  if (isObj(prof) && Number(prof.t) > state.profileT) {
    for (const k of PROFILE_KEYS) {
      if (hasOwn(prof, k) && PROFILE_VALUES[k].includes(prof[k]) && prof[k] !== state.settings[k]) { state.settings[k] = prof[k]; changed.push(k); }
    }
    state.profileT = Number(prof.t);
  }
  if (counters || changed.length) write();
  if (counters) emit("counters");
  changed.forEach((k) => emit("settings", k));
  return counters || changed.length > 0;
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
  return okMarks && okCounters && (Number(remote?.profile?.t) || 0) >= state.profileT;
}

export function snapshot() {
  const profile = { t: state.profileT };
  PROFILE_KEYS.forEach((k) => { profile[k] = state.settings[k]; });
  return { app: "tarnished-ledger", v: 3, savedAt: Date.now(), marks: structuredClone(state.marks), counters: structuredClone(state.counters), profile };
}

// Accepts a v2/v3 snapshot, a legacy "ER1:" code, or a v1 backup. Returns the number of done steps.
// Throws before touching any state when the input is not recognised.
export function importData(input, validIds) {
  let marks = null, counters = null;
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
  }
  if (!marks) throw new Error("Unrecognised backup");
  const now = Date.now();
  Object.keys(state.marks).forEach((id) => { state.marks[id] = [0, now]; });
  let n = 0;
  for (const [id, m] of Object.entries(marks)) {
    if (!isId(id) || (validIds && !validIds.has(id))) continue;
    const done = Array.isArray(m) ? m[0] : m;
    state.marks[id] = [done ? 1 : 0, now + 1];
    if (done) n++;
  }
  if (counters) {
    for (const [id, c] of Object.entries(counters)) {
      if (hasOwn(COUNTER_MAX, id) && Array.isArray(c)) state.counters[id] = [clampCounter(id, c[0]), now + 1];
    }
  }
  write();
  if (counters) emit("counters");
  emit("marks");
  return n;
}
