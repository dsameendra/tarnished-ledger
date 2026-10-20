// Marker taxonomy for the zoomable map. Source ids are MapGenie category ids.
// A category is { id, title, group, glyph, guide, virtual?, dlc? }.
//   guide:   true when something in this guide's route needs it (shown by default).
//   virtual: not a MapGenie category. scripts/build-map-data.mjs carves these out of larger
//            categories (Weapon, Spirit Ashes, Key Item ...) by exact location id, so that the
//            default view shows the route items and not every weapon in the game.
//   dlc:     only present on the Realm of Shadow layer.
// glyph keys are drawn by the viewer: grace boss dungeon key weapon spell talisman ash armor npc
// item material gate tower misc.

export const GROUPS = [
  { id: "route", title: "Route items" },
  { id: "places", title: "Places" },
  { id: "bosses", title: "Bosses & enemies" },
  { id: "keys", title: "Key items" },
  { id: "gear", title: "Equipment" },
  { id: "items", title: "Items" },
  { id: "materials", title: "Materials" },
  { id: "npcs", title: "Characters" },
  { id: "other", title: "Other" },
  { id: "dlc", title: "Shadow of the Erdtree" },
];

const c = (id, title, group, glyph, guide, extra = {}) => ({ id, title, group, glyph, guide, ...extra });

export const CATS = [
  // Route items: carved out of the MapGenie categories by id (see VIRTUAL_IDS in the build script).
  c(90001, "Legendary Armament", "route", "weapon", true, { virtual: true }),
  c(90002, "Legendary Ashen Remains", "route", "ash", true, { virtual: true }),
  c(90003, "Legendary Spell", "route", "spell", true, { virtual: true }),
  c(90004, "Legendary Talisman", "route", "talisman", true, { virtual: true }),
  c(90005, "Route Key Item", "route", "key", true, { virtual: true }),
  c(5674, "Great Rune", "route", "key", true),
  c(5672, "Map Fragment", "route", "key", true),
  c(5675, "Stonesword Key", "route", "key", true),
  c(5684, "Dragon Heart", "route", "item", true),
  c(5722, "Ancient Smithing Stone", "route", "material", true),

  c(5658, "Site of Grace", "places", "grace", true),
  c(5656, "Legacy Dungeon", "places", "dungeon", true),
  c(5655, "Dungeon", "places", "dungeon", true),
  c(5660, "Evergaol", "places", "gate", true),
  c(5664, "Divine Tower", "places", "tower", true),
  c(5666, "Dragon Shrine", "places", "misc", true),
  c(5667, "Imp Seal Statue", "places", "gate", true),
  c(5657, "Landmark", "places", "misc", false),
  c(5668, "Minor Erdtree", "places", "misc", false),
  c(5671, "Portal", "places", "gate", false),
  c(5670, "Elevator", "places", "gate", false),
  c(5713, "Hidden Passage", "places", "gate", false),
  c(5661, "Martyr Effigy", "places", "misc", false),
  c(5659, "Stake of Marika", "places", "misc", false),
  c(5669, "Spiritspring Jump", "places", "misc", false),
  c(5665, "Wandering Mausoleum", "places", "dungeon", false),
  c(5662, "Smithing Table", "places", "misc", false),

  c(5710, "Legendary Boss", "bosses", "boss", true),
  c(5711, "Great Boss", "bosses", "boss", true),
  c(5699, "Boss", "bosses", "boss", true),
  c(5700, "Elite Enemy", "bosses", "boss", false),
  c(5698, "Enemy", "bosses", "misc", false),
  c(5697, "Invasion", "bosses", "npc", false),

  c(5673, "Key Item", "keys", "key", false),
  c(6031, "Remembrance", "keys", "key", false),
  c(6033, "Bell Bearing", "keys", "key", false),
  c(5676, "Cookbook", "keys", "item", false),
  c(5728, "Spellbook", "keys", "item", false),
  c(5726, "Talisman Pouch", "keys", "item", false),
  c(5725, "Memory Stone", "keys", "item", false),
  c(5683, "Golden Seed", "keys", "item", false),
  c(5678, "Sacred Tear", "keys", "item", false),
  c(5679, "Larval Tear", "keys", "item", false),
  c(5721, "Painting", "keys", "misc", false),
  c(6032, "Tool", "keys", "item", false),
  c(6034, "Whetblade", "keys", "item", false),
  c(6038, "Cracked Pot", "keys", "item", false),
  c(6039, "Ritual Pot", "keys", "item", false),
  c(6037, "Perfume Bottle", "keys", "item", false),

  c(5688, "Weapon", "gear", "weapon", false),
  c(5690, "Shield", "gear", "weapon", false),
  c(5689, "Armor", "gear", "armor", false),
  c(5691, "Talisman", "gear", "talisman", false),
  c(5692, "Sorcery", "gear", "spell", false),
  c(5693, "Incantation", "gear", "spell", false),
  c(5714, "Ash of War", "gear", "item", false),

  c(5687, "Spirit Ashes", "items", "ash", false),
  c(5677, "Crystal Tear", "items", "item", false),
  c(5681, "Consumable", "items", "item", false),
  c(5682, "Ammunition", "items", "item", false),
  c(5712, "Golden Rune", "items", "item", false),
  c(5724, "Rune Arc", "items", "item", false),
  c(5717, "Cerulean Scarab", "items", "item", false),
  c(5701, "Crimson Scarab", "items", "item", false),
  c(5727, "Deathroot", "items", "item", false),
  c(5680, "Multiplayer Item", "items", "item", false),
  c(5707, "Gesture", "items", "item", false),
  c(5686, "Item", "items", "item", false),

  c(5685, "Smithing Stone", "materials", "material", false),
  c(5703, "Crafting Material", "materials", "material", false),
  c(5702, "Glovewort", "materials", "material", false),
  c(5723, "Great Glovewort", "materials", "material", false),
  c(6035, "Ghost Glovewort", "materials", "material", false),
  c(6028, "Miquella's Lily", "materials", "material", false),
  c(6027, "Trina's Lily", "materials", "material", false),
  c(5709, "Ruin Fragment", "materials", "material", false),
  c(6029, "Sacramental Bud", "materials", "material", false),

  c(5696, "Character", "npcs", "npc", false),
  c(5694, "Merchant", "npcs", "npc", false),
  c(6036, "Ghost", "npcs", "npc", false),
  c(5695, "Trainer", "npcs", "npc", false),

  c(5706, "Quest", "other", "misc", false),
  c(5719, "Lore", "other", "misc", false),
  c(5716, "Puzzle", "other", "misc", false),
  c(5715, "Summoning Sigil", "other", "misc", false),
  c(5718, "Guiding Statue", "other", "misc", false),
  c(5720, "Birdseye Telescope", "other", "misc", false),
  c(5704, "Miscellaneous", "other", "misc", false),

  // Realm of Shadow only. Titles for these ids are not in MapGenie's category list for the base
  // map, so they are named after the markers themselves.
  c(11317, "Scadutree Fragment", "dlc", "item", true, { dlc: true }),
  c(11316, "Revered Spirit Ash", "dlc", "ash", true, { dlc: true }),
  c(11318, "Miquella's Cross", "dlc", "misc", false, { dlc: true }),
  c(6026, "Somber Smithing Stone", "dlc", "material", false, { dlc: true }),
  c(6040, "Stone Cairn", "dlc", "misc", false, { dlc: true }),
];

export const CAT_BY_ID = Object.fromEntries(CATS.map((k) => [k.id, k]));
export const DEFAULT_VISIBLE = CATS.filter((k) => k.guide).map((k) => k.id);
export const GLYPHS = ["grace", "boss", "dungeon", "key", "weapon", "spell", "talisman", "ash", "armor", "npc", "item", "material", "gate", "tower", "misc"];
