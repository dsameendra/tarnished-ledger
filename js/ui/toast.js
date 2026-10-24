// One short message with an optional Undo, shown above the bottom bar (or bottom-left on wide screens). A new toast replaces the old one.
import { $ } from "../lib/dom.js";

const SHOW_MS = 7000;
let timer = 0;
let undo = null;

export function hideToast() {
  clearTimeout(timer);
  undo = null;
  const box = $("toast");
  if (box) box.hidden = true;
}

export function showToast(message, onUndo) {
  const box = $("toast");
  if (!box) return;
  clearTimeout(timer);
  undo = onUndo || null;
  $("toastMsg").textContent = message;
  $("toastUndo").hidden = !undo;
  // a status region only announces text that changes while it is visible: toggle hidden first
  box.hidden = false;
  timer = setTimeout(hideToast, SHOW_MS);
}

export function initToast() {
  $("toastUndo").addEventListener("click", () => {
    const fn = undo;
    hideToast();
    if (fn) fn();
  });
  $("toast").addEventListener("keydown", (e) => { if (e.key === "Escape") hideToast(); });
}
