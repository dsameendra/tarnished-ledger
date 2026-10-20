// Map tab: a Leaflet viewer (CRS.Simple, one image per world layer) with a canvas marker layer,
// a filter panel, search, and the route phase pins. Leaflet and the map data load on first open.
import * as store from "../lib/store.js";
import { $, emit, on } from "../lib/dom.js";
import { PHASES, tickSteps, currentPhase, phaseLabel, phaseCounts, scope, stepById, wikiUrl } from "../lib/model.js";
import { MAP_LINKS } from "../data/links.js";
import { loadMapData } from "./map-data.js";
import { createMarkerCanvas } from "./map-canvas.js";
import { iconURL } from "./map-glyphs.js";
import * as ms from "./map-state.js";

const LAYER_NAME = { base: "Lands Between", under: "Underground", dlc: "Realm of Shadow" };
let L, map, D, cv, overlay, bounds, pinLayer, routeLayer;
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
    crs: L.CRS.Simple, minZoom: -10, maxZoom: 6, zoomSnap: 0, zoomDelta: 0.5, wheelPxPerZoomLevel: 110,
    zoomControl: false, attributionControl: false, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false,
    inertia: !calm, boxZoom: false, bounceAtZoomLimits: false, maxBoundsViscosity: 0.85, keyboardPanDelta: 120,
  });
  routeLayer = L.layerGroup().addTo(map);
  pinLayer = L.layerGroup().addTo(map);
  map.createPane("route").style.zIndex = 450;
  cv = createMarkerCanvas(L, map, { isFound: ms.isFound });
  enabled = new Set(ms.filter.cats ?? D.cats.filter((c) => c.guide).map((c) => c.id));
  buildPanel();
  wireMap();
  $("mapSearch").disabled = false;
  new ResizeObserver(() => { if (visible()) map.invalidateSize({ animate: false }); }).observe($("map"));
  if (D.dev) window.__tlMap = () => ({ map, cv, D, mode: shown, enabled, selected });
  setMode(mode());
}

// Zoom limits depend on the container size: the minimum is "whole image fits".
function limits() {
  const sz = map.getSize();
  if (!bounds || !sz.x || !sz.y) return null;
  map.setMinZoom(-10);
  const fz = map.getBoundsZoom(bounds, false);
  map.setMinZoom(fz - 0.3);
  map.setMaxZoom(Math.max(fz + 4.5, 1.5));
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
  bounds = L.latLngBounds([[-c.h, 0], [0, c.w]]);
  const load = $("mapLoading");
  load.hidden = false; load.classList.remove("err"); load.textContent = "Loading map…";
  const mine = L.imageOverlay(c.img, bounds, { alt: LAYER_NAME[m] + " map", className: "mapimg" }).addTo(map);
  overlay = mine;
  mine.on("load", () => { if (overlay === mine) load.hidden = true; });
  mine.on("error", () => { if (overlay === mine) imageFailed(); });
  map.setMaxBounds(bounds.pad(0.2));
  const fz = limits();
  const v = ms.views[m];
  if (fz !== null) {
    if (v && Number.isFinite(v.lat)) map.setView([v.lat, v.lng], Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), fz + v.d)), { animate: false });
    else map.setView(bounds.getCenter(), fz, { animate: false });
  }
  restoring = false;
  closeSheet();
  refreshItems();
  refreshPins();
  zoomState();
}

function fitAll() {
  const fz = limits();
  if (fz !== null) map.setView(bounds.getCenter(), fz, { animate: false });
}

function zoomState() {
  if (!map) return;
  const z = map.getZoom();
  $("mapZoom").querySelector('[data-z="in"]').disabled = z >= map.getMaxZoom() - 0.01;
  $("mapZoom").querySelector('[data-z="out"]').disabled = z <= map.getMinZoom() + 0.01;
}

// ---- markers ----

function refreshItems() {
  const f = ms.filter;
  const list = f.on ? D.byLayer[shown].filter((m) => enabled.has(m.cat) && !(f.hideFound && ms.isFound(m.id))) : [];
  cv.setItems(list);
  const n = {};
  for (const m of D.byLayer[shown]) if (!(f.hideFound && ms.isFound(m.id))) n[m.cat] = (n[m.cat] || 0) + 1;
  $("mapPanel").querySelectorAll("[data-n]").forEach((e) => { e.textContent = n[e.dataset.n] || 0; });
  $("mapFilterCount").textContent = f.on ? `· ${list.length}` : "· off";
}

function setCats(ids) {
  enabled = new Set(ids);
  const guide = D.cats.filter((c) => c.guide).map((c) => c.id);
  ms.filter.cats = ids.length === guide.length && guide.every((i) => enabled.has(i)) ? null : [...enabled];
  ms.saveFilter();
  syncPanel();
  refreshItems();
}

function buildPanel() {
  const rows = (g) => D.cats.filter((c) => c.group === g.id).map((c) =>
    `<label class="mp-row"><input type="checkbox" data-cat="${esc(c.id)}"><img src="${iconURL(c.glyph, c.color)}" alt="" width="22" height="22"><span>${esc(c.title)}</span><em data-n="${esc(c.id)}">0</em></label>`).join("");
  $("mapPanel").innerHTML = `
    <div class="mp-h"><b>Markers</b><button type="button" class="mp-x" data-close aria-label="Close marker filters">&times;</button></div>
    <label class="mp-row mp-sw"><input type="checkbox" data-f="on"><span>Show markers</span></label>
    <div class="seg" role="group" aria-label="Marker presets"><button type="button" data-preset="guide">Guide only</button><button type="button" data-preset="all">Everything</button><button type="button" data-preset="none">None</button></div>
    <label class="mp-row"><input type="checkbox" data-f="hideFound"><span>Hide found</span></label>
    <label class="mp-row"><input type="checkbox" data-f="route"><span>Route phases</span></label>
    ${D.groups.map((g) => `<details data-g="${esc(g.id)}" ${ms.filter.collapsed[g.id] ? "" : "open"}><summary>${esc(g.title)}</summary>${rows(g)}</details>`).join("")}
    <p class="note">Found markers are remembered on this device only.</p>`;
  syncPanel();
  setPanel(ms.filter.panel ?? mq("(min-width: 900px)"), false);
}

function syncPanel() {
  const p = $("mapPanel"), f = ms.filter;
  p.querySelectorAll("[data-cat]").forEach((i) => { i.checked = enabled.has(i.dataset.cat); });
  p.querySelectorAll("[data-f]").forEach((i) => { i.checked = Boolean(f[i.dataset.f]); });
  const guide = D.cats.filter((c) => c.guide).map((c) => c.id);
  const cur = enabled.size === 0 ? "none" : enabled.size === D.cats.length ? "all" : enabled.size === guide.length && guide.every((i) => enabled.has(i)) ? "guide" : "";
  p.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === cur)));
}

function setPanel(open, save = true) {
  $("mapPanel").hidden = !open;
  $("mapWrap").classList.toggle("panel-open", open);
  $("mapFilterBtn").setAttribute("aria-expanded", String(open));
  if (save) { ms.filter.panel = open; ms.saveFilter(); }
  if (map) requestAnimationFrame(() => map.invalidateSize({ animate: false }));
}

// ---- route phase pins ----

function refreshPins() {
  if (!map) return;
  pinLayer.clearLayers();
  routeLayer.clearLayers();
  if (!ms.filter.route) return;
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
      icon: L.divIcon({ className: "mp-pin-wrap", html: `<span class="mp-pin ${cls}">${phaseLabel(pi)}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] }),
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
  $("phaseList").addEventListener("click", (e) => {
    const t = e.target.closest("[data-phase]");
    if (t) open(t.dataset.phase);
  });
  $("mapZoom").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || !map) return;
    if (b.dataset.z === "fit") fitAll(); else map.setZoom(map.getZoom() + (b.dataset.z === "in" ? 1 : -1));
  });
  $("mapHere").addEventListener("click", findMe);
  $("mapFilterBtn").addEventListener("click", () => ensureMap().then(() => { if (D) setPanel($("mapPanel").hidden); }));
  $("mapWorld").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || !map) return;
    picked = b.dataset.v;
    saveLayer();
    syncChrome();
    setMode(mode());
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
      ms.filter[t.dataset.f] = t.checked;
      ms.saveFilter();
      refreshItems();
      if (t.dataset.f === "route") refreshPins();
    }
  });
  panel.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.close !== undefined) setPanel(false);
    if (b.dataset.preset) {
      if (b.dataset.preset === "guide") setCats(D.cats.filter((c) => c.guide).map((c) => c.id));
      else setCats(b.dataset.preset === "all" ? D.cats.map((c) => c.id) : []);
      if (b.dataset.preset !== "none" && !ms.filter.on) { ms.filter.on = true; ms.saveFilter(); syncPanel(); refreshItems(); }
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
    if (ms.filter.hideFound) refreshItems(); else cv.redraw();
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
  on("shown", (id) => { if (id === "map") shown_(); });
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
