// Optional cross-device sync through a private GitHub Gist owned by the user.
// There is no server: the browser talks to api.github.com directly with a personal access token
// that the user pastes in. The token is kept only in this browser's localStorage.
// Create a classic token at github.com/settings/tokens with the "gist" scope and nothing else.

import * as store from "./store.js";

const API = "https://api.github.com";
const FILE = "tarnished-ledger.json";
const DESCRIPTION = "Tarnished's Ledger progress (safe to keep, do not edit)";
const CFG_KEY = "tarnished-ledger:sync";
const TIMEOUT_MS = 20000;
const PROFILE = ["platform", "dlc", "focus"];

let cfg = { token: "", gistId: "", lastSync: 0 };
let timer = null;
let running = false;
let again = false;
let merging = false; // true only while remote data is being merged in, so our own merge does not schedule a sync
let lastRun = 0;
let epoch = 0; // bumped on connect and disconnect so an in-flight sync can tell it has been superseded
let validIds = null;
const listeners = new Set();
export const status = { state: "off", message: "Not connected", at: 0 };

export function onStatus(fn) { listeners.add(fn); fn(status); return () => listeners.delete(fn); }
function setStatus(state, message) {
  status.state = state;
  status.message = message;
  if (state === "ok") status.at = Date.now();
  listeners.forEach((fn) => fn(status));
}

function saveCfg() {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch { /* storage unavailable */ }
}
export const isConnected = () => Boolean(cfg.token && cfg.gistId);
const fail = (message, code) => Object.assign(new Error(message), { code });

// fetch with a timeout, so a stalled connection cannot leave the sync stuck in the "running" state.
async function request(url, options = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: ctl.signal });
  } catch {
    throw fail(ctl.signal.aborted ? "GitHub did not answer in time." : "You appear to be offline.", "offline");
  } finally {
    clearTimeout(t);
  }
}

async function api(path, options = {}) {
  const res = await request(API + path, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + cfg.token,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (res.status === 401) throw fail("GitHub rejected the token. Create a new one with the gist scope.", "auth");
  if (res.status === 429 || (res.status === 403 && (res.headers?.get?.("x-ratelimit-remaining") === "0" || res.headers?.get?.("retry-after")))) {
    throw fail("GitHub rate limit reached. Try again in a few minutes.", "rate");
  }
  if (res.status === 403) throw fail("GitHub refused the request. Check that the token has the gist scope.", "forbidden");
  if (res.status === 404) throw fail("The sync gist was not found.", "missing");
  if (!res.ok) throw fail("GitHub returned an error (" + res.status + ").", "http");
  try { return await res.json(); } catch { throw fail("GitHub sent a reply the app could not read.", "http"); }
}

async function findGist() {
  for (let page = 1; page <= 5; page++) {
    const list = await api(`/gists?per_page=100&page=${page}`);
    const hit = list.find((g) => g.files && g.files[FILE]);
    if (hit) return hit.id;
    if (list.length < 100) break;
  }
  return "";
}

async function createGist() {
  const created = await api("/gists", {
    method: "POST",
    body: JSON.stringify({ description: DESCRIPTION, public: false, files: { [FILE]: { content: JSON.stringify(store.snapshot()) } } }),
  });
  return created.id;
}

// An unreadable remote file counts as empty (and gets rewritten). A failed download does not: it throws,
// so we never overwrite someone's progress just because a request failed.
async function readRemote() {
  const gist = await api("/gists/" + cfg.gistId);
  const file = gist.files && gist.files[FILE];
  if (!file) return {};
  let text = file.content;
  if (file.truncated && file.raw_url) {
    const raw = await request(file.raw_url);
    if (!raw.ok) throw fail("GitHub returned an error (" + raw.status + ").", "http");
    text = await raw.text();
  }
  try {
    const data = JSON.parse(text);
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

async function writeRemote() {
  const body = JSON.stringify({ description: DESCRIPTION, files: { [FILE]: { content: JSON.stringify(store.snapshot()) } } });
  await api("/gists/" + cfg.gistId, { method: "PATCH", body });
}

async function pullAndPush(my) {
  const remote = await readRemote();
  if (my !== epoch) return;
  merging = true;
  try {
    store.mergeMarks(remote.marks, validIds);
    store.mergeExtras(remote);
  } finally {
    merging = false;
  }
  if (!store.remoteCovers(remote)) await writeRemote();
}

export async function syncNow() {
  if (!isConnected()) return;
  if (running) { again = true; return; }
  running = true;
  const my = epoch;
  setStatus("busy", "Syncing…");
  try {
    try {
      await pullAndPush(my);
    } catch (e) {
      if (e.code !== "missing" || my !== epoch) throw e;
      // The gist was deleted or lives in another account: find one again, or start a new one from local data.
      cfg.gistId = (await findGist()) || (await createGist());
      saveCfg();
      await pullAndPush(my);
    }
    if (my !== epoch) return;
    cfg.lastSync = Date.now();
    saveCfg();
    setStatus("ok", "Synced");
  } catch (e) {
    if (my !== epoch) return;
    setStatus("err", e.message);
    if (e.code === "auth") disconnect(false);
  } finally {
    running = false;
    lastRun = Date.now();
    // A change arrived mid-sync, or connect() was called while this run was in flight and was told to wait.
    if (again && (my === epoch || isConnected())) { again = false; schedule(500); }
  }
}

export function schedule(delay = 1500) {
  if (!isConnected()) return;
  clearTimeout(timer);
  timer = setTimeout(() => { timer = null; syncNow(); }, delay);
}

export async function connect(token) {
  token = String(token || "").trim();
  if (!token) throw new Error("Paste a token first.");
  epoch++;
  cfg = { token, gistId: "", lastSync: 0 };
  setStatus("busy", "Connecting…");
  try {
    cfg.gistId = (await findGist()) || (await createGist());
    saveCfg();
    await syncNow();
  } catch (e) {
    epoch++;
    cfg = { token: "", gistId: "", lastSync: 0 };
    setStatus("err", e.message);
    throw e;
  }
}

export function disconnect(clearMessage = true) {
  epoch++;
  cfg = { token: "", gistId: "", lastSync: 0 };
  try { localStorage.removeItem(CFG_KEY); } catch { /* ignore */ }
  clearTimeout(timer);
  timer = null;
  again = false;
  setStatus("off", clearMessage ? "Not connected" : status.message);
}

// options.validIds: a Set of known step ids; remote marks for anything else are ignored.
export function init(options = {}) {
  validIds = options.validIds || null;
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && typeof saved === "object") cfg = { token: String(saved.token || ""), gistId: String(saved.gistId || ""), lastSync: Number(saved.lastSync) || 0 };
    }
  } catch { /* ignore */ }
  if (isConnected()) {
    setStatus("idle", "Connected");
    syncNow();
  }
  store.onChange((kind, detail) => {
    if (merging) return;
    if (kind === "marks" || kind === "counters" || kind === "found" || kind === "mapprefs" || (kind === "settings" && PROFILE.includes(detail))) {
      if (running) again = true; else schedule();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (!isConnected()) return;
    if (document.visibilityState === "visible" && Date.now() - lastRun > 20000) syncNow();
    // Flush a change that is still waiting on the debounce before the page goes to the background.
    if (document.visibilityState === "hidden" && timer) { clearTimeout(timer); timer = null; syncNow(); }
  });
  window.addEventListener("online", () => schedule(500));
}
