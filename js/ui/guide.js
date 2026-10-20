import * as store from "../lib/store.js";
import { $ } from "../lib/dom.js";
import { ico, PATHS } from "../lib/icons.js";
import { MISSABLES, STONESWORD, UPGRADE, PLATFORMS, ENDINGS } from "../data/guide.js";
import { trophiesWord } from "../lib/labels.js";

const LEGEND = [
  ["go", "Travel or move to a place"],
  ["boss", "Boss fight"],
  ["item", "Item or pickup"],
  ["quest", "NPC or questline step"],
  ["key", "Key item"],
  ["map", "Map fragment"],
  ["warn", "Missable or lock-out warning"],
  ["arm", "Legendary Armament"],
  ["ash", "Legendary Ashen Remains"],
  ["sp", "Legendary Sorcery or Incantation"],
  ["tal", "Legendary Talisman"],
];

export function renderGuide() {
  const p = store.setting("platform");
  const t = trophiesWord().toLowerCase();
  const rows = (items) => items.map((i) => `<li>${i}</li>`).join("");
  $("guide").innerHTML = `
<div class="prose">
  <h3>At a glance</h3>
  <p>There are 42 ${t} (1 Platinum, 3 Gold, 14 Silver, 24 Bronze), all offline. Expect 60 to 100 hours. You do not need every weapon, spell or boss: only the bosses and legendary items in this route count. DLC is not required.</p>
  <p>You can finish everything in one playthrough if you back up your save before the ending, or in three playthroughs if you cannot.</p>
</div>

<div class="prose">
  <h3>Five things you can miss</h3>
  <table class="keytable"><tbody>${MISSABLES.map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join("")}</tbody></table>
</div>

<div class="prose">
  <h3>What the icons mean</h3>
  <ul class="icolist">${LEGEND.map(([k, label]) => `<li><span class="${k === "warn" ? "ico" : "lico"}" ${k === "warn" ? 'style="background:color-mix(in srgb,var(--warn) 18%,transparent);color:var(--warn)"' : ""}>${ico(k)}</span>${label}</li>`).join("")}</ul>
  <p>Gold chips on a step show the ${t.replace(/s$/, "")} it completes or the legendary item it gives. Wiki links open the matching page.</p>
</div>

<div class="prose">
  <h3>Stonesword Keys</h3>
  <p>Pick up every key you find. Around 7 to 9 are used on this route.</p>
  <table class="keytable"><thead><tr><th>Where</th><th>You get</th><th>Keys</th></tr></thead><tbody>${STONESWORD.map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td></tr>`).join("")}</tbody></table>
</div>

<div class="prose">
  <h3>God-Slaying Armament and upgrades</h3>
  <table class="keytable"><tbody>${UPGRADE.map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join("")}</tbody></table>
</div>

<div class="prose">
  <h3>Useful facts</h3>
  <ul>${rows([
    "Greyoll's Roar costs 3 Dragon Hearts and Greyoll must be dead first. Dragon Hearts drop from dragons such as Greyoll, Flying Dragon Agheel and Glintstone Dragon Smarag.",
    "The Great Rune trophy needs one Great Rune restored at a Divine Tower. Godrick's, at the Divine Tower of Limgrave, is the easiest.",
    "Legendary Armaments and Talismans can be received from another player in co-op. Ashen Remains and Spells cannot. Remembrance weapons do not count.",
    "Rykard, Mohg (Lord of Blood), Malenia and Dragonlord Placidusax are optional for the story but each has a trophy.",
    "A good rune farm is the first grace in Mohgwyn Palace, Palace Approach Ledge-Road.",
  ])}</ul>
</div>

<div class="prose">
  <h3>Endings</h3>
  <p>${ENDINGS.intro}</p>
  <h3>Route A: one playthrough with backups</h3>
  <ol>${rows(ENDINGS.routeA)}</ol>
  <h3>Route B: NG, NG+ and NG++</h3>
  <p>Start New Game+ from the giant round table at the Roundtable Hold after the credits. Later runs only need the shortest path.</p>
  <ol>${rows(ENDINGS.routeB)}</ol>
  <div class="callout">Keep the Frenzied Flame for its own run or its own backup. Once inherited it overrides every other ending. Do not open the red door behind Mohg, the Omen until you want that ending.</div>
</div>

<div class="prose">
  <h3>How to back up your save</h3>
  <p>Quit to the title screen first, because the game autosaves constantly.</p>
  ${Object.entries(PLATFORMS).map(([k, v]) => `<details ${k === p ? "open" : ""}><summary>${v.label}</summary>${v.html}</details>`).join("")}
</div>`;
}
