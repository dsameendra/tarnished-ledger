// One short message with an optional Undo, shown above the bottom bar (centred at the bottom on wide screens). A new toast replaces the old one.
import { $ } from "../lib/dom.js";

const SHOW_MS = 9000;
let timer = 0;
let undo = null;
let returnTo = null;

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
  returnTo = document.activeElement;
  $("toastMsg").textContent = message;
  $("toastUndo").hidden = !undo;
  // a status region only announces text that changes while it is visible: toggle hidden first
  box.hidden = false;
  arm();
}

const arm = () => { clearTimeout(timer); timer = setTimeout(hideToast, SHOW_MS); };

export function initToast() {
  // stay while the pointer is over it or focus is inside it
  $("toast").addEventListener("mouseenter", () => clearTimeout(timer));
  $("toast").addEventListener("focusin", () => clearTimeout(timer));
  $("toast").addEventListener("mouseleave", () => { if (!$("toast").hidden) arm(); });
  $("toast").addEventListener("focusout", () => { if (!$("toast").hidden) arm(); });
  // Ctrl/Cmd+Z undoes the last tick while the toast is showing, so the keyboard does not have to reach it
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z" && undo && !$("toast").hidden && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "")) {
      e.preventDefault();
      $("toastUndo").click();
    }
  });
  $("toastUndo").addEventListener("click", () => {
    const fn = undo;
    const back = returnTo;
    hideToast();
    if (fn) fn();
    // a keyboard user who used Undo goes back to where they were
    if (back && document.contains(back) && back !== document.body) back.focus({ preventScroll: true });
  });
  $("toast").addEventListener("keydown", (e) => { if (e.key === "Escape") hideToast(); });
}
