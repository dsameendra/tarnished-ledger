// "What is done and what is left" for the map: counts and lists per marker category.
// summarize() is pure so it can be tested; progressHTML() turns its result into the panel markup.
import { verbFor } from "../data/map-verbs.js";
import { iconURL } from "./map-glyphs.js";

const LAYER_NAME = { base: "Lands Between", under: "Underground", dlc: "Realm of Shadow" };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Layers that belong to the current scope: base game, DLC only, or both.
export const layersFor = (scope) => (scope === "dlc" ? ["dlc"] : scope === "both" ? ["base", "under", "dlc"] : ["base", "under"]);

// A marker is done when you ticked it on the map or a route step that covers it is ticked.
export function markerDone(D, id, isFound, stepDone) {
  return isFound(id) || (D.stepsOf.get(id) || []).some(stepDone);
}

export function summarize(D, isDone, layers, catIds) {
  const want = new Set(catIds.map(String));
  const cats = new Map();
  let total = 0, done = 0;
  for (const layer of layers) {
    for (const m of D.byLayer[layer] || []) {
      if (!want.has(m.cat)) continue;
      let e = cats.get(m.cat);
      if (!e) cats.set(m.cat, (e = { total: 0, done: 0, todo: [], finished: [] }));
      e.total++;
      total++;
      if (isDone(m)) { e.done++; done++; e.finished.push(m); } else e.todo.push(m);
    }
  }
  const byTitle = (a, b) => a.title.localeCompare(b.title);
  for (const e of cats.values()) { e.todo.sort(byTitle); e.finished.sort(byTitle); }
  return { total, done, cats };
}

const bar = (d, t) => `<span class="pg-bar" aria-hidden="true"><i style="width:${t ? Math.round((d / t) * 100) : 0}%"></i></span>`;

function items(list, limit, id, verb, doneList) {
  const rows = list.slice(0, limit).map((m) => `<li><button type="button" data-pg-pick="${esc(m.id)}"><span class="pg-t">${esc(m.title)}</span><span class="pg-w">${esc(LAYER_NAME[m.layer])}</span></button></li>`).join("");
  const more = list.length > limit ? `<li class="pg-more"><button type="button" class="btn" data-pg-more="${esc(id)}:${doneList ? "done" : "todo"}">Show ${Math.min(40, list.length - limit)} more of ${list.length - limit}</button></li>` : "";
  return rows + more;
}

// state: { scope: "essentials" | "all", open: Set of category ids, limit: Map of "id:todo"/"id:done" -> count }
export function progressHTML(D, sum, state) {
  const pct = sum.total ? Math.round((sum.done / sum.total) * 100) : 0;
  const head = `<div class="pg-sum"><div><b>${sum.done}</b> of <b>${sum.total}</b> ${state.scope === "essentials" ? "essentials" : "markers"} done <span class="pg-pct">${pct}%</span></div>${bar(sum.done, sum.total)}
    <div class="seg" id="pgScope" role="group" aria-label="What to count"><button type="button" data-pg-scope="essentials" aria-pressed="${state.scope === "essentials"}">Essentials</button><button type="button" data-pg-scope="all" aria-pressed="${state.scope === "all"}">Every marker</button></div></div>`;
  const groups = D.groups.map((g) => {
    const cats = D.cats.filter((c) => c.group === g.id && sum.cats.has(c.id));
    if (!cats.length) return "";
    const gd = cats.reduce((n, c) => n + sum.cats.get(c.id).done, 0), gt = cats.reduce((n, c) => n + sum.cats.get(c.id).total, 0);
    const rows = cats.map((c) => {
      const e = sum.cats.get(c.id), v = verbFor(c), open = state.open.has(c.id);
      const tl = state.limit.get(c.id + ":todo") || 20, dl = state.limit.get(c.id + ":done") || 20;
      const body = open ? `<div class="pg-body" id="pg-${esc(c.id)}">
        <h4>${v.todo} <span>${e.todo.length}</span></h4>
        ${e.todo.length ? `<ul class="pg-list">${items(e.todo, tl, c.id, v, false)}</ul>` : `<p class="pg-empty">Nothing left here: ${v.all}.</p>`}
        ${e.finished.length ? `<details class="pg-done"><summary>${v.done} <span>${e.finished.length}</span></summary><ul class="pg-list">${items(e.finished, dl, c.id, v, true)}</ul></details>` : ""}</div>` : "";
      return `<div class="pg-cat ${e.done === e.total ? "all" : ""}"><button type="button" class="pg-row" data-pg-cat="${esc(c.id)}" aria-expanded="${open}" aria-controls="pg-${esc(c.id)}"><img src="${iconURL(c.glyph, c.color)}" alt="" width="22" height="22"><span class="pg-t">${esc(c.title)}</span><span class="pg-n">${e.done}/${e.total}</span>${bar(e.done, e.total)}</button>${body}</div>`;
    }).join("");
    return `<details class="pg-g" data-pg-g="${esc(g.id)}" ${state.closedGroups?.has(g.id) ? "" : "open"}><summary>${esc(g.title)} <span>${gd}/${gt}</span></summary>${rows}</details>`;
  }).join("");
  return head + groups;
}
