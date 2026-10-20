// Optional cross-device sync through a private GitHub Gist owned by the user.
// There is no server: the browser talks to api.github.com directly with a personal access token
// that the user pastes in. The token is kept only in this browser's localStorage.
// Create a classic token at github.com/settings/tokens with the "gist" scope and nothing else.

import * as store from "./store.js";

const API = "https://api.github.com";
const FILE = "tarnished-ledger.json";
const DESCRIPTION = "Tarnished's Ledger progress (safe to keep, do not edit)";
const CFG_KEY = "tarnished-ledger:sync";

let cfg = { token: "", gistId: "", lastSync: 0 };
let timer = null;
let running = false;
let again = false;
let lastRun = 0;
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

async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(API + path, {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer " + cfg.token,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  } catch {
    throw Object.assign(new Error("You appear to be offline."), { code: "offline" });
  }
  if (res.status === 401) throw Object.assign(new Error("GitHub rejected the token. Create a new one with the gist scope."), { code: "auth" });
  if (res.status === 403 || res.status === 429) throw Object.assign(new Error("GitHub rate limit reached. Try again in a few minutes."), { code: "rate" });
  if (res.status === 404) throw Object.assign(new Error("The sync gist was not found."), { code: "missing" });
  if (!res.ok) throw Object.assign(new Error("GitHub returned an error (" + res.status + ")."), { code: "http" });
  return res.json();
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

async function readRemote() {
  const gist = await api("/gists/" + cfg.gistId);
  const file = gist.files && gist.files[FILE];
  if (!file) return {};
  let text = file.content;
  if (file.truncated && file.raw_url) {
    const raw = await fetch(file.raw_url);
    text = await raw.text();
  }
  try { return JSON.parse(text).marks || {}; } catch { return {}; }
}

async function writeRemote() {
  const body = JSON.stringify({ description: DESCRIPTION, files: { [FILE]: { content: JSON.stringify(store.snapshot()) } } });
  await api("/gists/" + cfg.gistId, { method: "PATCH", body });
}

export async function syncNow() {
  if (!isConnected()) return;
  if (running) { again = true; return; }
  running = true;
  setStatus("busy", "Syncing…");
  try {
    const remote = await readRemote();
    store.mergeMarks(remote);
    if (!store.remoteCovers(remote)) await writeRemote();
    cfg.lastSync = Date.now();
    saveCfg();
    setStatus("ok", "Synced");
  } catch (e) {
    setStatus("err", e.message);
    if (e.code === "auth") disconnect(false);
  } finally {
    running = false;
    lastRun = Date.now();
    if (again) { again = false; schedule(500); }
  }
}

export function schedule(delay = 1500) {
  if (!isConnected()) return;
  clearTimeout(timer);
  timer = setTimeout(syncNow, delay);
}

export async function connect(token) {
  token = token.trim();
  if (!token) throw new Error("Paste a token first.");
  cfg = { token, gistId: "", lastSync: 0 };
  setStatus("busy", "Connecting…");
  try {
    let id = await findGist();
    if (!id) {
      const created = await api("/gists", {
        method: "POST",
        body: JSON.stringify({ description: DESCRIPTION, public: false, files: { [FILE]: { content: JSON.stringify(store.snapshot()) } } }),
      });
      id = created.id;
    }
    cfg.gistId = id;
    saveCfg();
    await syncNow();
  } catch (e) {
    cfg = { token: "", gistId: "", lastSync: 0 };
    setStatus("err", e.message);
    throw e;
  }
}

export function disconnect(clearMessage = true) {
  cfg = { token: "", gistId: "", lastSync: 0 };
  try { localStorage.removeItem(CFG_KEY); } catch { /* ignore */ }
  clearTimeout(timer);
  setStatus("off", clearMessage ? "Not connected" : status.message);
}

export function init() {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) cfg = { ...cfg, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  if (isConnected()) {
    setStatus("idle", "Connected");
    syncNow();
  }
  store.onChange((kind) => { if (kind === "marks") schedule(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && isConnected() && Date.now() - lastRun > 20000) syncNow();
    if (document.visibilityState === "hidden" && isConnected()) { clearTimeout(timer); syncNow(); }
  });
  window.addEventListener("online", () => schedule(500));
}
