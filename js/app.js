import * as store from "./lib/store.js";
import * as sync from "./lib/sync.js";
import * as wake from "./lib/wake.js";
import { initUpdates } from "./lib/update.js";
import { validIds } from "./lib/model.js";
import { renderRail, initRail } from "./ui/rail.js";
import { initToast } from "./ui/toast.js";
import { renderRoute, applyView, updateRoute, ensureCurrentOpen, initRoute } from "./ui/route.js";
import { renderTrophies, renderCollect, renderCounters, initLists } from "./ui/lists.js";
import { renderMap, initMap } from "./ui/map.js";
import { renderGuide, initGuide } from "./ui/guide.js";
import { initNav, renderNav, currentTab } from "./ui/nav.js";
import { on } from "./lib/dom.js";
import { initSettings, paintSettings, paintStorage, paintWake, refreshBackup } from "./ui/settings.js";

const PREP_STEP = "prep.5";

// Trophies, Legendary and the map are only drawn while their tab is showing. A change made elsewhere marks them
// stale, and the "shown" event from the nav draws them the moment the tab opens.
const LAZY = { tro: renderTrophies, col: renderCollect, map: renderMap };
const stale = new Set();
function renderTab(id) {
  if (currentTab() === id) { stale.delete(id); LAZY[id](); } else stale.add(id);
}
function renderLazy() { for (const id of Object.keys(LAZY)) renderTab(id); }

function renderAll() {
  renderRail();
  renderRoute();
  renderLazy();
  renderGuide();
  ensureCurrentOpen();
}

function onMarks() {
  renderRail();
  updateRoute();
  renderLazy();
  paintStorage();
  refreshBackup();
}

function onCounters() {
  renderRail();
  renderCounters();
}

function onSetting(key) {
  paintSettings();
  if (["platform", "dlc", "focus"].includes(key)) { renderNav(); renderAll(); return; }
  if (["hide", "tips", "compact"].includes(key)) applyView();
  if (key === "autoopen") ensureCurrentOpen();
  if (key === "awake") wake.update(store.setting("awake"), paintWake);
}

function boot() {
  store.load();
  // The setup step in phase 0 is new: anyone who has already started the run has read the setup.
  if (store.doneIds().length && !store.get().marks[PREP_STEP]) store.setDone(PREP_STEP, true);
  initNav();
  on("shown", (id) => { if (stale.delete(id)) LAZY[id](); });
  initRoute();
  initToast();
  initRail();
  initLists();
  initGuide();
  initMap();
  initSettings();
  renderAll();
  store.onChange((kind, detail) => (kind === "marks" ? onMarks() : kind === "counters" ? onCounters() : onSetting(detail)));
  sync.init({ validIds });
  wake.update(store.setting("awake"), paintWake);
  document.addEventListener("visibilitychange", () => wake.update(store.setting("awake"), paintWake));
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  initUpdates();
}

boot();
