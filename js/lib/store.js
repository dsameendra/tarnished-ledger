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

let state = { v: 3, marks: {}, counters: {}, profileT: 0, settings: { ...DEFAULTS }, closed: {}, lastBackup: 0 };
const listeners = new Set();
let storageOK = true;

export const get = () => state;
export const isDone = (id) => state.marks[id]?.[0] === 1;
export const setting = (k) => state.settings[k];
export const counter = (id) => state.counters[id]?.[0] || 0;
export const isStorageOK = () => storageOK;
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(kind, detail) { listeners.forEach((fn) => fn(kind, detail)); }

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    storageOK = true;
  } catch {
    storageOK = false;
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      state = {
        ...state, ...s,
        marks: s.marks || {},
        settings: { ...DEFAULTS, ...(s.settings || {}) },
        closed: s.closed || {},
        counters: s.counters || {},
        profileT: s.profileT || 0,
      };
      return;
    }
    const old = localStorage.getItem(LEGACY_KEY);
    if (old) {
      const s = JSON.parse(old);
      const t = s.t || Date.now();
      Object.keys(s.done || {}).forEach((id) => { state.marks[id] = [1, t]; });
      state.settings = { ...DEFAULTS, ...(s.set || {}) };
      state.closed = s.closed || {};
      write();
    }
  } catch {
    storageOK = false;
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
  const max = COUNTER_MAX[id] ?? 0;
  state.counters[id] = [Math.max(0, Math.min(max, Math.round(value))), Date.now()];
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

export function resetProgress() {
  const now = Date.now();
  Object.keys(state.marks).forEach((id) => { state.marks[id] = [0, now]; });
  write();
  emit("marks");
}

export function doneIds() {
  return Object.keys(state.marks).filter((id) => state.marks[id][0] === 1);
}

// Merge remote marks into local state. Returns true when local state changed.
export function mergeMarks(remote) {
  let changed = false;
  for (const [id, r] of Object.entries(remote || {})) {
    if (!Array.isArray(r) || r.length < 2) continue;
    const l = state.marks[id];
    if (!l || r[1] > l[1]) {
      state.marks[id] = [r[0] ? 1 : 0, Number(r[1]) || 0];
      changed = true;
    }
  }
  if (changed) { write(); emit("marks"); }
  return changed;
}

// Merge counters and the shared profile (platform, DLC choice) from a remote snapshot.
export function mergeExtras(remote) {
  let counters = false;
  for (const [id, r] of Object.entries(remote?.counters || {})) {
    if (!(id in COUNTER_MAX) || !Array.isArray(r) || r.length < 2) continue;
    const l = state.counters[id];
    if (!l || r[1] > l[1]) { state.counters[id] = [Math.max(0, Math.min(COUNTER_MAX[id], Number(r[0]) || 0)), Number(r[1]) || 0]; counters = true; }
  }
  const prof = remote?.profile;
  const changed = [];
  if (prof && Number(prof.t) > state.profileT) {
    for (const k of PROFILE_KEYS) {
      if (k in prof && prof[k] !== state.settings[k]) { state.settings[k] = prof[k]; changed.push(k); }
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
  const marks = remote?.marks || {};
  const okMarks = Object.entries(state.marks).every(([id, l]) => {
    const r = marks[id];
    return r && r[1] >= l[1];
  });
  const okCounters = Object.entries(state.counters).every(([id, l]) => (remote?.counters?.[id]?.[1] || 0) >= l[1]);
  return okMarks && okCounters && (remote?.profile?.t || 0) >= state.profileT;
}

export function snapshot() {
  const profile = { t: state.profileT };
  PROFILE_KEYS.forEach((k) => { profile[k] = state.settings[k]; });
  return { app: "tarnished-ledger", v: 3, savedAt: Date.now(), marks: state.marks, counters: state.counters, profile };
}

// Accepts a v2 snapshot, a legacy "ER1:" code, or a v1 backup. Returns the number of done steps.
export function importData(input, validIds) {
  let marks = null;
  if (typeof input === "string") {
    const text = input.trim();
    if (text.startsWith("ER1:")) {
      const ids = atob(text.slice(4)).split(",").filter(Boolean);
      marks = Object.fromEntries(ids.map((id) => [id, [1, Date.now()]]));
    } else {
      input = JSON.parse(text);
    }
  }
  if (!marks && input && typeof input === "object") {
    if (input.marks) marks = input.marks;
    else if (input.done) marks = Object.fromEntries(Object.keys(input.done).map((id) => [id, [1, input.t || Date.now()]]));
  }
  if (!marks) throw new Error("Unrecognised backup");
  const now = Date.now();
  Object.keys(state.marks).forEach((id) => { state.marks[id] = [0, now]; });
  let n = 0;
  for (const [id, m] of Object.entries(marks)) {
    if (validIds && !validIds.has(id)) continue;
    const done = Array.isArray(m) ? m[0] : m;
    state.marks[id] = [done ? 1 : 0, now + 1];
    if (done) n++;
  }
  if (input.counters && typeof input.counters === "object") {
    for (const [id, c] of Object.entries(input.counters)) {
      if (id in COUNTER_MAX && Array.isArray(c)) state.counters[id] = [Math.max(0, Math.min(COUNTER_MAX[id], Number(c[0]) || 0)), now + 1];
    }
    emit("counters");
  }
  write();
  emit("marks");
  return n;
}
