import * as store from "../lib/store.js";
import { $, emit, on } from "../lib/dom.js";
import { PHASES, tickSteps, currentPhase, phaseLabel, phaseCounts, scope } from "../lib/model.js";
import { REGIONS, UNDERGROUND, PINS, DLC_PINS, DLC_EDGES, DLC_LABELS } from "../data/map.js";
import { MAP_LINKS } from "../data/links.js";

// The sketch data is authored in a 320x290 space; the base map draws it at 2x so text and pins stay legible.
const K = 2;
const W = 640;
const ZOOMS = [1, 1.5, 2, 3];
const PIN_R = 13;

let layer = "both";
let picked = null;
let selected = null;
let zoom = null; // null = fit the card width
let recenter = true;

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

// Push pins apart so numbers never sit on top of each other.
function spread(items, minDist, w, h, boxes = []) {
  const pts = items.map(([id, x, y]) => ({ id, x, y }));
  for (let n = 0; n < 80; n++) {
    let moved = false;
    for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) {
      const dx = pts[b].x - pts[a].x, dy = pts[b].y - pts[a].y;
      const d = Math.hypot(dx, dy) || 0.01;
      if (d >= minDist) continue;
      const push = (minDist - d) / 2, ux = dx / d || 1, uy = dy / d;
      pts[a].x -= ux * push; pts[a].y -= uy * push;
      pts[b].x += ux * push; pts[b].y += uy * push;
      moved = true;
    }
    for (const p of pts) for (const [bx, by, hw, hh] of boxes) {
      const ox = hw + PIN_R - Math.abs(p.x - bx), oy = hh + PIN_R - Math.abs(p.y - by);
      if (ox > 0 && oy > 0) { p.y += p.y >= by ? oy : -oy; moved = true; }
    }
    pts.forEach((p) => { p.x = Math.max(PIN_R + 2, Math.min(w - PIN_R - 2, p.x)); p.y = Math.max(PIN_R + 2, Math.min(h - PIN_R - 2, p.y)); });
    if (!moved) break;
  }
  return Object.fromEntries(pts.map((p) => [p.id, [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]]));
}

function pinHTML(p, pi, q, cur) {
  const cls = [pi === cur ? "cur" : phaseDone(pi) ? "done" : "", selected === p.id ? "sel" : ""].join(" ");
  const lbl = phaseLabel(pi);
  return `<g class="pin ${cls}" data-pin="${p.id}" tabindex="0" role="button" aria-label="Phase ${lbl}: ${p.n}">${pi === cur ? `<circle class="halo" cx="${q[0]}" cy="${q[1]}" r="${PIN_R}"/>` : ""}${selected === p.id ? `<circle class="ring-sel" cx="${q[0]}" cy="${q[1]}" r="${PIN_R + 5}"/>` : ""}<circle class="dot" cx="${q[0]}" cy="${q[1]}" r="${PIN_R}"/><text x="${q[0]}" y="${q[1] + 5}">${lbl}</text></g>`;
}

function baseSVG(cur) {
  const H = 290 * K;
  const list = PHASES.map((p, pi) => [p, pi]).filter(([p]) => !p.dlc && PINS[p.id]);
  const boxes = [
    ...REGIONS.map(([n, x, y, rx, ry]) => [x * K, (y - ry) * K + 16, n.length * 5.2, 9]),
    ...UNDERGROUND.filter(([n]) => !n.startsWith("Siofra")).map(([n, x, y, rx, ry]) => [x * K, (y + ry) * K + 13, n.length * 3.4, 8]),
  ];
  const pos = spread(list.map(([p]) => [p.id, PINS[p.id][0] * K, PINS[p.id][1] * K]), PIN_R * 2.4, W, H, boxes);
  let h = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Schematic map of the Lands Between with the route phases" class="${layer === "under" ? "dim" : ""} ${layer === "surface" ? "hide-under" : ""}">`;
  REGIONS.forEach(([n, x, y, rx, ry]) => { h += `<ellipse class="rg" cx="${x * K}" cy="${y * K}" rx="${rx * K}" ry="${ry * K}"/>`; });
  UNDERGROUND.forEach(([n, x, y, rx, ry]) => { h += `<ellipse class="rg under" cx="${x * K}" cy="${y * K}" rx="${rx * K}" ry="${ry * K}"/>`; });
  REGIONS.forEach(([n, x, y, rx, ry]) => { h += `<text class="rl" x="${x * K}" y="${(y - ry) * K + 20}">${n.toUpperCase()}</text>`; });
  UNDERGROUND.forEach(([n, x, y, rx, ry]) => {
    // Siofra sits right under Weeping Peninsula's label, so its label goes to the left of the outline.
    h += n.startsWith("Siofra") ? `<text class="rl u" x="${(x - rx) * K - 6}" y="${y * K + 4}" text-anchor="end">${n}</text>` : `<text class="rl u" x="${x * K}" y="${(y + ry) * K + 17}">${n}</text>`;
  });
  // Route path: solid for the part already walked, dashed for what is ahead.
  const segs = list.slice(1).map(([p, pi], i) => [list[i], [p, pi]]);
  segs.forEach(([[a], [b, bi]]) => {
    const [x1, y1] = pos[a.id], [x2, y2] = pos[b.id];
    const state = cur < 0 || bi <= cur ? "walked" : bi === cur + 1 ? "next" : "";
    h += `<line class="seg-l ${state}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  });
  list.forEach(([p, pi]) => { h += pinHTML(p, pi, pos[p.id], cur); });
  return [h + "</svg>", pos];
}

function dlcSVG(cur) {
  const H = 500;
  let h = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Graph of Shadow of the Erdtree areas and how they connect">`;
  DLC_EDGES.forEach(([a, b]) => { h += `<line class="edge" x1="${DLC_PINS[a][0]}" y1="${DLC_PINS[a][1]}" x2="${DLC_PINS[b][0]}" y2="${DLC_PINS[b][1]}"/>`; });
  const list = PHASES.map((p, pi) => [p, pi]).filter(([p]) => p.dlc && DLC_PINS[p.id]);
  list.forEach(([p, pi]) => { h += pinHTML(p, pi, DLC_PINS[p.id], cur); });
  list.forEach(([p]) => {
    const [x, y] = DLC_PINS[p.id];
    h += `<text class="rl pl" x="${x}" y="${p.id === "d0" ? y - PIN_R - 8 : y + PIN_R + 17}">${DLC_LABELS[p.id] || p.n}</text>`;
  });
  if (DLC_PINS.d8) h += `<text class="rl pl sub" x="${DLC_PINS.d8[0]}" y="${DLC_PINS.d8[1] + PIN_R + 30}">connection not documented</text>`;
  return [h + "</svg>", DLC_PINS];
}

function pickCard(pos) {
  const box = $("mapPick");
  const pi = PHASES.findIndex((p) => p.id === selected);
  if (pi < 0 || !pos[selected]) { box.hidden = true; return; }
  const p = PHASES[pi];
  const [d, t] = phaseCounts(pi);
  box.hidden = false;
  box.innerHTML = `<span class="pk-num">${phaseLabel(pi)}</span><div class="pk-txt"><b>${p.n}</b><small>${p.sub} · ${d}/${t} steps</small></div><button type="button" class="btn primary" data-open="${p.id}">Open in route</button>`;
}

export function renderMap() {
  const w = world();
  const cur = currentPhase();
  const sc = scope();
  const host = $("map");
  const keepL = host.scrollLeft, keepT = host.scrollTop;
  $("mapWorld").hidden = sc !== "both";
  [...$("mapWorld").children].forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === w)));
  $("mapLayer").hidden = w === "dlc";
  $("legUnder").hidden = w === "dlc";
  $("mapNote").textContent = w === "dlc"
    ? "Shadow of the Erdtree as a graph of area connections, not a geographic map. Lines show which areas lead to which. Tap a node for details."
    : "A schematic of the Lands Between, not to scale. Numbers follow the route phases and the line shows your path. Tap a number for details; pinch or use + and − to zoom.";
  if (selected && !PHASES.some((p) => p.id === selected && Boolean(p.dlc) === (w === "dlc"))) selected = null;

  const [svg, pos] = w === "dlc" ? dlcSVG(cur) : baseSVG(cur);
  host.innerHTML = svg;
  const el = host.firstElementChild;
  const fit = zoom === null;
  el.style.width = fit ? "100%" : W * zoom + "px";
  el.style.minWidth = fit ? "" : W * zoom + "px";
  $("mapZoom").querySelector('[data-z="out"]').disabled = !fit && zoom <= ZOOMS[0];
  $("mapZoom").querySelector('[data-z="in"]').disabled = !fit && zoom >= ZOOMS[ZOOMS.length - 1];
  $("mapZoom").querySelector('[data-z="fit"]').setAttribute("aria-pressed", String(fit));
  pickCard(pos);

  if (recenter) {
    recenter = false;
    const target = pos[selected] || (cur >= 0 && PHASES[cur] && pos[PHASES[cur].id]);
    const scale = el.getBoundingClientRect().width / W;
    host.scrollLeft = target ? target[0] * scale - host.clientWidth / 2 : 0;
    host.scrollTop = target ? target[1] * scale - host.clientHeight / 2 : 0;
  } else {
    host.scrollLeft = keepL;
    host.scrollTop = keepT;
  }

  $("phaseList").innerHTML = PHASES.map((p, pi) => {
    if (Boolean(p.dlc) !== (w === "dlc")) return "";
    const state = pi === cur ? "cur" : phaseDone(pi) ? "done" : "";
    return `<li><button type="button" class="${state}" data-phase="${p.id}"><b>${phaseLabel(pi)}</b><span>${p.n}</span></button></li>`;
  }).join("");
}

function setZoom(dir) {
  const host = $("map");
  const el = host.firstElementChild;
  const cur = zoom === null ? el.getBoundingClientRect().width / W : zoom;
  if (dir === "fit") zoom = null;
  else {
    const next = dir === "in" ? ZOOMS.find((z) => z > cur + 0.01) : [...ZOOMS].reverse().find((z) => z < cur - 0.01);
    zoom = next ?? (dir === "in" ? ZOOMS[ZOOMS.length - 1] : ZOOMS[0]);
  }
  recenter = true;
  renderMap();
}

export function initMap() {
  $("mapLinks").innerHTML = "For exact spots use an interactive map: " + MAP_LINKS.map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${n} ↗</a>`).join(" · ");
  zoom = matchMedia("(max-width: 700px)").matches ? 1 : null;
  const pick = (e) => {
    const t = e.target.closest("[data-pin]");
    if (!t) return;
    selected = selected === t.dataset.pin ? null : t.dataset.pin;
    renderMap();
  };
  $("map").addEventListener("click", pick);
  $("map").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(e); } });
  $("mapPick").addEventListener("click", (e) => {
    const b = e.target.closest("[data-open]");
    if (b) emit("phase", b.dataset.open);
  });
  $("phaseList").addEventListener("click", (e) => {
    const t = e.target.closest("[data-phase]");
    if (t) emit("phase", t.dataset.phase);
  });
  $("mapZoom").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b && !b.disabled) setZoom(b.dataset.z);
  });
  $("mapHere").addEventListener("click", () => { selected = null; recenter = true; renderMap(); });
  $("mapWorld").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    picked = b.dataset.v;
    selected = null;
    recenter = true;
    renderMap();
  });
  $("mapLayer").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    layer = b.dataset.v;
    [...$("mapLayer").children].forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    renderMap();
  });
  on("shown", (id) => { if (id === "map") { recenter = true; renderMap(); } });
}
