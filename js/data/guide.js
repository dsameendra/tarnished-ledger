// Static guide content. Rendered by js/ui/guide.js.

export const MISSABLES = [
  ["Elden Lord, Age of the Stars, Lord of the Frenzied Flame", "You get one ending per save. Back up your save before the final choice, or play three times."],
  ["Legendary Armaments", "Bolt of Gransax is in the Royal Capital, which is destroyed late in the game. Get it before you burn the Erdtree. Another player can also drop it for you in co-op."],
  ["Lichdragon Fortissax", "Never kill Fia. Without her you cannot enter the Deathbed Dream."],
  ["Age of the Stars (Ranni)", "Do not give Ranni the Amber Draught from Seluvis's questline. It locks her quest, and with it the Dark Moon Greatsword. Do not talk to her again after trying: three times and she kills you. You can undo it with a Celestial Dew: use Atone at the statue in the Church of Vows."],
  ["Lord of the Frenzied Flame", "Do not use Miquella's Needle in Dragonlord Placidusax's arena after inheriting the flame. It cancels the Frenzied Flame ending for good."],
];

export const STONESWORD = [
  ["Night's Sacred Ground, Nokron", "Mimic Tear Ashes", "1"],
  ["Golden Lineage Evergaol, Altus Plateau", "Godfrey Icon", "1"],
  ["Sainted Hero's Grave, Altus Plateau", "Ancient Dragon Knight Kristoff Ashes", "0 (its keys only open optional rooms)"],
  ["Cave of the Forlorn, Mountaintops", "Golden Order Greatsword", "2"],
  ["Prayer Room gate, Elphael", "Marika's Soreseal", "1"],
];

export const UPGRADE = [
  ["Regular weapon to +25", "12 each of Smithing Stone [1] to [8] (96 stones) plus 1 Ancient Dragon Smithing Stone. Each +3 tier uses 2, 4 and 6 stones."],
  ["Special weapon to +10", "1 each of Somber Smithing Stone [1] to [9] plus 1 Somber Ancient Dragon Smithing Stone."],
  ["Where to get them", "Smithing Stones turn up in mines and tunnels across the Lands Between. Smithing-Stone Miner's Bell Bearings [1] to [4] let the Twin Maiden Husks sell them without limit. The Ancient Dragon Smithing Stone is a hidden treasure in Crumbling Farum Azula."],
  ["Which weapon", "Pick one you enjoy and upgrade it as you go. Any armament counts for the trophy."],
];

export const PLATFORMS = {
  ps: {
    label: "PlayStation 4 and 5",
    html: `<p>Use PS Plus cloud storage. On PS4 you can also use a USB drive.</p>
<ol>
<li><b>PS5 only:</b> turn off auto-sync first, or the cloud copy can overwrite your backup. Settings, Saved Data and Game/App Settings, Saved Data (PS5), Sync Saved Data, Auto-Sync Saved Data, Off.</li>
<li>Go to Settings, Saved Data Management, Saved Data, Console Storage, Elden Ring, and upload it to cloud storage.</li>
<li>To restore, open Cloud Storage and copy the save back to the console, overwriting the current one.</li>
</ol>`,
  },
  steam: {
    label: "PC (Steam)",
    html: `<ol>
<li>Quit the game to the desktop.</li>
<li>Copy the folder <code>%APPDATA%\\EldenRing</code> (it holds a folder named after your Steam ID with <code>ER0000.sl2</code> inside) to a safe place. The guides also suggest copying your Steam <code>userdata</code> folder.</li>
<li>Before you restore, turn off Steam Cloud for the game (Library, right-click Elden Ring, Properties, General, untick Steam Cloud). Otherwise Steam can overwrite your restored save.</li>
<li>To restore, close the game, paste the backup over the original folder and launch again.</li>
</ol>`,
  },
  xbox: {
    label: "Xbox",
    html: `<p>Xbox has no simple manual save backup. The safest option is the three-playthrough route (NG, NG+, NG++). PowerPyx's roadmap describes a longer cloud-sync method if you want to try one playthrough.</p>`,
  },
};

export const ENDINGS = {
  intro: "Three ending trophies are needed: Age of the Stars, Elden Lord and Lord of the Frenzied Flame. You get one ending per playthrough.",
  routeA: [
    "Follow the route to the end of the Ashen Capital phase with Ranni's quest finished and Mohg, the Omen defeated. Do not inherit the Frenzied Flame yet.",
    "After Godfrey / Hoarah Loux, rest at the Elden Throne grace, quit to the title screen and back up your save.",
    "Beat Radagon and the Elden Beast, then use Ranni's blue summon sign for <b>Age of the Stars</b>.",
    "Restore the backup. Beat the final bosses again and interact with the statue without using Ranni's sign for <b>Elden Lord</b>.",
    "Restore again. Warp to the Cathedral of the Forsaken (Mohg, the Omen), break the illusory wall behind the altar, drop to the bottom, remove all your armour and open the scorched door to inherit the Frenzied Flame from the Three Fingers. Beat the final bosses for <b>Lord of the Frenzied Flame</b>.",
  ],
  routeB: [
    "Get two Great Runes (Godrick and Rennala are easiest).",
    "Reach Leyndell via the Grand Lift of Dectus (both medallion halves) or the Ruin-Strewn Precipice. Or kill Radahn, go through Nokron, Siofra Aqueduct and Deeproot Depths, beat Fia's Champions and take the teleporter to Leyndell.",
    "Beat Godfrey's shade and Morgott to remove the seal on the Forbidden Lands.",
    "Beat the Fire Giant and burn the Erdtree.",
    "Beat the Godskin Duo and Maliketh in Crumbling Farum Azula.",
    "Beat Gideon, Hoarah Loux and Radagon / Elden Beast, choosing the ending you still need.",
  ],
};
