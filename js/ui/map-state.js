// Persisted map choices. Which markers you have found and which categories are shown live in the store, so
// they sync with your other devices. Layout choices (panel, collapsed groups, last view, overview) stay on this device.
import * as store from "../lib/store.js";

const FILTER = "tarnished-ledger:map-filter";
const VIEW = "tarnished-ledger:map-view";

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

const saved = read(FILTER, {});
export const filter = { world: saved.world ?? null, under: Boolean(saved.under), lay: ["base", "under", "hub"].includes(saved.lay) ? saved.lay : saved.under ? "under" : "base", panel: saved.panel ?? null, mini: saved.mini, below: Boolean(saved.below), tab: saved.tab === "phases" ? "phases" : "prog", pgScope: saved.pgScope === "all" ? "all" : "essentials", pgClosed: Array.isArray(saved.pgClosed) ? saved.pgClosed : [], collapsed: saved.collapsed && typeof saved.collapsed === "object" ? saved.collapsed : {} };
export const saveFilter = () => write(FILTER, filter);

// Synced choices: on, cats (null means the default set), hideFound, route.
export const prefs = () => store.mapPrefs();
export const setPref = (patch) => store.setMapPrefs(patch);

export const views = read(VIEW, {});
export const saveView = (mode, v) => { views[mode] = v; write(VIEW, views); };

export const isFound = (id) => store.isFound(id);
export const setFound = (id, on) => store.setFound(id, on);
