import * as store from "../lib/store.js";
import { $, emit } from "../lib/dom.js";
import { PHASES, tickSteps, currentPhase } from "../lib/model.js";
import { REGIONS, UNDERGROUND, PINS } from "../data/map.js";
import { MAP_LINKS } from "../data/links.js";

let layer = "both";

const phaseDone = (pi) => {
  const l = tickSteps.filter((s) => s.pi === pi);
  return l.length > 0 && l.every((s) => store.isDone(s.id));
};

export function renderMap() {
  const cur = currentPhase();
  const pts = PHASES.map((p) => PINS[p.id]).filter(Boolean);
  let h = `<svg viewBox="0 0 320 290" role="img" aria-label="Schematic map of the Lands Between with the route phases" class="${layer === "under" ? "dim" : ""} ${layer === "surface" ? "hide-under" : ""}">`;
  REGIONS.forEach(([n, x, y, rx, ry]) => { h += `<ellipse class="rg" cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`; });
  UNDERGROUND.forEach(([n, x, y, rx, ry]) => { h += `<ellipse class="rg under" cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`; });
  REGIONS.forEach(([n, x, y, rx, ry]) => { h += `<text class="rl" x="${x}" y="${y - ry + 9}">${n.toUpperCase()}</text>`; });
  UNDERGROUND.forEach(([n, x, y, rx, ry]) => { h += `<text class="rl u" x="${x}" y="${y + ry + 8}">${n}</text>`; });
  h += `<polyline class="rpath" points="${pts.map((p) => p.join(",")).join(" ")}"/>`;
  PHASES.forEach((p, pi) => {
    const q = PINS[p.id];
    if (!q) return;
    const cls = pi === cur ? "cur" : phaseDone(pi) ? "done" : "";
    h += `<g class="pin ${cls}" data-phase="${p.id}" tabindex="0" role="button" aria-label="Phase ${pi}: ${p.n}">${pi === cur ? `<circle class="halo" cx="${q[0]}" cy="${q[1]}" r="7"/>` : ""}<circle cx="${q[0]}" cy="${q[1]}" r="6.5"/><text x="${q[0]}" y="${q[1] + 2.3}">${pi}</text></g>`;
  });
  $("map").innerHTML = h + "</svg>";

  $("phaseList").innerHTML = PHASES.map((p, pi) => {
    const state = pi === cur ? "cur" : phaseDone(pi) ? "done" : "";
    return `<li><button type="button" class="${state}" data-phase="${p.id}"><b>${pi}</b><span>${p.n}</span></button></li>`;
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
  $("mapLayer").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    layer = b.dataset.v;
    [...$("mapLayer").children].forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    renderMap();
  });
}
