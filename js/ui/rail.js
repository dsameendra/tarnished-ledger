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
  $("ringVal").style.strokeDashoffset = 276.46 * (1 - frac);
  $("lblTro").textContent = trophiesWord();
  $("rail-sub").textContent = sc === "dlc" ? "Shadow of the Erdtree route" : sc === "both" ? "Elden Ring and Shadow of the Erdtree" : "Elden Ring 100% route";
}
