import { $, $$, emit, on } from "../lib/dom.js";
import { ico } from "../lib/icons.js";

const TABS = [
  ["route", "Route", "go"],
  ["tro", "Trophies", "crown"],
  ["col", "Legendary", "arm"],
  ["map", "Map", "map"],
  ["guide", "Guide", "quest"],
  ["set", "Settings", "hammer"],
];

let current = "route";

export function show(id, push = true) {
  if (!TABS.some((t) => t[0] === id)) id = "route";
  current = id;
  TABS.forEach(([t]) => { $("v-" + t).hidden = t !== id; });
  $$("#tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === id)));
  if (push && location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
  window.scrollTo({ top: 0 });
  emit("shown", id);
}

export const currentTab = () => current;

export function initNav() {
  $("tabs").innerHTML = TABS.map(([id, label, icon]) =>
    `<button type="button" role="tab" data-tab="${id}" aria-selected="false">${ico(icon)}<span>${label}</span></button>`).join("");
  $("tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tab]");
    if (b) show(b.dataset.tab);
  });
  on("tab", (id) => show(id));
  window.addEventListener("hashchange", () => show(location.hash.slice(1), false));
  show(location.hash.slice(1) || "route", false);
}
