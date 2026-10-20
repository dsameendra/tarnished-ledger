import * as store from "../lib/store.js";
import { $, emit } from "../lib/dom.js";
import { PHASES, tickSteps, currentPhase, phaseLabel, scope } from "../lib/model.js";
import { REGIONS, UNDERGROUND, PINS, DLC_PINS, DLC_EDGES } from "../data/map.js";
import { MAP_LINKS } from "../data/links.js";

let layer = "both";
let picked = null;

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

function pinHTML(p, pi, q, cur) {
  const cls = pi === cur ? "cur" : phaseDone(pi) ? "done" : "";
  const lbl = phaseLabel(pi);
  return `<g class="pin ${cls}" data-phase="${p.id}" tabindex="0" role="button" aria-label="Phase ${lbl}: ${p.n}">${pi === cur ? `<circle class="halo" cx="${q[0]}" cy="${q[1]}" r="7"/>` : ""}<circle cx="${q[0]}" cy="${q[1]}" r="6.5"/><text x="${q[0]}" y="${q[1] + 2.3}">${lbl}</text></g>`;
}

export function renderMap() {
  const w = world();
  const cur = currentPhase();
  const sc = scope();
  $("mapWorld").hidden = sc !== "both";
  [...$("mapWorld").children].forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === w)));
  $("mapLayer").hidden = w === "dlc";
  $("legUnder").hidden = w === "dlc";
  $("mapNote").textContent = w === "dlc"
    ? "Shadow of the Erdtree as a graph of area connections, not a geographic map. Lines show which areas lead to which. Tap a node to open its phase."
    : "A schematic of the Lands Between, not to scale. Numbers match the route phases. Tap one to open it.";
  const inW = (p) => Boolean(p.dlc) === (w === "dlc");
  let h;
  if (w === "dlc") {
    h = `<svg viewBox="0 0 320 290" role="img" aria-label="Graph of Shadow of the Erdtree areas and how they connect">`;
    DLC_EDGES.forEach(([a, b]) => { h += `<line class="edge" x1="${DLC_PINS[a][0]}" y1="${DLC_PINS[a][1]}" x2="${DLC_PINS[b][0]}" y2="${DLC_PINS[b][1]}"/>`; });
    PHASES.forEach((p, pi) => { if (p.dlc && DLC_PINS[p.id]) h += pinHTML(p, pi, DLC_PINS[p.id], cur); });
    PHASES.forEach((p) => { const q = p.dlc && DLC_PINS[p.id]; if (q) h += `<text class="rl pl" x="${q[0]}" y="${q[1] + 17}">${p.n.replace(/^(.{16}).+$/, "$1…")}</text>`; });
  } else {
    const pts = PHASES.filter((p) => !p.dlc).map((p) => PINS[p.id]).filter(Boolean);
    h = `<svg viewBox="0 0 320 290" role="img" aria-label="Schematic map of the Lands Between with the route phases" class="${layer === "under" ? "dim" : ""} ${layer === "surface" ? "hide-under" : ""}">`;
    REGIONS.forEach(([n, x, y, rx, ry]) => { h += `<ellipse class="rg" cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`; });
    UNDERGROUND.forEach(([n, x, y, rx, ry]) => { h += `<ellipse class="rg under" cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`; });
    REGIONS.forEach(([n, x, y, rx, ry]) => { h += `<text class="rl" x="${x}" y="${y - ry + 9}">${n.toUpperCase()}</text>`; });
    UNDERGROUND.forEach(([n, x, y, rx, ry]) => { h += `<text class="rl u" x="${x}" y="${y + ry + 8}">${n}</text>`; });
    h += `<polyline class="rpath" points="${pts.map((p) => p.join(",")).join(" ")}"/>`;
    PHASES.forEach((p, pi) => { if (!p.dlc && PINS[p.id]) h += pinHTML(p, pi, PINS[p.id], cur); });
  }
  $("map").innerHTML = h + "</svg>";

  $("phaseList").innerHTML = PHASES.map((p, pi) => {
    if (!inW(p)) return "";
    const state = pi === cur ? "cur" : phaseDone(pi) ? "done" : "";
    return `<li><button type="button" class="${state}" data-phase="${p.id}"><b>${phaseLabel(pi)}</b><span>${p.n}</span></button></li>`;
  }).join("");
}

export function initMap() {
  $("mapLinks").innerHTML = "For exact spots use an interactive map: " + MAP_LINKS.map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${n} ↗</a>`).join(" · ");
  const go = (e) => {
    const t = e.target.closest("[data-phase]");
    if (t) emit("phase", t.dataset.phase);
  };
  $("map").addEventListener("click", go);
  $("map").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(e); } });
  $("phaseList").addEventListener("click", go);
  $("mapWorld").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    picked = b.dataset.v;
    renderMap();
  });
  $("mapLayer").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    layer = b.dataset.v;
    [...$("mapLayer").children].forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    renderMap();
  });
}
