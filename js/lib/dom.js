export const $ = (id) => document.getElementById(id);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const bus = new EventTarget();
export const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
export const on = (name, fn) => bus.addEventListener(name, (e) => fn(e.detail));
