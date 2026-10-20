import { $ } from "../lib/dom.js";
import { counts } from "../lib/model.js";
import { trophiesWord } from "../lib/labels.js";

function bar(label, bar, [n, t]) {
  $(label).textContent = `${n}/${t}`;
  $(bar).style.width = (t ? (n / t) * 100 : 0) + "%";
}

export function renderRail() {
  const c = counts();
  bar("sSteps", "bSteps", c.steps);
  bar("sTro", "bTro", c.trophies);
  bar("sLeg", "bLeg", c.legends);
  const [done, total] = c.steps;
  $("pct").textContent = Math.round((done / total) * 100) + "%";
  $("ringVal").style.strokeDashoffset = 276.46 * (1 - done / total);
  $("lblTro").textContent = trophiesWord();
}
