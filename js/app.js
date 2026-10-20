import * as store from "./lib/store.js";
import * as sync from "./lib/sync.js";
import * as wake from "./lib/wake.js";
import { renderRail } from "./ui/rail.js";
import { renderRoute, applyView, updateRoute, ensureCurrentOpen, initRoute } from "./ui/route.js";
import { renderTrophies, renderCollect, initLists } from "./ui/lists.js";
import { renderMap, initMap } from "./ui/map.js";
import { renderGuide } from "./ui/guide.js";
import { initNav } from "./ui/nav.js";
import { initSettings, paintSettings, paintStorage, paintWake, refreshBackup } from "./ui/settings.js";

function renderAll() {
  renderRail();
  renderRoute();
  renderTrophies();
  renderCollect();
  renderMap();
  renderGuide();
  ensureCurrentOpen();
}

function onMarks() {
  renderRail();
  updateRoute();
  renderTrophies();
  renderCollect();
  renderMap();
  paintStorage();
  refreshBackup();
}

function onSetting(key) {
  paintSettings();
  if (key === "platform") { renderAll(); return; }
  if (["hide", "tips", "compact"].includes(key)) applyView();
  if (key === "autoopen") ensureCurrentOpen();
  if (key === "awake") wake.update(store.setting("awake"), paintWake);
}

function boot() {
  store.load();
  initNav();
  initRoute();
  initLists();
  initMap();
  initSettings();
  renderAll();
  store.onChange((kind, detail) => (kind === "marks" ? onMarks() : onSetting(detail)));
  sync.init();
  wake.update(store.setting("awake"), paintWake);
  document.addEventListener("visibilitychange", () => wake.update(store.setting("awake"), paintWake));
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

boot();
