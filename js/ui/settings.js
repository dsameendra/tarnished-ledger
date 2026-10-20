import * as store from "../lib/store.js";
import * as sync from "../lib/sync.js";
import { $, $$, emit, on } from "../lib/dom.js";
import { currentTab } from "./nav.js";
import { validIds } from "../lib/model.js";
import { SOURCES } from "../data/links.js";

let deferredInstall = null;

function paintControls() {
  $$("[data-set]").forEach((box) => {
    const v = store.setting(box.dataset.set);
    $$("button", box).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === String(v))));
  });
  $$("[data-sw]").forEach((b) => b.setAttribute("aria-checked", String(Boolean(store.setting(b.dataset.sw)))));
  $("focusRow").hidden = !store.setting("dlc");
}

export function applyTheme() {
  const r = document.documentElement;
  const mode = store.setting("mode");
  if (mode === "system") delete r.dataset.mode; else r.dataset.mode = mode;
  r.dataset.accent = store.setting("accent");
  r.dataset.size = store.setting("size");
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  const color = dark ? "#13120d" : "#f4efe1";
  $$('meta[name="theme-color"]').forEach((m) => { m.content = color; });
}

export function paintSettings() {
  paintControls();
  applyTheme();
}

export function paintStorage() {
  $("savePill").classList.toggle("err", !store.isStorageOK());
  $("savePill").querySelector("span").textContent = store.isStorageOK() ? "Saved on this device" : "Not saving: storage blocked";
  $("storeStatus").textContent = store.isStorageOK()
    ? "Every tick saves instantly in this browser."
    : "This browser is blocking storage, so ticks will be lost when you close the page. Turn off private browsing, or use sync or a backup.";
  paintWelcome();
}

export function paintWake(state) {
  const pill = $("wakePill");
  pill.hidden = state === "off" && !store.setting("awake");
  pill.classList.toggle("on", state === "on");
  const text = { on: "Screen stays on", off: "Screen may dim", unsupported: "Keep-awake unsupported", blocked: "Keep-awake blocked" }[state];
  pill.querySelector("span").textContent = text;
  $("wakeHint").textContent = state === "unsupported"
    ? "This browser does not support keeping the screen on. iPhone needs iOS 18.4 or later for the home-screen app."
    : "Stops the screen dimming while this page is open.";
}

const SYNC_HELP = [
  [/token/i, "Create a new classic token with the gist scope and connect again."],
  [/offline/i, "Your ticks are safe here and will sync once you are back online."],
  [/rate limit/i, "Wait a few minutes, then press Sync now."],
];

function paintSync(st) {
  const connected = sync.isConnected();
  const failed = st.state === "err" || (st.state === "off" && st.message !== "Not connected");
  const cls = st.state === "ok" || st.state === "idle" ? "on" : failed ? "err" : st.state;
  const time = st.at ? new Date(st.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  const label = failed ? "Sync problem"
    : st.state === "busy" ? st.message
    : connected ? (st.state === "ok" && time ? "Connected, last synced " + time : "Connected")
    : "Not connected. Progress stays on this device.";
  $("syncState").className = "sync-state " + cls;
  $("syncState").querySelector("span").textContent = label;
  $("connectRow").hidden = connected;
  $("connectedRow").hidden = !connected;
  $("syncBtn").disabled = st.state === "busy";
  $("syncPill").hidden = !connected;
  $("syncPill").className = "pill " + cls;
  $("syncPill").querySelector("span").textContent = failed ? "Sync problem" : st.state === "busy" ? "Syncing" : "Synced";
  const help = failed && SYNC_HELP.find(([re]) => re.test(st.message));
  $("syncMsg").className = "msg" + (failed ? " err" : "");
  $("syncMsg").textContent = failed ? st.message + (help ? " " + help[1] : "") : "";
}

function say(text, bad = false) {
  const el = $("ioMsg");
  el.textContent = text;
  el.className = "msg" + (bad ? " bad" : "");
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const code = () => "ER1:" + btoa(store.doneIds().join(","));

export function refreshBackup() {
  $("exportBox").value = code();
  const t = store.get().lastBackup;
  $("backupHint").textContent = t ? "Last backup: " + new Date(t).toLocaleString() : "Download a file you can keep anywhere, or copy a short code.";
}

let pending = null;

function restore(text, kind) {
  try { say(`Restored ${store.importData(text, validIds)} done steps from the ${kind}.`); if (kind === "code") $("importBox").value = ""; refreshBackup(); }
  catch { say(kind === "file" ? "That file is not a Ledger backup." : "That code was not recognised.", true); }
}

function askRestore(text, kind) {
  const n = store.doneIds().length;
  if (!n) return restore(text, kind);
  pending = { text, kind };
  say("");
  $("restoreText").textContent = `Restoring replaces the ${n} done step${n === 1 ? "" : "s"} on this device with the ${kind}'s progress${sync.isConnected() ? " and syncs to your other devices" : ""}.`;
  $("restoreConfirm").hidden = false;
  $("restoreNo").focus();
}

const WELCOME = "tarnished-ledger:welcome";
const seen = () => { try { return Boolean(localStorage.getItem(WELCOME)); } catch { return true; } };

function paintWelcome() {
  $("welcome").hidden = seen() || currentTab() !== "route" || store.doneIds().length > 0;
}

function dismissWelcome() {
  try { localStorage.setItem(WELCOME, "1"); } catch { /* ignore */ }
  paintWelcome();
}

function tabPanels() {
  const tabs = () => $$("#tabs button");
  const wire = () => {
    tabs().forEach((b) => {
      b.id = "tab-" + b.dataset.tab;
      const panel = $("v-" + b.dataset.tab);
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", b.id);
    });
  };
  new MutationObserver(wire).observe($("tabs"), { childList: true, subtree: true, attributeFilter: ["aria-selected"] });
  wire();
}

export function initSettings() {
  tabPanels();
  $$(".skip").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); $("main").focus(); }));
  $("welcomeOk").addEventListener("click", dismissWelcome);
  $("welcomeSet").addEventListener("click", () => { dismissWelcome(); emit("tab", "set"); });
  on("shown", paintWelcome);

  $$("[data-set]").forEach((box) => box.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) store.setSetting(box.dataset.set, b.dataset.v);
  }));
  $$("[data-sw]").forEach((b) => b.addEventListener("click", () => store.setSetting(b.dataset.sw, !store.setting(b.dataset.sw))));

  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstall = e;
    $("installBtn").hidden = false;
  });
  $("installBtn").addEventListener("click", async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    $("installBtn").hidden = true;
  });
  if (matchMedia("(display-mode: standalone)").matches || navigator.standalone) {
    $("installHint").textContent = "Installed. You are running it as an app.";
  }

  const connect = async () => {
    $("connectBtn").disabled = true;
    try { await sync.connect($("tokenInput").value); $("tokenInput").value = ""; } catch (e) { $("syncMsg").className = "msg err"; $("syncMsg").textContent = e.message; }
    $("connectBtn").disabled = false;
  };
  $("connectBtn").addEventListener("click", connect);
  $("tokenInput").addEventListener("keydown", (e) => { if (e.key === "Enter") connect(); });
  $("syncBtn").addEventListener("click", () => sync.syncNow());
  $("disconnectBtn").addEventListener("click", () => sync.disconnect());
  sync.onStatus(paintSync);

  $("exportFile").addEventListener("click", () => {
    download(`tarnished-ledger-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(store.snapshot(), null, 1));
    store.markBackup();
    refreshBackup();
    say("Backup downloaded.");
  });
  $("importFileBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (f) askRestore(await f.text(), "file");
  });
  $("copyBtn").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(code()); say("Code copied."); } catch { $("exportBox").select(); say("Select the code and copy it by hand.", true); }
  });
  $("importBtn").addEventListener("click", () => askRestore($("importBox").value, "code"));
  $("restoreYes").addEventListener("click", () => { $("restoreConfirm").hidden = true; restore(pending.text, pending.kind); });
  $("restoreNo").addEventListener("click", () => { $("restoreConfirm").hidden = true; say("Restore cancelled. Nothing changed."); });

  $("resetBtn").addEventListener("click", () => {
    const n = store.doneIds().length;
    if (!n) { $("resetMsg").textContent = "Nothing to clear yet."; return; }
    $("resetMsg").textContent = "";
    $("resetText").textContent = `Clear ${n} done step${n === 1 ? "" : "s"} on this device? This cannot be undone${sync.isConnected() ? " and will sync to your other devices" : ""}.`;
    $("resetBtn").hidden = true;
    $("resetConfirm").hidden = false;
    $("resetNo").focus();
  });
  const closeReset = () => { $("resetBtn").hidden = false; $("resetConfirm").hidden = true; $("resetBtn").focus(); };
  $("resetNo").addEventListener("click", closeReset);
  $("resetConfirm").addEventListener("keydown", (e) => { if (e.key === "Escape") closeReset(); });
  $("resetYes").addEventListener("click", () => {
    store.resetProgress([...validIds]);
    closeReset();
    $("resetMsg").textContent = "Progress cleared.";
    refreshBackup();
  });

  $("sources").innerHTML = SOURCES.map(([n, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${n} ↗</a></li>`).join("");
  paintSettings();
  paintStorage();
  refreshBackup();
}
