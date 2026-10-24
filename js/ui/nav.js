import { $, $$, emit, on } from "../lib/dom.js";
import { ico } from "../lib/icons.js";
import { scope } from "../lib/model.js";
import { trophiesWord } from "../lib/labels.js";

const TABS = [
  ["route", "Route", "go"],
  ["tro", "Trophies", "crown"],
  ["col", "Legendary", "arm"],
  ["map", "Map", "map"],
  ["guide", "Guide", "book"],
  ["set", "Settings", "gear"],
];

let current = "route";

// Phones (<= 979.98px) show four tabs: Route, Checklists, Map, More. The six real views keep their ids and
// hash routes; "checklists" and "more" are only tab-bar aliases (CSS hides the opposite set per breakpoint).
const PHONE = "(max-width: 979.98px)";
const CK = ["tro", "col"], MORE = ["guide", "set"];
let lastCk = "tro", sheet = null, opener = null, ckSub = "tro"; // ckSub: which half of the Trophies tab the phone switch shows in Main game and DLC mode

const hidden = (id) => id === "col" && scope() === "dlc";
const label = (id, text) => (id === "tro" ? (scope() === "dlc" ? "Goals" : trophiesWord()) : text);

const ckLabel = () => (scope() === "dlc" ? "Goals" : "Checklists");
const aliasOf = (b, id) => b.dataset.tab === id || (b.dataset.views || "").split(" ").includes(id);
const shownBtns = () => $$("#tabs button").filter((b) => b.getClientRects().length);

export function renderNav() {
  const tabs = TABS.filter(([id]) => !hidden(id));
  const btn = (id, text, icon, attrs) => `<button type="button" role="tab" data-tab="${id}" ${attrs}>${ico(icon)}<span>${text}</span></button>`;
  const ck = btn("checklists", ckLabel(), "list", `class="tab-m" data-views="${CK.filter((c) => !hidden(c)).join(" ")}"`);
  const more = btn("more", "More", "more", `class="tab-m" data-views="${MORE.join(" ")}" aria-controls="moreSheet" aria-haspopup="true" aria-expanded="false"`);
  $("tabs").style.setProperty("--tabs", tabs.length);
  $("tabs").innerHTML = tabs.map(([id, text, icon]) =>
    (id === "map" ? ck : "") + btn(id, label(id, text), icon, `${id === "route" || id === "map" ? "" : 'class="tab-d" '}aria-controls="v-${id}"`) + (id === "set" ? more : "")).join("");
  if (hidden(current)) show("route");
  else markTabs(current);
  buildExtras();
}

function markTabs(id) {
  $$("#tabs button").forEach((b) => {
    const on = aliasOf(b, id);
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
    if (b.dataset.tab === "checklists") b.setAttribute("aria-controls", "v-" + (CK.includes(id) ? id : lastCk));
  });
}

// the Trophies | Legendary switch (phones) and the More sheet (Guide, Settings) are built once and reused
function buildExtras() {
  const sw = $("ckSwitch");
  if (!sw.onclick) sw.onclick = (e) => { const b = e.target.closest("button[data-ck]"); if (!b) return; const k = b.dataset.ck, sub = k === "dlc" ? "dlc" : "tro"; if (k === "col" ? current !== "col" : current !== "tro" || ckSub !== sub) { if (k !== "col") ckSub = sub; show(k === "col" ? "col" : "tro"); } };
  sw.innerHTML = `<button type="button" data-ck="tro" aria-pressed="false">${label("tro", "Trophies")}</button><button type="button" data-ck="col" aria-pressed="false">Legendary</button>${scope() === "both" ? '<button type="button" data-ck="dlc" aria-pressed="false">DLC</button>' : ""}`;
  if (scope() !== "both") ckSub = "tro";
  if (!sheet) {
    sheet = document.createElement("div");
    sheet.id = "moreSheet"; sheet.className = "moresheet"; sheet.hidden = true; sheet.setAttribute("role", "group"); sheet.setAttribute("aria-label", "More");
    sheet.innerHTML = `<div class="more-scrim" data-close></div><div class="more-list">${MORE.map((id) => { const t = TABS.find((x) => x[0] === id); return `<button type="button" class="more-row" data-go="${id}">${ico(t[2])}<span>${t[1]}</span></button>`; }).join("")}</div>`;
    $("tabs").closest("nav").after(sheet);
    sheet.addEventListener("click", (e) => {
      const go = e.target.closest("[data-go]");
      if (go) { const o = opener; closeMore(false); show(go.dataset.go); (o || $("tabs").querySelector('[data-tab="more"]')).focus(); }
      else if (e.target.closest("[data-close]")) closeMore();
    });
  }
  paintExtras();
}

function paintExtras() {
  const sw = $("ckSwitch");
  if (sw) {
    sw.hidden = !(CK.includes(current) && !hidden("col"));
    sw.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.ck === "col" ? current === "col" : current === "tro" && (b.dataset.ck === "dlc") === (ckSub === "dlc"))));
    $("v-tro").dataset.sub = scope() === "both" ? ckSub : "";
  }
  sheet?.querySelectorAll(".more-row").forEach((r) => { if (r.dataset.go === current) r.setAttribute("aria-current", "page"); else r.removeAttribute("aria-current"); });
}

function openMore(from) {
  opener = from || $("tabs").querySelector('[data-tab="more"]');
  sheet.style.setProperty("--navh", $("tabs").closest("nav").offsetHeight + "px");
  sheet.hidden = false;
  opener.setAttribute("aria-expanded", "true");
  (sheet.querySelector('[aria-current="page"]') || sheet.querySelector(".more-row")).focus();
}

function closeMore(restore = true) {
  if (!sheet || sheet.hidden) return;
  sheet.hidden = true;
  const m = $("tabs").querySelector('[data-tab="more"]');
  m?.setAttribute("aria-expanded", "false");
  if (restore && (opener || m)) (opener || m).focus();
  opener = null;
}

export function show(id, push = true) {
  if (!TABS.some((t) => t[0] === id) || hidden(id)) id = "route";
  current = id;
  if (CK.includes(id)) lastCk = id;
  closeMore(false);
  TABS.forEach(([t]) => { $("v-" + t).hidden = t !== id; });
  markTabs(id);
  paintExtras();
  if (push && location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
  window.scrollTo({ top: 0 });
  emit("shown", id);
}

export const currentTab = () => current;

export function initNav() {
  renderNav();
  $("tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tab]");
    if (!b) return;
    if (b.dataset.tab === "more") { sheet.hidden ? openMore(b) : closeMore(); return; }
    if (b.dataset.tab === "checklists") { if (!CK.includes(current)) show(hidden(lastCk) ? "tro" : lastCk); else closeMore(false); return; }
    show(b.dataset.tab);
  });
  $("tabs").addEventListener("keydown", (e) => {
    const bs = shownBtns();
    const i = bs.indexOf(document.activeElement);
    const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: bs.length - 1 }[e.key];
    if (i < 0 || to === undefined) return;
    e.preventDefault();
    const b = bs[(to + bs.length) % bs.length];
    if (b.dataset.tab === "more") { bs.forEach((x) => { x.tabIndex = x === b ? 0 : -1; }); b.focus(); return; }
    b.dataset.tab === "checklists" ? (CK.includes(current) || show(hidden(lastCk) ? "tro" : lastCk)) : show(b.dataset.tab);
    b.focus();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && sheet && !sheet.hidden) { e.preventDefault(); closeMore(); } });
  matchMedia(PHONE).addEventListener("change", () => closeMore(false));
  on("tab", (id) => show(id));
  // #map and #guide are also element ids on the page, so the browser scrolls to them after we have shown the tab: scroll back to the top.
  const top = () => requestAnimationFrame(() => window.scrollTo({ top: 0 }));
  window.addEventListener("hashchange", () => { show(location.hash.slice(1), false); top(); });
  window.addEventListener("load", top, { once: true });
  show(location.hash.slice(1) || "route", false);
}
