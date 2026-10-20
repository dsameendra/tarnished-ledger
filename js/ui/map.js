// Map tab: a Leaflet viewer (CRS.Simple, one image per world layer) with a canvas marker layer,
// a filter panel, search, and the route phase pins. Leaflet and the map data load on first open.
import * as store from "../lib/store.js";
import { $, emit, on } from "../lib/dom.js";
import { PHASES, tickSteps, currentPhase, phaseLabel, phaseCounts, scope, stepById, wikiUrl } from "../lib/model.js";
import { MAP_LINKS } from "../data/links.js";
import { PLACES } from "../data/map-places.js";
import { loadMapData } from "./map-data.js";
import { createMarkerCanvas } from "./map-canvas.js";
import { iconURL } from "./map-glyphs.js";
import * as ms from "./map-state.js";
import * as sync from "../lib/sync.js";

const LAYER_NAME = { base: "Lands Between", under: "Underground", dlc: "Realm of Shadow" };
// Non-black region of each image [x0, y0, x1, y1] in image pixels, measured from the art, and the underground sub-maps.
const CONTENT = { base: [20, 8, 1872, 1952], under: [40, 32, 1964, 1916], dlc: [20, 16, 1856, 1932] };
const SUBS = { ainsel: [36, 705, 716, 1936], siofra: [1118, 566, 1967, 1148], deeproot: [726, 57, 1252, 577] };
const box = ([x0, y0, x1, y1]) => [[-y1, x0], [-y0, x1]];
let L, map, D, cv, overlay, bounds, pinLayer, routeLayer, placeLayer;
let fs = false; // maximized view
let fitZ = 0;
let shown = null; // mode on the map: base | under | dlc
let boot = null;
let picked = ms.filter.world || null;
let under = Boolean(ms.filter.under);
let selected = null; // { m } or { phase }
let enabled = new Set();
let dirty = false;
let restoring = false;
let statusTimer = 0;
const mq = (q) => matchMedia(q).matches;

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const visible = () => !$("v-map").hidden;
const phaseDone = (pi) => {
  const l = tickSteps.filter((s) => s.pi === pi);
  return l.length > 0 && l.every((s) => store.isDone(s.id));
};

// Which world is drawn: follows the scope unless the player picked one while both are available.
function world() {
  const sc = scope();
  if (sc === "base") return "base";
  if (sc === "dlc") return "dlc";
  return picked || "base";
}
const mode = () => (world() === "dlc" ? "dlc" : under ? "under" : "base");
const allowed = (layer) => (scope() === "both" || (scope() === "dlc") === (layer === "dlc"));

function saveLayer() {
  ms.filter.world = picked;
  ms.filter.under = under;
  ms.saveFilter();
}

function status(text) {
  $("mapStatus").textContent = text;
  clearTimeout(statusTimer);
  if (text) statusTimer = setTimeout(() => { $("mapStatus").textContent = ""; }, 5000);
}

function loadLeaflet() {
  if (window.L) return Promise.resolve();
  const wait = (el) => new Promise((ok, no) => { el.onload = ok; el.onerror = () => no(new Error("Could not load " + (el.src || el.href))); });
  const css = Object.assign(document.createElement("link"), { rel: "stylesheet", href: "vendor/leaflet/leaflet.css" });
  const js = Object.assign(document.createElement("script"), { src: "vendor/leaflet/leaflet.js" });
  document.head.append(css, js);
  return Promise.all([wait(css), wait(js)]);
}

function fail(e) {
  console.warn("Map failed to load", e);
  boot = null;
  $("mapLoading").hidden = false;
  $("mapLoading").classList.add("err");
  $("mapLoading").innerHTML = `<span>The map could not be loaded. Check your connection, then try again. The route and checklist still work.</span><button type="button" class="btn" id="mapRetry">Try again</button>`;
}

// The map itself is fine; only this layer's image is missing. Retry reloads that layer.
function imageFailed() {
  const el = $("mapLoading");
  el.hidden = false; el.classList.add("err");
  el.innerHTML = `<span>The ${LAYER_NAME[shown]} map image could not be loaded. Check your connection, then try again.</span><button type="button" class="btn" id="mapRetry">Try again</button>`;
}

function ensureMap() {
  if (boot) return boot;
  const el = $("mapLoading");
  el.hidden = false; el.classList.remove("err"); el.textContent = "Loading map…";
  boot = start().catch(fail);
  return boot;
}

async function start() {
  [, D] = await Promise.all([loadLeaflet(), loadMapData()]);
  L = window.L;
  const calm = mq("(prefers-reduced-motion: reduce)");
  map = L.map("map", {
    crs: L.CRS.Simple, minZoom: -10, maxZoom: 6, zoomSnap: 0, zoomDelta: 0.5, wheelPxPerZoomLevel: 90,
    zoomControl: false, attributionControl: false, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false,
    inertia: !calm, boxZoom: false, bounceAtZoomLimits: false, maxBoundsViscosity: 0.85, keyboardPanDelta: 120,
  });
  routeLayer = L.layerGroup().addTo(map);
  map.createPane("places").style.zIndex = 440; // above the marker dots, below the route pins
  map.getPane("places").style.pointerEvents = "none";
  placeLayer = L.layerGroup().addTo(map);
  pinLayer = L.layerGroup().addTo(map);
  map.createPane("route").style.zIndex = 450;
  cv = createMarkerCanvas(L, map, { isFound: ms.isFound });
  enabled = new Set(ms.prefs().cats ?? essentials());
  buildPanel();
  wireMap();
  $("mapSearch").disabled = false;
  $("mapGo").disabled = false;
  new ResizeObserver(() => { if (visible()) map.invalidateSize({ animate: false }); }).observe($("map"));
  if (/[?&]mapdebug\b/.test(location.search)) window.__tlMap = () => ({ map, cv, D, mode: shown, enabled, selected });
  setMode(mode());
}

// Default markers: graces, bosses and the route items. Everything else is one tap away.
const essentials = () => D.cats.filter((c) => c.guide && (c.group === "route" || c.glyph === "grace" || c.group === "bosses")).map((c) => c.id);
const guideCats = () => D.cats.filter((c) => c.guide).map((c) => c.id);

// The stage follows the art's shape so there is no empty band, but never more than the screen allows.
function sizeStage() {
  if (fs) { $("mapWrap").style.removeProperty("--mh"); return; }
  const [x0, y0, x1, y1] = CONTENT[shown];
  const w = $("map").clientWidth;
  if (!w) return;
  const h = Math.max(340, Math.min(w * (y1 - y0) / (x1 - x0), innerHeight - 210, 900));
  $("mapWrap").style.setProperty("--mh", Math.round(h) + "px");
}

// Zoom limits depend on the container size: the minimum is "whole image fits".
function limits() {
  const sz = map.getSize();
  if (!bounds || !sz.x || !sz.y) return null;
  map.setMinZoom(-10);
  const fz = map.getBoundsZoom(bounds, false);
  fitZ = fz;
  map.setMinZoom(fz - 0.3);
  // The art is about 1900px wide, so far beyond native size it is soft, but markers stay exact and it helps on small screens.
  map.setMaxZoom(Math.max(fz + 4.5, 2.5));
  return fz;
}

function saveView() {
  if (restoring || !shown || !bounds) return;
  const fz = map.getBoundsZoom(bounds, false);
  const c = map.getCenter();
  ms.saveView(shown, { lat: c.lat, lng: c.lng, d: map.getZoom() - fz });
}

function setMode(m) {
  restoring = true;
  if (overlay) map.removeLayer(overlay);
  shown = m;
  const c = D.calib[m];
  const imgBounds = L.latLngBounds([[-c.h, 0], [0, c.w]]);
  bounds = L.latLngBounds(box(CONTENT[m]));
  const load = $("mapLoading");
  load.hidden = false; load.classList.remove("err"); load.textContent = "Loading map…";
  const mine = L.imageOverlay(c.img, imgBounds, { alt: LAYER_NAME[m] + " map", className: "mapimg" }).addTo(map);
  overlay = mine;
  mine.on("load", () => { if (overlay === mine) load.hidden = true; });
  mine.on("error", () => { if (overlay === mine) imageFailed(); });
  map.setMaxBounds(bounds.pad(0.15));
  sizeStage();
  map.invalidateSize({ animate: false });
  const fz = limits();
  $("mapSubs").hidden = m !== "under";
  const v = ms.views[m];
  if (fz !== null) {
    if (v && Number.isFinite(v.lat)) map.setView([v.lat, v.lng], Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), fz + v.d)), { animate: false });
    else map.setView(bounds.getCenter(), fz, { animate: false });
  }
  restoring = false;
  closeSheet();
  refreshItems();
  refreshPins();
  buildPlaces();
  drawMini();
  zoomState();
}

function fitAll() {
  const fz = limits();
  if (fz !== null) map.setView(bounds.getCenter(), fz, { animate: false });
}

function zoomState() {
  if (!map) return;
  const z = map.getZoom();
  // Phase pins: small over the whole map, larger when zoomed in.
  const d = Math.max(17, Math.min(30, 17 + (z - map.getMinZoom()) * 3));
  $("map").style.setProperty("--pin", d.toFixed(1) + "px");
  // far: whole map in view, mid: a region, near: close up. Place names fade with this.
  const rel = z - fitZ;
  $("map").dataset.zl = rel < 0.9 ? "far" : rel < 2.2 ? "mid" : "near";
  updateMini();
  $("mapScale").textContent = (2 ** rel).toFixed(rel < 1 ? 1 : 0) + "×";
  $("mapZoom").querySelector('[data-z="in"]').disabled = z >= map.getMaxZoom() - 0.01;
  $("mapZoom").querySelector('[data-z="out"]').disabled = z <= map.getMinZoom() + 0.01;
}

// ---- markers ----

function refreshItems() {
  const f = ms.prefs();
  const list = f.on ? D.byLayer[shown].filter((m) => enabled.has(m.cat) && !(f.hideFound && ms.isFound(m.id))) : [];
  cv.setItems(list);
  const n = {};
  for (const m of D.byLayer[shown]) if (!(f.hideFound && ms.isFound(m.id))) n[m.cat] = (n[m.cat] || 0) + 1;
  $("mapPanel").querySelectorAll("[data-n]").forEach((e) => { e.textContent = n[e.dataset.n] || 0; });
  $("mapFilterCount").textContent = f.on ? `· ${list.length}` : "· off";
}

function setCats(ids) {
  enabled = new Set(ids);
  const def = essentials();
  ms.setPref({ cats: ids.length === def.length && def.every((i) => enabled.has(i)) ? null : [...enabled] });
  syncPanel();
  refreshItems();
}

function buildPanel() {
  const rows = (g) => D.cats.filter((c) => c.group === g.id).map((c) =>
    `<label class="mp-row"><input type="checkbox" data-cat="${esc(c.id)}"><img src="${iconURL(c.glyph, c.color)}" alt="" width="22" height="22"><span>${esc(c.title)}</span><em data-n="${esc(c.id)}">0</em></label>`).join("");
  $("mapPanel").innerHTML = `
    <div class="mp-h"><b>Markers</b><button type="button" class="mp-x" data-close aria-label="Close marker filters">&times;</button></div>
    <label class="mp-row mp-sw"><input type="checkbox" data-f="on"><span>Show markers</span></label>
    <div class="seg" role="group" aria-label="Marker presets"><button type="button" data-preset="essentials">Essentials</button><button type="button" data-preset="guide">Guide</button><button type="button" data-preset="all">Everything</button><button type="button" data-preset="none">None</button></div>
    <label class="mp-row"><input type="checkbox" data-f="hideFound"><span>Hide found</span></label>
    <label class="mp-row"><input type="checkbox" data-f="route"><span>Route phases</span></label>
    ${D.groups.map((g) => `<details data-g="${esc(g.id)}" ${ms.filter.collapsed[g.id] ? "" : "open"}><summary>${esc(g.title)}</summary>${rows(g)}</details>`).join("")}
    <p class="note" id="mapSaveNote"></p>`;
  paintSaveNote();
  syncPanel();
  setPanel(ms.filter.panel ?? mq("(min-width: 900px)"), false);
}

function paintSaveNote() {
  const n = $("mapSaveNote");
  if (!n) return;
  n.innerHTML = sync.isConnected()
    ? "Found markers and these filters sync with your other devices."
    : 'Found markers and filters are saved on this device. <button type="button" class="linklike" data-goto-settings>Turn on sync</button> to see them on your other devices.';
}

// Called when another device changed the filters, or markers were found or cleared elsewhere.
function applyPrefs() {
  if (!map || !D) return;
  enabled = new Set(ms.prefs().cats ?? essentials());
  syncPanel();
  refreshItems();
  refreshPins();
}

function refreshFound() {
  if (!map || !D) return;
  if (ms.prefs().hideFound) refreshItems(); else { refreshItems(); cv.redraw(); }
  if (selected?.m) { const m = selected.m; const box = $("mapSheet").querySelector("[data-found]"); if (box) box.checked = ms.isFound(m.id); }
}

function syncPanel() {
  const p = $("mapPanel"), f = ms.prefs();
  p.querySelectorAll("[data-cat]").forEach((i) => { i.checked = enabled.has(i.dataset.cat); });
  p.querySelectorAll("[data-f]").forEach((i) => { i.checked = Boolean(f[i.dataset.f]); });
  const same = (l) => enabled.size === l.length && l.every((i) => enabled.has(i));
  const cur = enabled.size === 0 ? "none" : enabled.size === D.cats.length ? "all" : same(essentials()) ? "essentials" : same(guideCats()) ? "guide" : "";
  p.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === cur)));
}

function setPanel(open, save = true) {
  $("mapPanel").hidden = !open;
  $("mapWrap").classList.toggle("panel-open", open);
  $("mapFilterBtn").setAttribute("aria-expanded", String(open));
  if (save) { ms.filter.panel = open; ms.saveFilter(); }
  if (map) requestAnimationFrame(() => map.invalidateSize({ animate: false }));
}

// ---- place names, "Go to" and the overview ----

function buildPlaces() {
  placeLayer.clearLayers();
  const list = PLACES[shown] || [];
  for (const [name, x, y, tier] of list) {
    L.marker([-y, x], { pane: "places", interactive: false, keyboard: false, icon: L.divIcon({ className: "mp-place-wrap", html: `<span class="mp-place t${tier}">${esc(name)}</span>`, iconSize: [0, 0] }) }).addTo(placeLayer);
  }
  $("mapGo").innerHTML = `<option value="">Go to&hellip;</option><option value="all">Whole map</option>` + list.map(([n], i) => `<option value="${i}">${esc(n)}</option>`).join("");
}

function goPlace(v) {
  if (!map || v === "") return;
  if (v === "all") { fitAll(); return; }
  const p = (PLACES[shown] || [])[Number(v)];
  if (!p) return;
  const z = Math.min(map.getMaxZoom(), fitZ + 1.9);
  if (mq("(prefers-reduced-motion: reduce)")) map.setView([-p[2], p[1]], z, { animate: false });
  else map.flyTo([-p[2], p[1]], z, { duration: 0.8 });
}

// The overview is a small copy of the art with a box showing what the main map displays.
const mm = { img: null, drag: false };
const miniWanted = () => ms.filter.mini !== false && Boolean(shown) && (fs || $("map").clientWidth >= 700);

function drawMini() {
  const cv2 = $("mmCanvas");
  const [x0, y0, x1, y1] = CONTENT[shown];
  const cw = x1 - x0, ch = y1 - y0;
  let w = fs && mq("(min-width: 700px)") ? 220 : fs ? 124 : 170;
  const room = $("map").clientHeight * 0.3; // never more than a third of the stage, so short screens keep the map
  if (room && (w * ch) / cw > room) w = Math.max(64, Math.floor((room * cw) / ch));
  const h = Math.round((w * ch) / cw);
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv2.width = Math.round(w * dpr); cv2.height = Math.round(h * dpr);
  cv2.style.width = w + "px"; cv2.style.height = h + "px";
  const src = D.calib[shown].img, mode = shown;
  const paint = (img) => { if (shown !== mode) return; const c = cv2.getContext("2d"); c.drawImage(img, x0, y0, x1 - x0, y1 - y0, 0, 0, cv2.width, cv2.height); };
  if (mm.img && mm.img.dataset.src === src && mm.img.complete) paint(mm.img);
  else {
    const img = new Image();
    img.dataset.src = src;
    img.onload = () => { mm.img = img; paint(img); };
    img.src = src;
  }
  updateMini();
}

function updateMini() {
  const box = $("mapMini");
  if (!map || !shown) return;
  const on = miniWanted();
  box.hidden = !on;
  $("mapMiniBtn").setAttribute("aria-pressed", String(ms.filter.mini !== false));
  if (!on) return;
  const [x0, y0, x1, y1] = CONTENT[shown];
  const b = map.getBounds();
  const l = Math.max(x0, b.getWest()), r = Math.min(x1, b.getEast()), t = Math.max(y0, -b.getNorth()), d = Math.min(y1, -b.getSouth());
  const v = $("mmView").style;
  v.left = ((l - x0) / (x1 - x0)) * 100 + "%"; v.top = ((t - y0) / (y1 - y0)) * 100 + "%";
  v.width = Math.max(0, ((r - l) / (x1 - x0)) * 100) + "%"; v.height = Math.max(0, ((d - t) / (y1 - y0)) * 100) + "%";
}

function wireMini() {
  const box = $("mapMini");
  const move = (e) => {
    const r = $("mmCanvas").getBoundingClientRect();
    const [x0, y0, x1, y1] = CONTENT[shown];
    const fx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), fy = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    map.panTo([-(y0 + fy * (y1 - y0)), x0 + fx * (x1 - x0)], { animate: false });
  };
  box.addEventListener("pointerdown", (e) => { e.preventDefault(); mm.drag = true; box.setPointerCapture(e.pointerId); move(e); });
  box.addEventListener("pointermove", (e) => { if (mm.drag) move(e); });
  const end = () => { mm.drag = false; };
  box.addEventListener("pointerup", end);
  box.addEventListener("pointercancel", end);
  map.on("move", updateMini);
}

// ---- maximized view: the map fills the browser window. Browser full screen is left to the user. ----

const outside = () => [...document.querySelectorAll(".rail, .skip, main > section:not(#v-map), #v-map > :not(#mapCard)")];
const focusables = () => [...$("mapCard").querySelectorAll("button, select, input, a[href], summary, [tabindex]:not([tabindex='-1'])")].filter((e) => !e.disabled && !e.closest("[hidden]") && e.getClientRects().length);
let fsReturn = null, panelBefore = null, pushed = false;

function setFs(on, fromHistory = false) {
  if (on === fs || (on && !map)) return;
  fs = on;
  const card = $("mapCard");
  document.documentElement.classList.toggle("map-fs", on);
  card.classList.toggle("fs", on);
  $("mapExit").hidden = !on;
  $("mapFs").setAttribute("aria-pressed", String(on));
  outside().forEach((e) => { e.inert = on; });
  if (on) {
    card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true"); card.setAttribute("aria-label", "Map, maximized");
    fsReturn = document.activeElement;
    panelBefore = !$("mapPanel").hidden;
    setPanel(mq("(min-width: 900px)"), false);
    try { history.pushState({ mapfs: 1 }, ""); pushed = true; } catch { pushed = false; }
    $("mapExit").focus();
  } else {
    card.removeAttribute("role"); card.removeAttribute("aria-modal"); card.removeAttribute("aria-label");
    setPanel(panelBefore ?? mq("(min-width: 900px)"), false);
    if (pushed && !fromHistory) { pushed = false; try { history.back(); } catch { /* ignore */ } } else pushed = false;
    const back = fsReturn && document.contains(fsReturn) ? fsReturn : $("mapFs");
    back.focus?.({ preventScroll: true });
    requestAnimationFrame(() => back.focus?.({ preventScroll: true }));
  }
  if (map) {
    const c = map.getCenter(), z = map.getZoom() - fitZ;
    sizeStage();
    requestAnimationFrame(() => {
      map.invalidateSize({ animate: false });
      limits();
      map.setView(c, Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), fitZ + z)), { animate: false });
      drawMini();
      zoomState();
    });
  }
}

function wireFs() {
  $("mapFs").addEventListener("click", () => ensureMap().then(() => { if (map) setFs(true); }));
  $("mapExit").addEventListener("click", () => setFs(false));
  window.addEventListener("popstate", () => { if (fs) setFs(false, true); });
  $("mapCard").addEventListener("keydown", (e) => {
    if (!fs) return;
    if (e.key === "Tab") {
      const f = focusables();
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener("keydown", (e) => {
    if (!visible() || e.ctrlKey || e.metaKey || e.altKey) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
    if (e.key === "Escape" && fs && $("mapSheet").hidden && $("mapResults").hidden) setFs(false);
    else if (!typing && (e.key === "m" || e.key === "M") && map) setFs(!fs);
    else if (!typing && e.key === "/" && !$("mapSearch").disabled) { e.preventDefault(); $("mapSearch").focus(); }
  });
}

// ---- route phase pins ----

function refreshPins() {
  if (!map) return;
  pinLayer.clearLayers();
  routeLayer.clearLayers();
  if (!ms.prefs().route) return;
  const w = world(), cur = currentPhase();
  const all = PHASES.map((p, pi) => [p, pi, D.byId.get(D.focus[p.id])]).filter(([p, , m]) => Boolean(p.dlc) === (w === "dlc") && m);
  all.slice(1).forEach(([, bi, b], i) => {
    const a = all[i][2];
    if (a.layer !== shown || b.layer !== shown) return;
    const state = cur < 0 || bi <= cur ? "walked" : bi === cur + 1 ? "next" : "ahead";
    L.polyline([[-a.y, a.x], [-b.y, b.x]], { pane: "route", interactive: false, className: "mp-seg " + state }).addTo(routeLayer);
  });
  for (const [p, pi, m] of all) {
    if (m.layer !== shown) continue;
    const cls = [pi === cur ? "cur" : phaseDone(pi) ? "done" : "", selected?.phase === p.id ? "sel" : ""].join(" ");
    const pin = L.marker([-m.y, m.x], {
      icon: L.divIcon({ className: "mp-pin-wrap", html: `<span class="mp-pin ${cls}">${phaseLabel(pi)}</span>`, iconSize: [0, 0] }),
      title: `Phase ${phaseLabel(pi)}: ${p.n}`, riseOnHover: true, zIndexOffset: pi === cur ? 1000 : 0,
    }).on("click", () => showSheet({ phase: p.id })).addTo(pinLayer);
    const el = pin.getElement();
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", `Phase ${phaseLabel(pi)}: ${p.n}`);
  }
}

// ---- detail sheet ----

function closeSheet() {
  selected = null;
  $("mapSheet").hidden = true;
  if (cv) cv.setSelected(null);
  if (map) refreshPins();
}

function showSheet(sel) {
  selected = sel;
  const box = $("mapSheet");
  if (sel.phase) {
    const pi = PHASES.findIndex((p) => p.id === sel.phase);
    const p = PHASES[pi];
    const [d, t] = phaseCounts(pi);
    box.innerHTML = `<button type="button" class="ms-x" data-close aria-label="Close details">&times;</button>
      <div class="ms-h"><span class="ms-num">${phaseLabel(pi)}</span><div><b>${esc(p.n)}</b><small>${esc(p.sub)} · ${d}/${t} steps</small></div></div>
      <div class="ms-act"><button type="button" class="btn primary" data-open="${p.id}">Open in route</button></div>`;
    if (cv) cv.setSelected(null);
  } else {
    const m = sel.m, c = D.catById.get(m.cat);
    const grp = D.groups.find((g) => g.id === c.group);
    const steps = (D.stepsOf.get(m.id) || []).map((id) => stepById.get(id)).filter(Boolean).slice(0, 4);
    const where = LAYER_NAME[m.layer] + (m.sub && m.sub !== "_" ? ` · ${m.sub[0].toUpperCase()}${m.sub.slice(1)}` : "");
    box.innerHTML = `<button type="button" class="ms-x" data-close aria-label="Close details">&times;</button>
      <div class="ms-h"><img src="${iconURL(m.glyph, m.color, 28)}" alt="" width="34" height="34"><div><b>${esc(m.title)}</b><small>${esc(c.title)}${grp ? " · " + esc(grp.title) : ""} · ${esc(where)}</small></div></div>
      ${m.note ? `<p>${esc(m.note)}</p>` : ""}
      <label class="mp-row"><input type="checkbox" data-found="${esc(m.id)}" ${ms.isFound(m.id) ? "checked" : ""}><span>Mark found</span></label>
      <div class="ms-act"><a class="btn" href="${wikiUrl(m.title)}" target="_blank" rel="noopener">Wiki ↗</a>${steps.map((s) => `<button type="button" class="btn" data-step="${s.id}">Show step ${phaseLabel(s.pi)}: ${esc(s.text.length > 36 ? s.text.slice(0, 35) + "…" : s.text)}</button>`).join("")}</div>`;
    if (cv) cv.setSelected(m);
  }
  box.hidden = false;
  if (map) refreshPins();
}

// ---- navigation ----

function goTo(m, rel = 3) {
  if (scope() === "both") picked = m.layer === "dlc" ? "dlc" : "base";
  under = m.layer === "under";
  saveLayer();
  syncChrome();
  if (mode() !== shown) setMode(mode());
  const z = Math.min(map.getMaxZoom(), map.getMinZoom() + 0.3 + rel);
  const ll = [-m.y, m.x];
  if (mq("(prefers-reduced-motion: reduce)")) map.setView(ll, z, { animate: false });
  else map.flyTo(ll, z, { duration: 0.8 });
}

async function findMe() {
  await ensureMap();
  if (!map) return;
  const cur = currentPhase();
  const p = PHASES[cur];
  if (!p) { status("Every step in this scope is done."); return; }
  const m = D.byId.get(D.focus[p.id]);
  if (!m || !allowed(m.layer)) { status(`No map spot recorded for ${p.n} yet.`); return; }
  goTo(m, 2.5);
  showSheet({ phase: p.id });
}

function selectMarker(m) {
  if (!mq("(min-width: 900px)") && !$("mapPanel").hidden) setPanel(false, false);
  showSheet({ m });
}

function search(q) {
  const box = $("mapResults");
  q = q.trim().toLowerCase();
  if (q.length < 2 || !D) { box.hidden = true; box.innerHTML = ""; return; }
  const hits = [];
  for (const m of D.list) {
    if (!allowed(m.layer)) continue;
    const i = m.title.toLowerCase().indexOf(q);
    if (i >= 0) hits.push([i === 0 ? 0 : m.title[i - 1] === " " ? 1 : 2, m]);
  }
  hits.sort((a, b) => a[0] - b[0] || a[1].title.localeCompare(b[1].title));
  box.innerHTML = hits.length
    ? hits.slice(0, 8).map(([, m]) => `<li><button type="button" data-id="${esc(m.id)}"><img src="${iconURL(m.glyph, m.color)}" alt="" width="22" height="22"><b>${esc(m.title)}</b><small>${esc(D.catById.get(m.cat).title)} · ${LAYER_NAME[m.layer]}</small></button></li>`).join("") + (hits.length > 8 ? `<li class="more">${hits.length - 8} more. Keep typing to narrow.</li>` : "")
    : `<li class="more">No markers match.</li>`;
  box.hidden = false;
}

function syncChrome() {
  const sc = scope(), w = world();
  $("mapWorld").hidden = sc !== "both";
  [...$("mapWorld").children].forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === w)));
  $("mapLayer").hidden = w === "dlc";
  [...$("mapLayer").children].forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === (under ? "under" : "base"))));
}

function renderPhaseList() {
  const w = world(), cur = currentPhase();
  $("phaseList").innerHTML = PHASES.map((p, pi) => {
    if (Boolean(p.dlc) !== (w === "dlc")) return "";
    const state = pi === cur ? "cur" : phaseDone(pi) ? "done" : "";
    return `<li><button type="button" class="${state}" data-phase="${p.id}"><b>${phaseLabel(pi)}</b><span>${esc(p.n)}</span></button></li>`;
  }).join("");
}

export function renderMap() {
  syncChrome();
  renderPhaseList();
  if (!D || !map) return;
  if (!visible()) { dirty = true; return; }
  if (selected?.phase && Boolean(PHASES.find((p) => p.id === selected.phase)?.dlc) !== (world() === "dlc")) selected = null;
  if (mode() !== shown) setMode(mode());
  else refreshPins();
}

function wireMap() {
  // Leaflet only synthesises double-clicks for mouse input, so touch gets its own double-tap zoom.
  let down = null, lastTap = null;
  const host = map.getContainer();
  host.addEventListener("pointerdown", (e) => { down = e.pointerType === "touch" && e.isPrimary ? { x: e.clientX, y: e.clientY, t: e.timeStamp } : null; });
  host.addEventListener("pointerup", (e) => {
    const d = down;
    down = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10 || e.timeStamp - d.t > 350) return;
    if (lastTap && e.timeStamp - lastTap.t < 400 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
      lastTap = null;
      map.setZoomAround(map.mouseEventToContainerPoint(e), Math.min(map.getMaxZoom(), map.getZoom() + 1));
    } else lastTap = { t: e.timeStamp, x: e.clientX, y: e.clientY };
  });
  map.on("click", (e) => {
    const m = cv.hit(e.containerPoint, cv.tol());
    if (m) selectMarker(m); else closeSheet();
  });
  wireMini();
  map.on("moveend zoomend", () => { saveView(); zoomState(); });
  map.on("resize", () => { if (!restoring) { const c = map.getCenter(); limits(); map.setView(c, Math.max(map.getZoom(), map.getMinZoom()), { animate: false }); } });
  const tip = $("mapTip"), el = map.getContainer();
  let raf = 0;
  el.addEventListener("mousemove", (e) => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const pt = L.point(e.clientX - r.left, e.clientY - r.top);
      const m = cv.hit(pt, 12);
      el.style.cursor = m ? "pointer" : "";
      tip.hidden = !m;
      if (m) { tip.textContent = m.title; tip.style.left = pt.x + 14 + "px"; tip.style.top = pt.y + 14 + "px"; }
    });
  });
  el.addEventListener("mouseleave", () => { $("mapTip").hidden = true; });
}

export function initMap() {
  $("mapLinks").innerHTML = "More interactive maps: " + MAP_LINKS.map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${n} ↗</a>`).join(" · ");
  const open = (id) => emit("phase", id);
  store.onChange((kind, detail) => {
    if (kind === "found") refreshFound();
    else if (kind === "mapprefs" && detail !== "local") applyPrefs();
  });
  sync.onStatus(paintSaveNote);
  $("phaseList").addEventListener("click", (e) => {
    const t = e.target.closest("[data-phase]");
    if (t) open(t.dataset.phase);
  });
  $("mapZoom").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || !map) return;
    if (b.dataset.z === "mini") { ms.filter.mini = ms.filter.mini === false; ms.saveFilter(); updateMini(); }
    else if (b.dataset.z === "fit") fitAll(); else map.setZoom(map.getZoom() + (b.dataset.z === "in" ? 1 : -1));
  });
  $("mapHere").addEventListener("click", findMe);
  $("mapGo").addEventListener("change", (e) => { goPlace(e.target.value); e.target.value = ""; });
  wireFs();
  $("mapFilterBtn").addEventListener("click", () => ensureMap().then(() => { if (D) setPanel($("mapPanel").hidden); }));
  $("mapWorld").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || !map) return;
    picked = b.dataset.v;
    saveLayer();
    syncChrome();
    setMode(mode());
  });
  $("mapSubs").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || !map) return;
    const o = { padding: [10, 10], animate: !mq("(prefers-reduced-motion: reduce)"), duration: 0.7 };
    if (b.dataset.v === "all") fitAll(); else map.flyToBounds(box(SUBS[b.dataset.v]), o);
  });
  window.addEventListener("resize", () => {
    if (!map || !visible()) return;
    sizeStage();
    map.invalidateSize({ animate: false });
  });
  $("mapLayer").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || !map) return;
    under = b.dataset.v === "under";
    saveLayer();
    syncChrome();
    setMode(mode());
  });
  $("mapLoading").addEventListener("click", (e) => {
    if (e.target.id !== "mapRetry") return;
    if (map) setMode(shown); else ensureMap();
  });

  const panel = $("mapPanel");
  panel.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.cat) setCats(t.checked ? [...enabled, t.dataset.cat] : [...enabled].filter((i) => i !== t.dataset.cat));
    else if (t.dataset.f) {
      ms.setPref({ [t.dataset.f]: t.checked });
      refreshItems();
      if (t.dataset.f === "route") refreshPins();
    }
  });
  panel.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.gotoSettings !== undefined) { if (fs) setFs(false); emit("tab", "set"); return; }
    if (b.dataset.close !== undefined) setPanel(false);
    if (b.dataset.preset) {
      if (b.dataset.preset === "essentials") setCats(essentials());
      else if (b.dataset.preset === "guide") setCats(guideCats());
      else setCats(b.dataset.preset === "all" ? D.cats.map((c) => c.id) : []);
      if (b.dataset.preset !== "none" && !ms.prefs().on) { ms.setPref({ on: true }); syncPanel(); refreshItems(); }
    }
  });
  panel.addEventListener("toggle", (e) => {
    if (e.target.dataset.g) { ms.filter.collapsed[e.target.dataset.g] = !e.target.open; ms.saveFilter(); }
  }, true);

  const sheet = $("mapSheet");
  sheet.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.close !== undefined) closeSheet();
    if (b.dataset.open) emit("phase", b.dataset.open);
    if (b.dataset.step) emit("jump", b.dataset.step);
  });
  sheet.addEventListener("change", (e) => {
    if (!e.target.dataset.found) return;
    ms.setFound(e.target.dataset.found, e.target.checked);
    if (ms.prefs().hideFound) refreshItems(); else cv.redraw();
  });

  const input = $("mapSearch");
  input.addEventListener("input", () => search(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { input.value = ""; search(""); }
    if (e.key === "Enter") $("mapResults").querySelector("button")?.click();
    if (e.key === "ArrowDown") { e.preventDefault(); $("mapResults").querySelector("button")?.focus(); }
  });
  $("mapResults").addEventListener("keydown", (e) => {
    const bs = [...$("mapResults").querySelectorAll("button")];
    const i = bs.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); bs[Math.min(i + 1, bs.length - 1)]?.focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); (i > 0 ? bs[i - 1] : input).focus(); }
    if (e.key === "Escape") input.focus();
  });
  $("mapResults").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-id]");
    const m = b && D.byId.get(b.dataset.id);
    if (!m) return;
    $("mapResults").hidden = true;
    input.value = m.title;
    goTo(m);
    selectMarker(m);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && visible() && !$("mapSheet").hidden) closeSheet();
  });

  const shown_ = () => {
    if (!visible()) return;
    // On phones the header sits above the map, so bring the toolbar to the top.
    if (!mq("(min-width: 980px)")) document.querySelector("#v-map .mapcard").scrollIntoView({ block: "start", behavior: "auto" });
    ensureMap().then(() => {
      if (!map) return;
      map.invalidateSize({ animate: false });
      if (mode() !== shown) setMode(mode());
      else { refreshPins(); zoomState(); }
      dirty = false;
    });
  };
  on("shown", (id) => { if (id === "map") shown_(); else if (fs) setFs(false); });
  // Route steps can emit("locate", stepId) to open the map at the step's first location.
  on("locate", async (stepId) => {
    emit("tab", "map");
    await ensureMap();
    const m = map && (D.stepLocs[stepId] || []).map((i) => D.byId.get(i)).find((x) => x && allowed(x.layer));
    if (!m) return;
    map.invalidateSize({ animate: false });
    goTo(m);
    selectMarker(m);
  });
  if (visible()) shown_();
}
