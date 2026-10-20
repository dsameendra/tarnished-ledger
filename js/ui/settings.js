import * as store from "../lib/store.js";
import * as sync from "../lib/sync.js";
import { $, $$ } from "../lib/dom.js";
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

function paintSync(st) {
  const connected = sync.isConnected();
  const cls = st.state === "ok" || st.state === "idle" ? "on" : st.state;
  $("syncState").className = "sync-state " + cls;
  $("syncState").querySelector("span").textContent = connected && st.state === "ok" && st.at
    ? "Synced " + new Date(st.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : st.message;
  $("connectRow").hidden = connected;
  $("connectedRow").hidden = !connected;
  $("syncPill").hidden = !connected;
  $("syncPill").className = "pill " + cls;
  $("syncPill").querySelector("span").textContent = st.state === "err" ? "Sync problem" : st.state === "busy" ? "Syncing" : "Synced";
  $("syncMsg").textContent = st.state === "err" ? st.message : "";
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

export function initSettings() {
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

  $("connectBtn").addEventListener("click", async () => {
    $("connectBtn").disabled = true;
    try { await sync.connect($("tokenInput").value); $("tokenInput").value = ""; } catch { /* shown by status */ }
    $("connectBtn").disabled = false;
  });
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
    if (!f) return;
    try { say(`Restored ${store.importData(await f.text(), validIds)} done steps.`); refreshBackup(); } catch { say("That file is not a Ledger backup.", true); }
  });
  $("copyBtn").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(code()); say("Code copied."); } catch { $("exportBox").select(); say("Select the code and copy it by hand.", true); }
  });
  $("importBtn").addEventListener("click", () => {
    try { say(`Imported ${store.importData($("importBox").value, validIds)} done steps.`); $("importBox").value = ""; refreshBackup(); } catch { say("That code was not recognised.", true); }
  });

  $("resetBtn").addEventListener("click", () => { $("resetBtn").hidden = true; $("resetConfirm").hidden = false; });
  $("resetNo").addEventListener("click", () => { $("resetBtn").hidden = false; $("resetConfirm").hidden = true; });
  $("resetYes").addEventListener("click", () => {
    store.resetProgress();
    $("resetBtn").hidden = false;
    $("resetConfirm").hidden = true;
    refreshBackup();
  });

  $("sources").innerHTML = SOURCES.map(([n, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${n} ↗</a></li>`).join("");
  paintSettings();
  paintStorage();
  refreshBackup();
}
