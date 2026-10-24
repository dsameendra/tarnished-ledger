import * as store from "../lib/store.js";
import { $, $$, emit, on } from "../lib/dom.js";
import { PHASES, steps, tickSteps, scopedSteps, inScope, phaseLabel, stepById, currentPhase, phaseCounts, collectibleName, collectibleGroup, trophyName, trophyDone, goalDone, wikiUrl, goalList } from "../lib/model.js";
import { ico, tickSVG, COLLECTION_ICON } from "../lib/icons.js";
import { BOSS_TERMS } from "../data/links.js";
import { STEP_LOCS } from "../data/map-guide.js";
import { AREAS, DLC_AREAS } from "../data/map.js";
import { trophyWord } from "../lib/labels.js";
import { showToast, clip } from "./toast.js";

let programmatic = false;
let query = "";
let trailOpen = false; // the folded run of finished phases is expanded

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

// One muted line for phones, built from the same data as the chips.
function metaLine(s) {
  const k = { boss: "Boss", quest: "Quest", map: "Map fragment", key: "Key item" }[s.kind];
  const m = [];
  if (k) m.push(k);
  if (s.opts.c) m.push(`Legendary: ${collectibleName[s.opts.c]}`);
  if (s.opts.g) m.push(`DLC goal: ${goalName[s.opts.g]}`);
  if (s.opts.tr) m.push(`${trophyWord()}: ${trophyName[s.opts.tr]}`);
  return m.length ? `<p class="meta">${m.join(" · ")}</p>` : "";
}

const MORE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>';

function stepHTML(s) {
  if (s.kind === "tip") return `<li class="step tip" data-text="${attr(s.text)}"><span class="tipmark" aria-hidden="true">✦</span><div class="txt"><p>${s.text}</p></div></li>`;
  const done = store.isDone(s.id);
  const lk = links(s).replace('<div class="links">', `<div class="links" id="l-${s.id}">`);
  return `<li class="step ${s.kind === "warn" ? "warn" : ""} ${done ? "checked" : ""}" data-kind="${s.kind}" data-id="${s.id}" id="s-${s.id}" data-text="${attr(s.text)}">
<button type="button" class="check" aria-label="Done: ${short(plain(s.text))}" aria-pressed="${done}">${tickSVG}</button>
<span class="ico" aria-hidden="true">${ico(stepIcon(s))}</span>
<div class="txt"><p>${s.text}</p>${chips(s)}${metaLine(s)}${lk}</div>${lk ? `<button type="button" class="more" data-more aria-expanded="false" aria-controls="l-${s.id}" aria-label="More for this step: wiki and map">${MORE_SVG}</button>` : ""}</li>`;
}

// A long step would be read twice (as the button name, then as the paragraph), so the button carries the start of it.
const short = (t) => (t.length > 60 ? t.slice(0, 59).replace(/\s+\S*$/, "") + "…" : t);
const plain = (t) => t.replace(/<[^>]+>/g, "").replace(/"/g, "&quot;");
const attr = (t) => plain(t).toLowerCase();

function phaseHTML(p, pi, openId) {
  const items = steps.filter((s) => s.pi === pi).map(stepHTML).join("");
  const term = AREAS[p.id] || DLC_AREAS[p.id];
  const area = `<div class="ph-links">${term ? `<a href="${wikiUrl(term)}" target="_blank" rel="noopener">${term} on the wiki ↗</a>` : ""}<button type="button" class="maplink" data-mapphase="${p.id}">Show phase on map</button><button type="button" class="maplink" data-phaseall="${p.id}" aria-pressed="false"></button></div>`;
  const open = store.setting("autoopen") ? pi === openId : !store.get().closed[p.id];
  return `<details class="phase" id="p-${p.id}" data-pid="${p.id}" ${open ? "open" : ""}>
<summary><span class="num">${phaseLabel(pi)}</span><span class="ph-title"><h3>${p.n}</h3><small>${p.sub}</small><div class="ph-bar"><i></i></div></span><span class="count"></span><svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg></summary>
${area}<ol class="steps">${items}</ol></details>`;
}

export function renderRoute() {
  $("phases").innerHTML = '<div class="trail" id="trail" hidden></div><div class="missable" id="missable" hidden></div>' + PHASES.map((p, pi) => (inScope(pi) ? phaseHTML(p, pi, currentPhase()) : "")).join("");
  $("jumpPhase").innerHTML = '<option value="">Jump to…</option>' + PHASES.map((p, pi) => (inScope(pi) ? `<option value="${p.id}">${phaseLabel(pi)} · ${p.n}</option>` : "")).join("");
  applyView();
  updateRoute();
  foldLabel();
}

export function applyView() {
  const box = $("phases");
  box.classList.toggle("hide-done", store.setting("hide"));
  box.classList.toggle("no-tips", !store.setting("tips"));
  box.classList.toggle("compact", store.setting("compact"));
  $("compactBtn").setAttribute("aria-pressed", String(store.setting("compact")));
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
  const now = scopedSteps().find((s) => !store.isDone(s.id));
  $$(".step.cur").forEach((li) => li.classList.remove("cur"));
  const nowLi = now && $("s-" + now.id);
  if (nowLi) nowLi.classList.add("cur");
  PHASES.forEach((p, pi) => {
    const [d, t] = phaseCounts(pi);
    const el = $("p-" + p.id);
    if (!el) return;
    el.querySelector(".count").textContent = t ? `${d}/${t}` : "Read";
    el.querySelector(".count").setAttribute("aria-label", t ? `${d} of ${t} steps done` : "Read only");
    el.querySelector(".ph-bar i").style.width = (t ? (d / t) * 100 : 0) + "%";
    el.classList.toggle("done", t > 0 && d === t);
    const all = el.querySelector("[data-phaseall]");
    if (all) { all.hidden = !t; all.textContent = d === t ? "Mark phase not done" : "Mark phase done"; all.setAttribute("aria-pressed", String(d === t)); }
    el.classList.toggle("current", pi === cur);
    // The road: finished phases fold into one row, phases after the current one are quiet stops.
    const past = cur < 0 || pi < cur;
    el.classList.toggle("ahead", !past && pi > cur);
    el.classList.toggle("folded", past && !trailOpen);
  });
  renderNext();
  renderTrail(cur);
}

// One row for the run of finished phases at the top, and one line pointing at the next "Don't miss" step once it is close.
function renderTrail(cur) {
  const t = $("phases").querySelector(".trail");
  const m = $("phases").querySelector(".missable");
  if (!t || !m) return;
  const run = PHASES.map((p, pi) => pi).filter((pi) => inScope(pi) && (cur < 0 || pi < cur));
  t.hidden = !run.length;
  if (run.length) {
    const set = new Set(run);
    const n = tickSteps.filter((s) => set.has(s.pi)).length;
    const first = phaseLabel(run[0]);
    const label = run.length === 1 ? `Phase ${first} done` : `Phases ${first} to ${phaseLabel(run[run.length - 1])} done`;
    const sig = run.length + ":" + first + ":" + n;
    if (t.dataset.sig !== sig) {
      t.dataset.sig = sig;
      t.innerHTML = `<button type="button" class="trail-btn" aria-expanded="false" aria-controls="phases"><span class="trail-t"><b>${label}</b> · ${n} ${n === 1 ? "step" : "steps"}</span><span class="trail-act"><span class="trail-verb"></span><svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg></span><span class="trail-segs" aria-hidden="true">${"<i></i>".repeat(run.length)}</span></button>`;
    }
    t.querySelector(".trail-btn").setAttribute("aria-expanded", String(trailOpen));
    t.querySelector(".trail-verb").textContent = trailOpen ? "Hide" : "Show";
  }
  // Only when the player is within one phase of the missable (the phase before it or the phase itself), and until it is ticked.
  const next = scopedSteps().find((s) => s.kind === "warn" && !store.isDone(s.id));
  const before = next ? PHASES.map((p, pi) => pi).filter((pi) => inScope(pi) && pi < next.pi).pop() : undefined;
  const w = next && (before === undefined || cur < 0 || cur >= before) ? next : null;
  m.hidden = !w;
  if (w) m.innerHTML = `<button type="button" class="missable-btn" data-missable="${w.id}"><b>Next missable:</b> Phase ${phaseLabel(w.pi)} · ${shortText(w.text)}</button>`;
}

// First sentence of a step, cut to a line or two for the "Next missable" row.
function shortText(t) {
  const p = plain(t);
  const first = (p.match(/^.*?[.!?](?=\s|$)/) || [p])[0];
  const cut = first.length > 100 ? first.slice(0, 100).replace(/\s+\S*$/, "") + "…" : first;
  return cut;
}

function unfold(ph) {
  if (!ph || !ph.classList.contains("folded")) return;
  trailOpen = true;
  updateRoute();
}

function renderNext() {
  const n = scopedSteps().find((s) => !store.isDone(s.id));
  const el = $("next");
  if (!n) {
    el.innerHTML = '<div class="where">Every step is done</div><p>Nothing left to do in this route. Untick a step if you need to revisit it.</p>';
    return;
  }
  el.innerHTML = `<div class="where">Up next: ${PHASES[n.pi].n}<small>Phase ${phaseLabel(n.pi)}</small></div><p>${n.text}</p>
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

// Tick or untick every step of a phase. A phase that is fully done is unticked, otherwise it is completed.
export function togglePhase(pid) {
  const pi = PHASES.findIndex((p) => p.id === pid);
  const ids = tickSteps.filter((s) => s.pi === pi).map((s) => s.id);
  if (!ids.length) return;
  const before = currentPhase();
  const prev = ids.map((id) => store.isDone(id));
  const value = !prev.every(Boolean);
  store.setDoneMany(ids, value);
  const changed = prev.filter((d) => d !== value).length;
  const after = currentPhase();
  showToast(`${value ? "Ticked" : "Cleared"} ${changed} step${changed === 1 ? "" : "s"} in ${PHASES[pi].n}`, () => {
    store.setDoneMany(ids.filter((_, i) => prev[i]), true);
    store.setDoneMany(ids.filter((_, i) => !prev[i]), false);
    // Auto-open moved on to the next phase when this one was completed: Undo brings the previous phase back
    if (currentPhase() === before) moveOpen(after, before);
  });
  moveOpen(before, after);
}

// Auto-open follows the current phase: close the one that was current and open the new one (and the same in reverse on Undo).
function moveOpen(from, to) {
  if (!store.setting("autoopen") || from === to || to < 0 || query) return;
  programmatic = true;
  const f = PHASES[from] && $("p-" + PHASES[from].id);
  const t = $("p-" + PHASES[to].id);
  if (f) f.open = false;
  if (t) t.open = true;
  programmatic = false;
}

// What else a tick completed (a trophy, a legendary item, a DLC goal), so the cross-linking is visible when it happens.
function alsoTicked(step) {
  const o = step.opts, out = [];
  if (o.tr && trophyDone(o.tr)) out.push(`${trophyWord().toLowerCase()} ${trophyName[o.tr]}`);
  if (o.c && collectibleName[o.c]) out.push(collectibleName[o.c]);
  const goal = o.g && goalDone(o.g) ? goalList.find((g) => g[0] === o.g) : null;
  if (goal) out.push(`goal ${goal[1]}`);
  return out;
}

export function toggle(id) {
  const before = currentPhase();
  const prev = store.isDone(id);
  store.setDone(id, !prev);
  const step = stepById.get(id);
  const after = currentPhase();
  if (step) {
    // long names are cut at a word boundary; "also ticked" lists at most two items, the rest is counted
    const extra = !prev ? alsoTicked(step).map((x) => clip(x, 34)) : [];
    const more = extra.length > 2 ? ` and ${extra.length - 2} more` : "";
    showToast(`${prev ? "Unticked" : "Ticked"}: ${clip(step.text)}${extra.length ? ` · also ticked ${extra.slice(0, 2).join(", ")}${more}` : ""}`, () => {
      store.setDone(id, prev);
      if (currentPhase() === before) moveOpen(after, before);
    });
  }
  moveOpen(before, after);
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
  unfold(ph);
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
  unfold(d);
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
  $("phases").classList.toggle("searching", Boolean(query));
  $("noResults").hidden = any || !query;
  $("qClear").hidden = !query;
  const n = $$(".step[data-id]:not(.nomatch)").length;
  $("qCount").hidden = !query || !any;
  $("qCount").textContent = `${n} matching ${n === 1 ? "step" : "steps"}`;
  foldLabel();
}

function foldLabel() {
  $("foldBtn").textContent = $$("details.phase:not(.folded)").some((d) => d.open) ? "Collapse all" : "Expand all";
}

export function initRoute() {
  const box = $("phases");
  box.addEventListener("click", (e) => {
    if (e.target.closest("a")) return;
    const mo = e.target.closest("[data-more]");
    if (mo) {
      const li = mo.closest(".step");
      const open = !li.classList.contains("open");
      li.classList.toggle("open", open);
      mo.setAttribute("aria-expanded", String(open));
      return;
    }
    if (e.target.closest(".trail-btn")) { trailOpen = !trailOpen; updateRoute(); foldLabel(); return; }
    const mb = e.target.closest("[data-missable]");
    if (mb) { jump(mb.dataset.missable); return; }
    const pa = e.target.closest("[data-phaseall]");
    if (pa) { togglePhase(pa.dataset.phaseall); return; }
    const mp = e.target.closest("[data-mapphase]");
    if (mp) { emit("mapphase", mp.dataset.mapphase); return; }
    const loc = e.target.closest("[data-locate]");
    if (loc) { emit("locate", loc.dataset.locate); return; }
    const li = e.target.closest(".step[data-id]");
    // on a touch screen only the tick box ticks, so a scroll flick or a stray tap on the text cannot
    if (li && (!matchMedia("(pointer: coarse)").matches || e.target.closest(".check"))) toggle(li.dataset.id);
  });
  box.addEventListener("toggle", (e) => {
    if (!e.target.matches("details.phase")) return;
    foldLabel();
    if (programmatic) return;
    if (!store.setting("autoopen")) store.setClosed(e.target.dataset.pid, !e.target.open);
  }, true);
  $("q").addEventListener("input", (e) => setQuery(e.target.value));
  $("jumpPhase").addEventListener("change", (e) => {
    const el = $("p-" + e.target.value);
    e.target.value = "";
    if (!el) return;
    if (query) { $("q").value = ""; setQuery(""); }
    programmatic = true;
    el.open = true;
    programmatic = false;
    el.scrollIntoView({ block: "start", behavior: "auto" });
    el.querySelector("summary").focus({ preventScroll: true });
  });
  $("compactBtn").addEventListener("click", () => store.setSetting("compact", !store.setting("compact")));
  $("hideBtn").addEventListener("click", () => store.setSetting("hide", !store.setting("hide")));
  $("foldBtn").addEventListener("click", () => {
    const ds = $$("details.phase:not(.folded)");
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
