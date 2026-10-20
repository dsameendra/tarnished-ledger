import * as store from "../lib/store.js";
import { $, emit } from "../lib/dom.js";
import { PHASES, TROPHIES, COLLECTIONS, GOALS, byTrophy, byCollectible, byGoal, trophyDone, goalDone, phaseLabel, scope, wikiUrl } from "../lib/model.js";
import { COUNTERS } from "../data/dlc-goals.js";
import { tickSVG, ico, medal, COLLECTION_ICON } from "../lib/icons.js";
import { hasGrades, trophiesWord } from "../lib/labels.js";
import { toggle } from "./route.js";

let filter = "all";
const GRADES = { p: "Platinum", g: "Gold", s: "Silver", b: "Bronze" };

function row({ done, name, sub, stepId, tog, lead, cls = "" }) {
  const jump = stepId ? ` · <button type="button" class="jump" data-jump="${stepId}">Show step</button>` : "";
  return `<div class="row ${cls} ${done ? "checked" : ""}" ${tog && stepId ? `data-tog="${stepId}"` : ""}>
<span class="check" aria-hidden="true">${tickSVG}</span>${lead}
<div style="min-width:0"><div class="row-name">${name}</div><div class="row-where">${sub}${jump}</div></div></div>`;
}

const NOTE_TRO = "Each one ticks itself when you finish its step in the route. You can also tick them here, or jump to the step.";
const NOTE_DLC = "Shadow of the Erdtree has no trophies or achievements. These goals and counters stand in for them, and each goal ticks when you finish its step in the DLC route.";

export function renderTrophies() {
  const sc = scope();
  $("troTitle").textContent = sc === "dlc" ? "DLC goals" : trophiesWord();
  $("troNote").textContent = sc === "dlc" ? NOTE_DLC : NOTE_TRO;
  $("troList").hidden = sc === "dlc";
  if (sc === "dlc") { $("troList").innerHTML = ""; renderGoals(); return; }
  renderGoals();
  const grades = hasGrades();
  const keep = (t) => filter === "all" || (filter === "done") === trophyDone(t[0]);
  const rowFor = (t) => {
    const step = byTrophy[t[0]];
    const where = COLLECTIONS[t[0]] ? "Collect every item on the Legendaries tab" : step ? PHASES[step.pi].n : "Unlocks when all others are done";
    return row({ done: trophyDone(t[0]), name: t[1], sub: `${t[2]} · ${where}`, stepId: step && step.id, tog: Boolean(step), lead: medal(t, grades), cls: "tr" });
  };
  let html = "";
  if (grades) {
    for (const g of ["p", "g", "s", "b"]) {
      const all = TROPHIES.filter((t) => t[3] === g);
      const list = all.filter(keep);
      const done = all.filter((t) => trophyDone(t[0])).length;
      if (!list.length) continue;
      html += `<div class="group"><h3><span><i class="grade g-${g}"></i>${GRADES[g]}</span><span class="c">${done}/${all.length}</span></h3><div class="cols two">${list.map(rowFor).join("")}</div></div>`;
    }
  } else {
    const list = TROPHIES.filter(keep);
    const done = TROPHIES.filter((t) => trophyDone(t[0])).length;
    if (list.length) html = `<div class="group"><h3><span>All achievements</span><span class="c">${done}/${TROPHIES.length}</span></h3><div class="cols two">${list.map(rowFor).join("")}</div></div>`;
  }
  $("troList").innerHTML = html || '<p class="empty">Nothing here.</p>';
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
    el.querySelector(".lvl").textContent = `${c.blessing} level ${level(c, n) || 0} of ${c.levels.length}`;
    el.querySelector(".dec").disabled = n <= 0;
    el.querySelector(".inc").disabled = n >= c.max;
  });
}

export function renderGoals() {
  const box = $("dlcGoals");
  if (scope() === "base") { box.innerHTML = ""; return; }
  const keep = (k) => filter === "all" || (filter === "done") === goalDone(k);
  const groups = GOALS.map(([title, items]) => {
    const list = items.filter(([k]) => keep(k));
    const done = items.filter(([k]) => goalDone(k)).length;
    if (!list.length) return "";
    const rows = list.map(([k, name, where]) => {
      const s = byGoal[k];
      return row({ done: goalDone(k), name, sub: `${where} · ${phaseLabel(s.pi)}`, stepId: s.id, tog: true, lead: `<span class="lico">${ico(s.kind)}</span>`, cls: "tr" });
    }).join("");
    return `<div class="group"><h3><span>${title}</span><span class="c">${done}/${items.length}</span></h3><div class="cols two">${rows}</div></div>`;
  }).join("");
  const counters = COUNTERS.map((c) => `<div class="counter" data-counter="${c.id}">
<div class="c-head"><b>${c.name}</b><span class="lvl"></span></div>
<div class="c-ctl"><button type="button" class="btn dec" aria-label="One fewer ${c.name}">−</button><input type="number" inputmode="numeric" min="0" max="${c.max}" aria-label="${c.name} collected"><span class="of">/ ${c.max}</span><button type="button" class="btn inc" aria-label="One more ${c.name}">+</button></div>
<p class="note">${c.note}</p></div>`).join("");
  box.innerHTML = `${scope() === "both" ? '<h2 class="view-h sub">Shadow of the Erdtree</h2>' : ""}<div class="group counters" id="counters"><h3><span>Blessings</span></h3>${counters}</div>${groups}`;
  renderCounters();
}

export function renderCollect() {
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
    return `<div class="group"><h3>${title}<span class="c">${done}/${items.length}</span></h3><div class="cols two">${rows}</div></div>`;
  }).join("");
}

export function initLists() {
  const handle = (e) => {
    if (e.target.closest("a")) return;
    const j = e.target.closest("[data-jump]");
    if (j) { e.stopPropagation(); emit("jump", j.dataset.jump); return; }
    const r = e.target.closest("[data-tog]");
    if (r) toggle(r.dataset.tog);
  };
  $("troList").addEventListener("click", handle);
  $("dlcGoals").addEventListener("click", (e) => {
    const el = e.target.closest("[data-counter]");
    if (el) {
      const id = el.dataset.counter;
      if (e.target.closest(".inc")) store.setCounter(id, store.counter(id) + 1);
      else if (e.target.closest(".dec")) store.setCounter(id, store.counter(id) - 1);
      return;
    }
    handle(e);
  });
  $("dlcGoals").addEventListener("change", (e) => {
    const el = e.target.closest("[data-counter]");
    if (el && e.target.matches("input")) { store.setCounter(el.dataset.counter, Number(e.target.value) || 0); renderCounters(); }
  });
  $("colList").addEventListener("click", handle);
  $("troFilter").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    filter = b.dataset.v;
    [...$("troFilter").children].forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    renderTrophies();
  });
}
