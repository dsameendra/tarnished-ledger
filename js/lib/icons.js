// Original line icons and trophy medals drawn for this project. No game art is used.

export const PATHS = {
  go: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  boss: '<path d="M6 9c0-3 2.7-5 6-5s6 2 6 5v4c0 3.5-2.7 6-6 6s-6-2.5-6-6z"/><path d="M6 9L3 5M18 9l3-4M9 12h2M13 12h2M12 15v4"/>',
  item: '<path d="M4 10h16v9H4zM4 10l2-4h12l2 4M10 14h4"/>',
  quest: '<path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8 9h8M8 12h5"/>',
  warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.4"/>',
  map: '<path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z"/><path d="M9 4v14M15 6v14"/>',
  key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M21 12v3"/>',
  arm: '<path d="M14 4l6-1-1 6-9 9-3-3z"/><path d="M7 14l-3 3 3 3 3-3M4.5 19.5L2.5 21.5"/>',
  ash: '<path d="M12 3c3 4 5 6.5 5 10a5 5 0 0 1-10 0c0-2 .8-3.4 2-4.5 0 2 1 3.2 2 3.2 0-3 .2-6 1-8.7z"/>',
  sp: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  tal: '<path d="M8 3l4 6 4-6"/><circle cx="12" cy="14" r="5"/><path d="M12 11.5v5"/>',
  crown: '<path d="M4 17l-1-10 5 4 4-7 4 7 5-4-1 10z"/><path d="M4 20h16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  moon: '<path d="M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z"/>',
  flame: '<path d="M12 21c-4 0-7-2.7-7-6.5C5 10 9 8 9 3c3 2 4 4 4 6 1-1 1.5-2 1.5-3.5C17 7.5 19 10.5 19 14.5 19 18.3 16 21 12 21z"/>',
  table: '<ellipse cx="12" cy="10" rx="8" ry="3.5"/><path d="M6 12v7M18 12v7M12 13.5V19"/>',
  rune: '<circle cx="12" cy="12" r="8"/><path d="M12 5v14M8 9l4 3 4-3M9 16l3-2 3 2"/>',
  tree: '<path d="M12 21V6M12 15l-5-4M12 15l5-4M12 10l-4-3.5M12 10l4-3.5M9 21h6"/><circle cx="12" cy="4.5" r="1.5"/>',
  hammer: '<path d="M14 4l6 6-3 3-6-6zM11 7L3 15l3 3 8-8"/>',
  list: '<path d="M4 6.5l1.5 1.5L8 5.5M4 12.5l1.5 1.5L8 11.5M4 18.5l1.5 1.5L8 17.5M11 7h9M11 13h9M11 19h9"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
};

export const tickSVG = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
export const ico = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${PATHS[name] || PATHS.go}</svg>`;

export const COLLECTION_ICON = { armaments: "arm", ashes: "ash", spells: "sp", talismans: "tal" };
const GRADE_COLOR = { p: "#8fb6cf", g: "#d8ad3f", s: "#b7b8bf", b: "#b77c4b" };
const TROPHY_ICON = {
  platinum: "crown", eldenlord: "sun", stars: "moon", frenzy: "flame", roundtable: "table", greatrune: "rune",
  erdtree: "tree", godslaying: "hammer", armaments: "arm", ashes: "ash", spells: "sp", talismans: "tal",
};

export function medal(trophy, showGrade = true) {
  const [key, , , grade] = trophy;
  const color = showGrade ? GRADE_COLOR[grade] : "#b9a266";
  return `<svg class="badge" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18.5" fill="${color}"/><circle cx="20" cy="20" r="15" fill="none" stroke="#fff" stroke-opacity=".55"/><circle cx="20" cy="20" r="18.5" fill="none" stroke="#000" stroke-opacity=".18"/><g transform="translate(9 9) scale(.92)" fill="none" stroke="#1d1a13" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${PATHS[TROPHY_ICON[key] || "boss"]}</g></svg>`;
}
