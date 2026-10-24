import { $ } from "../lib/dom.js";
import { counts, scope } from "../lib/model.js";
import { trophiesWord } from "../lib/labels.js";

function bar(label, bar, [n, t]) {
  $(label).textContent = `${n}/${t}`;
  $(bar).style.width = (t ? (n / t) * 100 : 0) + "%";
}

export function renderRail() {
  const c = counts();
  const sc = scope();
  bar("sSteps", "bSteps", c.steps);
  bar("sTro", "bTro", c.trophies);
  bar("sLeg", "bLeg", c.legends);
  bar("sGoal", "bGoal", c.goals);
  bar("sBless", "bBless", c.blessings);
  $("mTro").hidden = sc === "dlc";
  $("mLeg").hidden = sc === "dlc";
  $("mGoal").hidden = sc === "base";
  $("mBless").hidden = sc === "base";
  const [done, total] = c.steps;
  const frac = total ? done / total : 0;
  $("pct").textContent = Math.round(frac * 100) + "%";
  $("ring").setAttribute("aria-label", `Overall progress: ${done} of ${total} steps, ${Math.round(frac * 100)}%`);
  $("ringVal").style.strokeDashoffset = 276.46 * (1 - frac);
  $("lblTro").textContent = trophiesWord();
  $("heroSumText").textContent = done === 0 ? `Nothing ticked yet · ${total} steps` : `${done}/${total} steps · ${sc === "dlc" ? `${c.goals[0]}/${c.goals[1]} goals` : `${c.trophies[0]}/${c.trophies[1]} ${trophiesWord().toLowerCase()}`}`;
  $("rail-sub").textContent = sc === "dlc" ? "Shadow of the Erdtree route" : sc === "both" ? "Elden Ring and Shadow of the Erdtree" : "Elden Ring 100% route";
}

// On a phone the progress card is one line; this opens the per-category bars.
export function initRail() {
  $("heroSum").addEventListener("click", () => {
    const open = !document.querySelector(".hero").classList.contains("open");
    document.querySelector(".hero").classList.toggle("open", open);
    $("heroSum").setAttribute("aria-expanded", String(open));
  });
}
