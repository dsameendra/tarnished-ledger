// Persisted map choices. Every read and write is guarded: storage can be blocked or full.
const FILTER = "tarnished-ledger:map-filter";
const VIEW = "tarnished-ledger:map-view";
const FOUND = "tarnished-ledger:map-found";

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

// cats: null means the guide categories; otherwise the list of enabled category ids.
export const filter = { on: true, cats: null, hideFound: false, route: true, panel: null, collapsed: {}, ...read(FILTER, {}) };
export const saveFilter = () => write(FILTER, filter);

export const views = read(VIEW, {});
export const saveView = (mode, v) => { views[mode] = v; write(VIEW, views); };

const found = new Set(read(FOUND, []));
export const isFound = (id) => found.has(id);
export function setFound(id, on) {
  if (on) found.add(id); else found.delete(id);
  write(FOUND, [...found]);
}
