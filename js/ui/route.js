import * as store from "../lib/store.js";
import { $, $$, emit, on } from "../lib/dom.js";
import { PHASES, steps, tickSteps, scopedSteps, inScope, phaseLabel, stepById, currentPhase, phaseCounts, collectibleName, collectibleGroup, trophyName, wikiUrl, goalList } from "../lib/model.js";
import { ico, tickSVG, COLLECTION_ICON } from "../lib/icons.js";
import { BOSS_TERMS } from "../data/links.js";
import { STEP_LOCS } from "../data/map-guide.js";
import { AREAS, DLC_AREAS } from "../data/map.js";
import { trophyWord } from "../lib/labels.js";

let programmatic = false;
let query = "";

const smooth = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
const goalName = Object.fromEntries(goalList.map(([k, n]) => [k, n]));
const stepIcon = (s) => (s.opts.c ? COLLECTION_ICON[collectibleGroup[s.opts.c]] : s.kind);

function chips(s) {
  const out = [];
  const k = s.kind;
  if (k === "boss") out.push('<span class="chip">Boss</span>');
  if (k === "quest") out.push('<span class="chip">Quest</span>');
  if (k === "map") out.push('<span class="chip">Map fragment</span>');
  if (k === "key") out.push('<span class="chip key">Key item</span>');
  if (k === "warn") out.push("<span class=\"chip miss\">Don't miss</span>");
  if (s.opts.c) out.push(`<span class="chip legend">Legendary · ${collectibleName[s.opts.c]}</span>`);
  if (s.opts.g) out.push(`<span class="chip trophy">DLC goal · ${goalName[s.opts.g]}</span>`);
  if (s.opts.tr) out.push(`<span class="chip trophy">${trophyWord()} · ${trophyName[s.opts.tr]}</span>`);
  return out.length ? `<div class="chips">${out.join("")}</div>` : "";
}

function links(s) {
  const l = [];
  if (s.opts.c) l.push([collectibleName[s.opts.c], wikiUrl(collectibleName[s.opts.c])]);
  if (s.opts.tr && BOSS_TERMS[s.opts.tr]) l.push([BOSS_TERMS[s.opts.tr], wikiUrl(BOSS_TERMS[s.opts.tr])]);
  const wiki = l.map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${n} on the wiki ↗</a>`).join("");
  const map = STEP_LOCS[s.id] ? `<button type="button" class="maplink" data-locate="${s.id}" aria-label="Show this step on the map">Show on map</button>` : "";
  return wiki || map ? `<div class="links">${wiki}${map}</div>` : "";
}

function stepHTML(s) {
  if (s.kind === "tip") return `<li class="step tip" data-text="${attr(s.text)}"><span class="tipmark" aria-hidden="true">✦</span><div class="txt"><p>${s.text}</p></div></li>`;
  const done = store.isDone(s.id);
  return `<li class="step ${s.kind === "warn" ? "warn" : ""} ${done ? "checked" : ""}" data-id="${s.id}" id="s-${s.id}" data-text="${attr(s.text)}">
<button type="button" class="check" aria-label="${plain(s.text)}" aria-pressed="${done}">${tickSVG}</button>
<span class="ico" aria-hidden="true">${ico(stepIcon(s))}</span>
<div class="txt"><p>${s.text}</p>${chips(s)}${links(s)}</div></li>`;
}

const plain = (t) => t.replace(/<[^>]+>/g, "").replace(/"/g, "&quot;");
const attr = (t) => plain(t).toLowerCase();

function phaseHTML(p, pi, openId) {
  const items = steps.filter((s) => s.pi === pi).map(stepHTML).join("");
  const term = AREAS[p.id] || DLC_AREAS[p.id];
  const area = `<div class="ph-links">${term ? `<a href="${wikiUrl(term)}" target="_blank" rel="noopener">${term} on the wiki ↗</a>` : ""}<button type="button" class="maplink" data-mapphase="${p.id}">Show phase on map</button></div>`;
  const open = store.setting("autoopen") ? pi === openId : !store.get().closed[p.id];
  return `<details class="phase" id="p-${p.id}" data-pid="${p.id}" ${open ? "open" : ""}>
<summary><span class="num">${phaseLabel(pi)}</span><span class="ph-title"><h3>${p.n}</h3><small>${p.sub}</small><div class="ph-bar"><i></i></div></span><span class="count"></span><svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg></summary>
${area}<ol class="steps">${items}</ol></details>`;
}

export function renderRoute() {
  $("phases").innerHTML = PHASES.map((p, pi) => (inScope(pi) ? phaseHTML(p, pi, currentPhase()) : "")).join("");
  applyView();
  updateRoute();
  foldLabel();
}

export function applyView() {
  const box = $("phases");
  box.classList.toggle("hide-done", store.setting("hide"));
  box.classList.toggle("no-tips", !store.setting("tips"));
  box.classList.toggle("compact", store.setting("compact"));
  $("hideBtn").setAttribute("aria-pressed", String(store.setting("hide")));
  $("hideBtn").textContent = store.setting("hide") ? "Show done" : "Hide done";
}

export function updateRoute() {
  const cur = currentPhase();
  tickSteps.forEach((s) => {
    const li = $("s-" + s.id);
    if (!li) return;
    const done = store.isDone(s.id);
    li.classList.toggle("checked", done);
    li.querySelector(".check").setAttribute("aria-pressed", String(done));
  });
  PHASES.forEach((p, pi) => {
    const [d, t] = phaseCounts(pi);
    const el = $("p-" + p.id);
    if (!el) return;
    el.querySelector(".count").textContent = t ? `${d}/${t}` : "Read";
    el.querySelector(".count").setAttribute("aria-label", t ? `${d} of ${t} steps done` : "Read only");
    el.querySelector(".ph-bar i").style.width = (t ? (d / t) * 100 : 0) + "%";
    el.classList.toggle("done", t > 0 && d === t);
    el.classList.toggle("current", pi === cur);
  });
  renderNext();
}

function renderNext() {
  const n = scopedSteps().find((s) => !store.isDone(s.id));
  const el = $("next");
  if (!n) {
    el.innerHTML = '<div class="eyebrow">Complete</div><div class="where">Every step is done</div><p>Nothing left to do in this route. Untick a step if you need to revisit it.</p>';
    return;
  }
  el.innerHTML = `<div class="eyebrow">Up next · Phase ${phaseLabel(n.pi)}</div><div class="where">${PHASES[n.pi].n}</div><p>${n.text}</p>
<div class="acts"><button type="button" class="btn primary" id="nextDone">Mark done</button><button type="button" class="btn" id="nextShow">Show in route</button></div>`;
  $("nextDone").onclick = () => toggle(n.id);
  $("nextShow").onclick = () => jump(n.id);
}

export function ensureCurrentOpen() {
  const cur = currentPhase();
  if (!store.setting("autoopen") || query || cur < 0) return;
  programmatic = true;
  const el = $("p-" + PHASES[cur].id);
  if (el) el.open = true;
  programmatic = false;
}

export function toggle(id) {
  const before = currentPhase();
  store.setDone(id, !store.isDone(id));
  const after = currentPhase();
  if (store.setting("autoopen") && after !== before && after >= 0 && !query) {
    programmatic = true;
    const b = PHASES[before] && $("p-" + PHASES[before].id);
    const a = $("p-" + PHASES[after].id);
    if (b) b.open = false;
    if (a) a.open = true;
    programmatic = false;
  }
}

export function jump(id) {
  emit("tab", "route");
  const s = stepById.get(id);
  if (!s) return;
  if (query) { $("q").value = ""; setQuery(""); }
  if (store.setting("hide") && store.isDone(id)) store.setSetting("hide", false);
  programmatic = true;
  const ph = $("p-" + PHASES[s.pi].id);
  if (ph) ph.open = true;
  programmatic = false;
  requestAnimationFrame(() => {
    const li = $("s-" + id);
    if (!li) return;
    li.scrollIntoView({ behavior: smooth(), block: "center" });
    li.classList.add("flash");
    setTimeout(() => li.classList.remove("flash"), 1500);
  });
}

function focusPhase(pid) {
  emit("tab", "route");
  const d = $("p-" + pid);
  if (!d) return;
  programmatic = true;
  d.open = true;
  programmatic = false;
  requestAnimationFrame(() => d.scrollIntoView({ behavior: smooth(), block: "start" }));
}

function setQuery(q) {
  query = q.trim().toLowerCase();
  let any = false;
  $$("details.phase").forEach((d) => {
    let hits = 0;
    $$(".step", d).forEach((li) => {
      const hit = !query || li.dataset.text.includes(query) || d.querySelector("h3").textContent.toLowerCase().includes(query);
      li.classList.toggle("nomatch", !hit);
      if (hit) hits++;
    });
    d.classList.toggle("nomatch", hits === 0);
    if (query && hits) { programmatic = true; d.open = true; programmatic = false; }
    if (hits) any = true;
  });
  $("noResults").hidden = any || !query;
  $("qClear").hidden = !query;
  const n = $$(".step[data-id]:not(.nomatch)").length;
  $("qCount").hidden = !query || !any;
  $("qCount").textContent = `${n} matching ${n === 1 ? "step" : "steps"}`;
  foldLabel();
}

function foldLabel() {
  $("foldBtn").textContent = $$("details.phase").some((d) => d.open) ? "Collapse all" : "Expand all";
}

export function initRoute() {
  const box = $("phases");
  box.addEventListener("click", (e) => {
    if (e.target.closest("a")) return;
    const mp = e.target.closest("[data-mapphase]");
    if (mp) { emit("mapphase", mp.dataset.mapphase); return; }
    const loc = e.target.closest("[data-locate]");
    if (loc) { emit("locate", loc.dataset.locate); return; }
    const li = e.target.closest(".step[data-id]");
    if (li) toggle(li.dataset.id);
  });
  box.addEventListener("toggle", (e) => {
    if (!e.target.matches("details.phase")) return;
    foldLabel();
    if (programmatic) return;
    if (!store.setting("autoopen")) store.setClosed(e.target.dataset.pid, !e.target.open);
  }, true);
  $("q").addEventListener("input", (e) => setQuery(e.target.value));
  $("hideBtn").addEventListener("click", () => store.setSetting("hide", !store.setting("hide")));
  $("foldBtn").addEventListener("click", () => {
    const ds = $$("details.phase");
    const anyOpen = ds.some((d) => d.open);
    programmatic = true;
    ds.forEach((d) => { d.open = !anyOpen; });
    programmatic = false;
    foldLabel();
  });
  $("q").addEventListener("keydown", (e) => { if (e.key === "Escape" && $("q").value) { $("q").value = ""; setQuery(""); } });
  $("qClear").addEventListener("click", () => { $("q").value = ""; setQuery(""); $("q").focus(); });
  on("jump", jump);
  on("phase", focusPhase);
}
