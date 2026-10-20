// Derived lookups over the route data. Everything here is pure except for reads from the store.

import { PHASES as BASE_PHASES } from "../data/route.js";
import { DLC_PHASES } from "../data/dlc-route.js";
import { GOALS } from "../data/dlc-goals.js";
import { TROPHIES, COLLECTIONS } from "../data/trophies.js";
import { isDone, setting, counter } from "./store.js";

export { TROPHIES, COLLECTIONS, GOALS };

export const PHASES = [
  ...BASE_PHASES.map((p) => ({ ...p, dlc: false })),
  ...DLC_PHASES.map((p) => ({ ...p, dlc: true })),
];
const baseCount = BASE_PHASES.length;
export const phaseLabel = (pi) => (PHASES[pi].dlc ? "D" + (pi - baseCount + 1) : String(pi));

export const steps = [];
export const stepById = new Map();
export const byTrophy = {};
export const byCollectible = {};
export const byGoal = {};

PHASES.forEach((phase, pi) => phase.s.forEach(([kind, text, opts], si) => {
  const step = { id: `${phase.id}.${si}`, kind, text, opts: opts || {}, pi };
  steps.push(step);
  stepById.set(step.id, step);
  if (step.opts.tr) byTrophy[step.opts.tr] = step;
  if (step.opts.c) byCollectible[step.opts.c] = step;
  if (step.opts.g) byGoal[step.opts.g] = step;
}));

export const tickSteps = steps.filter((s) => s.kind !== "tip");
export const validIds = new Set(tickSteps.map((s) => s.id));
export const trophyName = Object.fromEntries(TROPHIES.map((t) => [t[0], t[1]]));
export const collectibleName = {};
export const collectibleGroup = {};
Object.entries(COLLECTIONS).forEach(([group, [, items]]) => items.forEach(([id, name]) => {
  collectibleName[id] = name;
  collectibleGroup[id] = group;
}));
export const collectibleIds = Object.keys(collectibleName);
export const goalList = GOALS.flatMap(([, items]) => items);

// "base", "both" or "dlc", from the two settings.
export function scope() {
  if (!setting("dlc")) return "base";
  return setting("focus") === "dlc" ? "dlc" : "both";
}
export function inScope(pi) {
  const s = scope();
  return s === "both" || (s === "dlc") === Boolean(PHASES[pi].dlc);
}
export const scopedSteps = () => tickSteps.filter((s) => inScope(s.pi));

export function currentPhase() {
  const next = scopedSteps().find((s) => !isDone(s.id));
  return next ? next.pi : -1;
}

export function trophyDone(key) {
  if (key === "platinum") return TROPHIES.slice(1).every((t) => trophyDone(t[0]));
  if (COLLECTIONS[key]) return COLLECTIONS[key][1].every(([id]) => byCollectible[id] && isDone(byCollectible[id].id));
  const step = byTrophy[key];
  return step ? isDone(step.id) : false;
}

export const goalDone = (key) => Boolean(byGoal[key] && isDone(byGoal[key].id));

export function counts() {
  const list = scopedSteps();
  const trophiesDone = TROPHIES.filter((t) => trophyDone(t[0])).length;
  const legendDone = collectibleIds.filter((id) => byCollectible[id] && isDone(byCollectible[id].id)).length;
  return {
    steps: [list.filter((s) => isDone(s.id)).length, list.length],
    trophies: [trophiesDone, TROPHIES.length],
    legends: [legendDone, collectibleIds.length],
    goals: [goalList.filter(([k]) => goalDone(k)).length, goalList.length],
    blessings: [counter("sf") + counter("rsa"), 75],
  };
}

export function phaseCounts(pi) {
  const list = tickSteps.filter((s) => s.pi === pi);
  return [list.filter((s) => isDone(s.id)).length, list.length];
}

// Wiki links use the wiki.gg search, which jumps straight to an exact page title when one exists.
export const wikiUrl = (term) => "https://eldenring.wiki.gg/wiki/Special:Search?go=Go&search=" + encodeURIComponent(term);
