import * as store from "../lib/store.js";
import { $, emit } from "../lib/dom.js";
import { PHASES, TROPHIES, COLLECTIONS, GOALS, byTrophy, byCollectible, byGoal, trophyDone, goalDone, phaseLabel, scope, wikiUrl } from "../lib/model.js";
import { COUNTERS } from "../data/dlc-goals.js";
import { tickSVG, ico, medal, COLLECTION_ICON } from "../lib/icons.js";
import { hasGrades, trophiesWord } from "../lib/labels.js";
import { toggle } from "./route.js";

let filter = "all";
const GRADES = { p: "Platinum", g: "Gold", s: "Silver", b: "Bronze" };

const esc = (x) => String(x).replace(/<[^>]*>/g, "").replace(/"/g, "&quot;");

function row({ done, name, sub, stepId, tog, lead, cls = "" }) {
  const jump = stepId ? ` · <button type="button" class="jump" data-jump="${stepId}" aria-label="Show step for ${esc(name)} in the route">Show step</button>` : "";
  const box = tog && stepId
    ? `<button type="button" class="check" aria-pressed="${done}" aria-label="Done: ${esc(name)}">${tickSVG}</button>`
    : `<span class="check" aria-hidden="true">${tickSVG}</span>`;
  return `<div class="row ${cls} ${done ? "checked" : ""}" ${tog && stepId ? `data-tog="${stepId}"` : ""}>
${box}${lead}
<div style="min-width:0"><div class="row-name">${name}</div><div class="row-where">${sub}${jump}</div></div></div>`;
}

const groupHead = (title, done, total) => `<h3><span>${title}</span><span class="c">${done}/${total}<span class="sr"> done</span></span></h3><div class="gbar" aria-hidden="true"><i style="width:${total ? Math.round((done / total) * 100) : 0}%"></i></div>`;

function keepFocus(fn) {
  const a = document.activeElement;
  const r = a && a.closest && a.closest("[data-tog]");
  const id = r && r.dataset.tog;
  const where = r && (r.closest("#troList,#dlcGoals,#colList") || {}).id;
  fn();
  if (!id) return;
  const el = document.querySelector(`#${where} [data-tog="${id}"] .check`);
  if (el) el.focus({ preventScroll: true });
}

const emptyMsg = (what) => `<div class="empty"><p>${filter === "done" ? `No ${what} ticked yet.` : `Every ${what} is done. Nothing left to do here.`}</p><button type="button" class="btn" data-v="all">Show all</button></div>`;

const NOTE_TRO = "Each one ticks itself when you finish its step in the route. You can also tick them here, or jump to the step.";
const NOTE_DLC = "Shadow of the Erdtree has no trophies or achievements. These goals and counters stand in for them, and each goal ticks when you finish its step in the DLC route.";

function paintFilter(sc) {
  const t = sc === "dlc" ? [] : TROPHIES.map((x) => trophyDone(x[0]));
  const g = sc === "base" ? [] : GOALS.flatMap(([, items]) => items.map(([k]) => goalDone(k)));
  const all = [...t, ...g];
  const n = { all: all.length, done: all.filter(Boolean).length };
  n.todo = n.all - n.done;
  [...$("troFilter").children].forEach((b) => { b.querySelector("i").textContent = n[b.dataset.v]; });
}

export function renderTrophies() { keepFocus(drawTrophies); }

function drawTrophies() {
  const sc = scope();
  paintFilter(sc);
  $("troTitle").textContent = sc === "dlc" ? "DLC goals" : sc === "both" ? `${trophiesWord()} and DLC goals` : trophiesWord();
  $("troNote").textContent = sc === "dlc" ? NOTE_DLC : sc === "both" ? NOTE_TRO + " Shadow of the Erdtree has no trophies, so its goals are listed after them." : NOTE_TRO;
  $("troList").hidden = sc === "dlc";
  if (sc === "dlc") { $("troList").innerHTML = ""; drawGoals(); return; }
  drawGoals();
  const grades = hasGrades();
  const keep = (t) => filter === "all" || (filter === "done") === trophyDone(t[0]);
  const rowFor = (t) => {
    const step = byTrophy[t[0]];
    const where = COLLECTIONS[t[0]] ? "Collect every item on the Legendary tab" : step ? PHASES[step.pi].n : "Unlocks when all others are done";
    return row({ done: trophyDone(t[0]), name: t[1], sub: `${t[2]} · ${where}`, stepId: step && step.id, tog: Boolean(step), lead: medal(t, grades), cls: "tr" });
  };
  let html = "";
  if (grades) {
    for (const g of ["p", "g", "s", "b"]) {
      const all = TROPHIES.filter((t) => t[3] === g);
      const list = all.filter(keep);
      const done = all.filter((t) => trophyDone(t[0])).length;
      if (!list.length) continue;
      html += `<div class="group">${groupHead(`<i class="grade g-${g}"></i>${GRADES[g]}`, done, all.length)}<div class="cols two">${list.map(rowFor).join("")}</div></div>`;
    }
  } else {
    const list = TROPHIES.filter(keep);
    const done = TROPHIES.filter((t) => trophyDone(t[0])).length;
    if (list.length) html = `<div class="group">${groupHead("All achievements", done, TROPHIES.length)}<div class="cols two">${list.map(rowFor).join("")}</div></div>`;
  }
  $("troList").innerHTML = html || emptyMsg(trophiesWord().toLowerCase().replace(/s$/, ""));
}

const level = (c, n) => c.levels.filter((x) => n >= x).length;

export function renderCounters() {
  const box = $("counters");
  if (!box) return;
  [...box.querySelectorAll("[data-counter]")].forEach((el) => {
    const c = COUNTERS.find((x) => x.id === el.dataset.counter);
    const n = store.counter(c.id);
    const input = el.querySelector("input");
    if (document.activeElement !== input) input.value = n;
    const lv = level(c, n);
    el.querySelector(".lvl").textContent = `${c.blessing} level ${lv} of ${c.levels.length}${lv < c.levels.length ? ` · ${c.levels[lv] - n} more for level ${lv + 1}` : " · maxed"}`;
    el.querySelector(".dec").disabled = n <= 0;
    el.querySelector(".inc").disabled = n >= c.max;
  });
}

export function renderGoals() { keepFocus(drawGoals); }

function drawGoals() {
  const box = $("dlcGoals");
  const sc = scope();
  if (sc === "base") { box.innerHTML = ""; return; }
  const keep = (k) => filter === "all" || (filter === "done") === goalDone(k);
  const groups = GOALS.map(([title, items]) => {
    const list = items.filter(([k]) => keep(k));
    const done = items.filter(([k]) => goalDone(k)).length;
    if (!list.length) return "";
    const rows = list.map(([k, name, where]) => {
      const s = byGoal[k];
      return row({ done: goalDone(k), name, sub: `${where} · ${phaseLabel(s.pi)}`, stepId: s.id, tog: true, lead: `<span class="lico">${ico(s.kind)}</span>`, cls: "tr" });
    }).join("");
    return `<div class="group">${groupHead(title, done, items.length)}<div class="cols two">${rows}</div></div>`;
  }).join("") || emptyMsg("goal");
  if (box.dataset.sc === sc) { $("goalGroups").innerHTML = groups; return; }
  box.dataset.sc = sc;
  const counters = COUNTERS.map((c) => `<div class="counter" data-counter="${c.id}">
<div class="c-head"><b>${c.name}</b><span class="lvl" aria-live="polite"></span></div>
<div class="c-ctl"><button type="button" class="btn dec" aria-label="One fewer ${c.name}">−</button><input type="number" inputmode="numeric" min="0" max="${c.max}" enterkeyhint="done" aria-label="${c.name} collected, out of ${c.max}"><span class="of">/ ${c.max}</span><button type="button" class="btn inc" aria-label="One more ${c.name}">+</button></div>
<p class="note">${c.note} Ticking one on the map adds 1 here.</p><button type="button" class="maplink" data-mapcat="${c.id === "sf" ? 11317 : 11316}">Show on map</button></div>`).join("");
  box.innerHTML = `${sc === "both" ? '<h2 class="view-h sub">Shadow of the Erdtree</h2>' : ""}<div class="group counters" id="counters"><h3><span>Blessings</span></h3>${counters}</div><div id="goalGroups">${groups}</div>`;
  renderCounters();
}

export function renderCollect() { keepFocus(drawCollect); }

function drawCollect() {
  $("colList").innerHTML = Object.entries(COLLECTIONS).map(([key, [title, items]]) => {
    const done = items.filter(([id]) => store.isDone(byCollectible[id].id)).length;
    const rows = items.map(([id, name]) => {
      const s = byCollectible[id];
      return row({
        done: store.isDone(s.id), name,
        sub: `${PHASES[s.pi].n} · <a class="jump" href="${wikiUrl(name)}" target="_blank" rel="noopener">Wiki ↗</a>`,
        stepId: s.id, tog: true, lead: `<span class="lico">${ico(COLLECTION_ICON[key])}</span>`,
      });
    }).join("");
    return `<div class="group">${groupHead(title, done, items.length)}<div class="cols two">${rows}</div></div>`;
  }).join("");
}

export function initLists() {
  const handle = (e) => {
    if (e.target.closest("a")) return;
    const all = e.target.closest(".empty [data-v]");
    if (all) { setFilter(all.dataset.v); return; }
    const j = e.target.closest("[data-jump]");
    if (j) { e.stopPropagation(); emit("jump", j.dataset.jump); return; }
    const r = e.target.closest("[data-tog]");
    if (r && (!matchMedia("(pointer: coarse)").matches || e.target.closest(".check"))) toggle(r.dataset.tog);
  };
  const setFilter = (v) => {
    filter = v;
    [...$("troFilter").children].forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.v === v)));
    renderTrophies();
  };
  const step = (el, d) => store.setCounter(el.dataset.counter, store.counter(el.dataset.counter) + d);
  let hold = null, held = false;
  const stop = () => { clearTimeout(hold); clearInterval(hold); hold = null; };
  $("dlcGoals").addEventListener("pointerdown", (e) => {
    const b = e.target.closest(".inc, .dec");
    if (!b || e.button || b.disabled) return;
    const el = b.closest("[data-counter]"), d = b.classList.contains("inc") ? 1 : -1;
    stop();
    held = false;
    hold = setTimeout(() => { held = true; step(el, d); hold = setInterval(() => step(el, d), 90); }, 450);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((t) => $("dlcGoals").addEventListener(t, stop));
  document.addEventListener("pointerup", stop);
  $("dlcGoals").addEventListener("contextmenu", (e) => { if (e.target.closest(".inc, .dec")) e.preventDefault(); });
  $("troList").addEventListener("click", handle);
  $("dlcGoals").addEventListener("click", (e) => {
    const mc = e.target.closest("[data-mapcat]");
    if (mc) { emit("mapcat", mc.dataset.mapcat); return; }
    const el = e.target.closest("[data-counter]");
    if (el) {
      const b = e.target.closest(".inc, .dec");
      if (b && held) held = false;
      else if (b) step(el, b.classList.contains("inc") ? 1 : -1);
      return;
    }
    handle(e);
  });
  $("dlcGoals").addEventListener("focusin", (e) => { if (e.target.matches(".counter input")) e.target.select(); });
  $("dlcGoals").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches(".counter input")) e.target.blur(); });
  $("dlcGoals").addEventListener("change", (e) => {
    const el = e.target.closest("[data-counter]");
    if (el && e.target.matches("input")) { store.setCounter(el.dataset.counter, Number(e.target.value) || 0); renderCounters(); }
  });
  $("colList").addEventListener("click", handle);
  $("troFilter").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) setFilter(b.dataset.v);
  });
}
