// Original vector glyphs drawn in a [-1, 1] box. Each key matches the `glyph` field of a map category.
const D = {
  grace: "M0 -1C.95 -.2 .85 .95 0 .95C-.85 .95 -.95 -.2 0 -1Z",
  boss: "M-.9 -.1A.9 .9 0 1 1 .9 -.1V.2H.5V.95H-.5V.2H-.9Z M-.55 -.2H-.15V.2H-.55Z M.15 -.2H.55V.2H.15Z",
  dungeon: "M-.8 .9V-.1A.8 .8 0 0 1 .8 -.1V.9Z M-.3 .9V.05A.3 .3 0 0 1 .3 .05V.9Z",
  key: "M-.5 -.5A.5 .5 0 1 1 .5 -.5A.5 .5 0 1 1 -.5 -.5Z M-.2 -.5A.2 .2 0 1 1 .2 -.5A.2 .2 0 1 1 -.2 -.5Z M-.14 0H.14V1H-.14Z M.14 .5H.5V.75H.14Z",
  weapon: "M0 -1L.2 .3H.6V.5H.15V.95H-.15V.5H-.6V.3H-.2Z",
  spell: "M0 -1L.28 -.28L1 0L.28 .28L0 1L-.28 .28L-1 0L-.28 -.28Z",
  talisman: "M-.9 0A.9 .9 0 1 1 .9 0A.9 .9 0 1 1 -.9 0Z M-.4 0A.4 .4 0 1 1 .4 0A.4 .4 0 1 1 -.4 0Z",
  ash: "M-.8 .9V-.1A.8 .8 0 0 1 .8 -.1V.9L.4 .55L0 .9L-.4 .55Z M-.4 -.3H-.1V.1H-.4Z M.1 -.3H.4V.1H.1Z",
  armor: "M-.9 -.8H.9V.1C.9 .6 .4 .9 0 1C-.4 .9 -.9 .6 -.9 .1Z",
  npc: "M-.38 -.55A.38 .38 0 1 1 .38 -.55A.38 .38 0 1 1 -.38 -.55Z M-.8 .95C-.8 .3 -.4 .05 0 .05C.4 .05 .8 .3 .8 .95Z",
  item: "M-.75 -.75H.75V.75H-.75Z",
  material: "M-.9 .9C-.9 -.4 -.2 -.9 .9 -.9C.9 .2 .4 .9 -.9 .9Z",
  gate: "M0 -1L.87 -.5V.5L0 1L-.87 .5V-.5Z M0 -.4L.35 -.2V.2L0 .4L-.35 .2V-.2Z",
  tower: "M-.6 -1H-.3V-.7H-.1V-1H.1V-.7H.3V-1H.6V1H-.6Z",
  misc: "M0 -.9L.9 0L0 .9L-.9 0Z",
  dot: "M-1 0A1 1 0 1 1 1 0A1 1 0 1 1 -1 0Z",
};

export const COLORS = {
  grace: "#f2c14e", boss: "#e5534b", dungeon: "#a78bda", key: "#f08c2e", weapon: "#d5dae0", spell: "#4fa8e8", talisman: "#3fc79a",
  ash: "#8fb8d9", armor: "#c49a6c", npc: "#ee82b0", item: "#86cf5f", material: "#c8bb3f", gate: "#4fd1dc", tower: "#c9a0ff", misc: "#b4b4b4",
};

const paths = {};
const cache = new Map();
const path = (g) => paths[g] || (paths[g] = new Path2D(D[g] || D.misc));

// Sprite for one glyph: (size + 6) css px square, the extra 3px per side holds the outline.
export function sprite(glyph, color, size, dpr = 1) {
  const key = `${glyph}|${color}|${size}|${dpr}`;
  let c = cache.get(key);
  if (c) return c;
  const full = size + 6;
  c = document.createElement("canvas");
  c.width = c.height = Math.ceil(full * dpr);
  const x = c.getContext("2d");
  const r = size / 2;
  x.scale(dpr, dpr);
  x.translate(full / 2, full / 2);
  x.scale(r, r);
  x.lineJoin = "round";
  const p = path(glyph);
  x.lineWidth = 3.4 / r; x.strokeStyle = "#14130e"; x.stroke(p);
  x.lineWidth = 1.8 / r; x.strokeStyle = "#fffdf6"; x.stroke(p);
  x.fillStyle = color; x.fill(p, "evenodd");
  c.full = full;
  cache.set(key, c);
  return c;
}

export const iconURL = (glyph, color, size = 20) => sprite(glyph, color, size, 2).toDataURL();
