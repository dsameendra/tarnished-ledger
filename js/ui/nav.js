import { $, $$, emit, on } from "../lib/dom.js";
import { ico } from "../lib/icons.js";
import { scope } from "../lib/model.js";
import { trophiesWord } from "../lib/labels.js";

const TABS = [
  ["route", "Route", "go"],
  ["tro", "Trophies", "crown"],
  ["col", "Legendary", "arm"],
  ["map", "Map", "map"],
  ["guide", "Guide", "quest"],
  ["set", "Settings", "hammer"],
];

let current = "route";

const hidden = (id) => id === "col" && scope() === "dlc";
const label = (id, text) => (id === "tro" ? (scope() === "dlc" ? "Goals" : trophiesWord()) : text);

export function renderNav() {
  const tabs = TABS.filter(([id]) => !hidden(id));
  $("tabs").style.setProperty("--tabs", tabs.length);
  $("tabs").innerHTML = tabs.map(([id, text, icon]) =>
    `<button type="button" role="tab" data-tab="${id}" aria-selected="${id === current}" aria-controls="v-${id}" tabindex="${id === current ? 0 : -1}">${ico(icon)}<span>${label(id, text)}</span></button>`).join("");
  if (hidden(current)) show("route");
}

export function show(id, push = true) {
  if (!TABS.some((t) => t[0] === id) || hidden(id)) id = "route";
  current = id;
  TABS.forEach(([t]) => { $("v-" + t).hidden = t !== id; });
  $$("#tabs button").forEach((b) => { b.setAttribute("aria-selected", String(b.dataset.tab === id)); b.tabIndex = b.dataset.tab === id ? 0 : -1; });
  if (push && location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
  window.scrollTo({ top: 0 });
  emit("shown", id);
}

export const currentTab = () => current;

export function initNav() {
  renderNav();
  $("tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tab]");
    if (b) show(b.dataset.tab);
  });
  $("tabs").addEventListener("keydown", (e) => {
    const bs = $$("#tabs button");
    const i = bs.indexOf(document.activeElement);
    const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: bs.length - 1 }[e.key];
    if (i < 0 || to === undefined) return;
    e.preventDefault();
    const b = bs[(to + bs.length) % bs.length];
    show(b.dataset.tab);
    b.focus();
  });
  on("tab", (id) => show(id));
  // #map and #guide are also element ids on the page, so the browser scrolls to them after we have shown the tab: scroll back to the top.
  const top = () => requestAnimationFrame(() => window.scrollTo({ top: 0 }));
  window.addEventListener("hashchange", () => { show(location.hash.slice(1), false); top(); });
  window.addEventListener("load", top, { once: true });
  show(location.hash.slice(1) || "route", false);
}
