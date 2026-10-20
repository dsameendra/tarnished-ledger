import * as store from "../lib/store.js";
import { $ } from "../lib/dom.js";
import { ico, PATHS } from "../lib/icons.js";
import { MISSABLES, STONESWORD, UPGRADE, PLATFORMS, ENDINGS } from "../data/guide.js";
import { trophiesWord } from "../lib/labels.js";
import { scope } from "../lib/model.js";

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

function dlcGuide() {
  return `<div class="prose" id="g-dlc">
  <h3>Shadow of the Erdtree</h3>
  <p>The expansion has no trophies or achievements, so this app tracks it as goals and counters. Nothing here changes your trophy list.</p>
  <h3>Getting in</h3>
  <ol>
    <li>Defeat Starscourge Radahn in Caelid and Mohg, Lord of Blood, at the Mohgwyn Dynasty Mausoleum. Both must be dead.</li>
    <li>Find Needle Knight Leda near the cocoon in Mohg's arena, then touch the withered arm inside the cocoon.</li>
    <li>You arrive on the Gravesite Plain in the Realm of Shadow.</li>
  </ol>
  <h3>Blessings</h3>
  <p>Both blessings are raised at any site of grace and only take effect inside the Realm of Shadow.</p>
  <table class="keytable kv"><tbody>
    <tr><th>Scadutree Blessing</th><td>Maximum level 20, using 50 Scadutree Fragments in total. Level 1 costs 1 fragment, levels 2 to 9 cost 2 each, and levels 10 to 20 cost 3 each.</td></tr>
    <tr><th>Revered Spirit Ash Blessing</th><td>Maximum level 10, using 25 Revered Spirit Ashes in total. Levels 1 to 3 cost 1 each, 4 and 5 cost 2, 6 to 8 cost 3, level 9 costs 4 and level 10 costs 5. It boosts summoned spirits and Torrent.</td></tr>
  </tbody></table>
  <div class="callout">Back up your save before burning the Sealing Tree. Burning it locks you out of finishing the DLC's NPC questlines, so complete those first.</div>
</div>`;
}

export function renderGuide() {
  const p = store.setting("platform");
  const t = trophiesWord().toLowerCase();
  const rows = (items) => items.map((i) => `<li>${i}</li>`).join("");
  const toc = [["g-glance", "At a glance"], ["g-miss", "Missables"], ["g-icons", "Icons"], ["g-keys", "Stonesword Keys"], ["g-up", "Upgrades"], ["g-facts", "Facts"], ["g-end", "Endings"], ...(scope() === "base" ? [] : [["g-dlc", "Shadow of the Erdtree"]]), ["g-save", "Save backup"]];
  $("guide").innerHTML = `
<nav class="toc" aria-label="Guide sections">${toc.map(([id, t]) => `<button type="button" data-to="${id}">${t}</button>`).join("")}</nav>
<div class="prose" id="g-glance">
  <h3>At a glance</h3>
  <p>There are 42 ${t} (1 Platinum, 3 Gold, 14 Silver, 24 Bronze), all offline. Expect 60 to 100 hours. You do not need every weapon, spell or boss: only the bosses and legendary items in this route count. The DLC is not required, and it has no trophies of its own.</p>
  <p>You can finish everything in one playthrough if you back up your save before the ending, or in three playthroughs if you cannot.</p>
</div>

<div class="prose" id="g-miss">
  <h3>Five things you can miss</h3>
  <table class="keytable kv"><tbody>${MISSABLES.map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join("")}</tbody></table>
</div>

<div class="prose" id="g-icons">
  <h3>What the icons mean</h3>
  <ul class="icolist">${LEGEND.map(([k, label]) => `<li><span class="${k === "warn" ? "ico" : "lico"}" ${k === "warn" ? 'style="background:color-mix(in srgb,var(--warn) 18%,transparent);color:var(--warn)"' : ""}>${ico(k)}</span>${label}</li>`).join("")}</ul>
  <p>Gold chips on a step show the ${t.replace(/s$/, "")} it completes or the legendary item it gives. Wiki links open the matching page.</p>
</div>

<div class="prose" id="g-keys">
  <h3>Stonesword Keys</h3>
  <p>Pick up every key you find. Around 7 to 9 are used on this route.</p>
  <table class="keytable"><thead><tr><th>Where</th><th>You get</th><th>Keys</th></tr></thead><tbody>${STONESWORD.map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td></tr>`).join("")}</tbody></table>
</div>

<div class="prose" id="g-up">
  <h3>God-Slaying Armament and upgrades</h3>
  <table class="keytable kv"><tbody>${UPGRADE.map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join("")}</tbody></table>
</div>

<div class="prose" id="g-facts">
  <h3>Useful facts</h3>
  <ul>${rows([
    "Greyoll's Roar costs 3 Dragon Hearts and Greyoll must be dead first. Dragon Hearts drop from dragons such as Greyoll, Flying Dragon Agheel and Glintstone Dragon Smarag.",
    "The Great Rune trophy needs one Great Rune restored at a Divine Tower. Godrick's, at the Divine Tower of Limgrave, is the easiest.",
    "Legendary Armaments and Talismans can be received from another player in co-op. Ashen Remains and Spells cannot. Remembrance weapons do not count.",
    "Rykard, Mohg (Lord of Blood), Malenia and Dragonlord Placidusax are optional for the story but each has a trophy.",
    "A good rune farm is the first grace in Mohgwyn Palace, Palace Approach Ledge-Road.",
  ])}</ul>
</div>

<div class="prose" id="g-end">
  <h3>Endings</h3>
  <p>${ENDINGS.intro}</p>
  <h3>Route A: one playthrough with backups</h3>
  <ol>${rows(ENDINGS.routeA)}</ol>
  <h3>Route B: NG, NG+ and NG++</h3>
  <p>Start New Game+ from the giant round table at the Roundtable Hold after the credits. Later runs only need the shortest path.</p>
  <ol>${rows(ENDINGS.routeB)}</ol>
  <div class="callout">Keep the Frenzied Flame for its own run or its own backup. Once inherited it overrides every other ending. Do not open the red door behind Mohg, the Omen until you want that ending.</div>
</div>

${scope() === "base" ? "" : dlcGuide()}

<div class="prose" id="g-save">
  <h3>How to back up your save</h3>
  <p>Quit to the title screen first, because the game autosaves constantly.</p>
  ${Object.entries(PLATFORMS).map(([k, v]) => `<details ${k === p ? "open" : ""}><summary>${v.label}</summary>${v.html}</details>`).join("")}
</div>`;
}

export function initGuide() {
  $("guide").addEventListener("click", (e) => {
    const b = e.target.closest("[data-to]");
    const sec = b && $(b.dataset.to);
    if (!sec) return;
    sec.scrollIntoView({ behavior: "smooth", block: "start" });
    const h = sec.querySelector("h3");
    h.tabIndex = -1;
    h.focus({ preventScroll: true });
  });
}
