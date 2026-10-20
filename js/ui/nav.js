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
    `<button type="button" role="tab" data-tab="${id}" aria-selected="${id === current}">${ico(icon)}<span>${label(id, text)}</span></button>`).join("");
  if (hidden(current)) show("route");
}

export function show(id, push = true) {
  if (!TABS.some((t) => t[0] === id) || hidden(id)) id = "route";
  current = id;
  TABS.forEach(([t]) => { $("v-" + t).hidden = t !== id; });
  $$("#tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === id)));
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
  on("tab", (id) => show(id));
  window.addEventListener("hashchange", () => show(location.hash.slice(1), false));
  show(location.hash.slice(1) || "route", false);
}
