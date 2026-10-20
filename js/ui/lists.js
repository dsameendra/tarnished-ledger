import * as store from "../lib/store.js";
import { $, emit } from "../lib/dom.js";
import { PHASES, TROPHIES, COLLECTIONS, byTrophy, byCollectible, trophyDone, wikiUrl } from "../lib/model.js";
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

export function renderTrophies() {
  $("troTitle").textContent = trophiesWord();
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
  $("colList").addEventListener("click", handle);
  $("troFilter").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    filter = b.dataset.v;
    [...$("troFilter").children].forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    renderTrophies();
  });
}
