// The words used when you tick something on the map, chosen by what the marker is.
// mark: the checkbox label. done: the state once ticked. todo: the heading for what is left. none: the empty-list text.
export const VERBS = {
  defeat: { mark: "Mark defeated", done: "Defeated", todo: "Yet to defeat", all: "all defeated" },
  pickup: { mark: "Mark picked up", done: "Picked up", todo: "Yet to pick up", all: "all picked up" },
  discover: { mark: "Mark discovered", done: "Discovered", todo: "Yet to discover", all: "all discovered" },
  clear: { mark: "Mark cleared", done: "Cleared", todo: "Yet to clear", all: "all cleared" },
  open: { mark: "Mark opened", done: "Opened", todo: "Yet to open", all: "all opened" },
  meet: { mark: "Mark met", done: "Met", todo: "Yet to meet", all: "all met" },
  finish: { mark: "Mark done", done: "Done", todo: "Yet to do", all: "all done" },
};

// Default verb for each group of categories, with exceptions by category id.
const BY_GROUP = { route: "pickup", places: "discover", bosses: "defeat", keys: "pickup", gear: "pickup", items: "pickup", materials: "pickup", npcs: "meet", other: "finish", dlc: "pickup" };
const BY_CAT = {
  5656: "clear", 5655: "clear", 5660: "clear", 5665: "clear", // legacy dungeons, dungeons, evergaols, mausoleums
  5667: "open", // imp seal statues
  5674: "pickup", // great runes
  5718: "discover", 5720: "discover", // guiding statues, telescopes
  11318: "discover", 6040: "discover", // Miquella's crosses, stone cairns
  5706: "finish", 5716: "finish", 5715: "finish", // quests, puzzles, summoning sigils
  5719: "pickup", // lore
};

export function verbFor(cat) {
  return VERBS[BY_CAT[cat.id] || BY_GROUP[cat.group] || "finish"];
}
