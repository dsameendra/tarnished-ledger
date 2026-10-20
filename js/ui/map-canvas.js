// One canvas for every marker: culls to the viewport, draws cached glyph sprites, hit-tests taps.
// Markers carry image-pixel coordinates (x, y); with L.CRS.Simple a point at zoom z sits at (x, y) * 2^z.
import { sprite } from "./map-glyphs.js";

export function createMarkerCanvas(L, map, { isFound }) {
  const pane = map.createPane("glyphs");
  pane.style.zIndex = 500;
  pane.style.pointerEvents = "none";
  const cv = L.DomUtil.create("canvas", "", pane);
  const ctx = cv.getContext("2d");
  let items = [];
  let selected = null;
  let raf = 0;
  const stats = { drawn: 0, total: 0, ms: 0, size: 0 };

  // Dots when zoomed out, growing glyphs as you zoom in.
  function sizeFor() {
    const rel = map.getZoom() - map.getMinZoom();
    return rel < 0.9 ? 0 : Math.min(30, 14 + Math.floor(((rel - 0.9) * 5) / 2) * 2);
  }
  const place = (m, sc, min) => [m.x * sc - min.x, m.y * sc - min.y];

  function draw() {
    raf = 0;
    const t0 = performance.now();
    const sz = map.getSize();
    const dpr = window.devicePixelRatio || 1;
    L.DomUtil.setPosition(cv, map.containerPointToLayerPoint([0, 0]));
    if (cv.width !== Math.round(sz.x * dpr) || cv.height !== Math.round(sz.y * dpr)) {
      cv.width = Math.round(sz.x * dpr);
      cv.height = Math.round(sz.y * dpr);
      cv.style.width = sz.x + "px";
      cv.style.height = sz.y + "px";
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, sz.x, sz.y);
    const sc = 2 ** map.getZoom();
    const min = map.getPixelBounds().min;
    const s = sizeFor();
    const dot = s === 0;
    const size = dot ? 8 : s;
    const pad = size / 2 + 4;
    let n = 0;
    const dots = new Map();
    for (const m of items) {
      const x = m.x * sc - min.x, y = m.y * sc - min.y;
      if (x < -pad || y < -pad || x > sz.x + pad || y > sz.y + pad) continue;
      n++;
      const f = isFound(m.id);
      if (dot) {
        const k = f ? "f" + m.color : m.color;
        let p = dots.get(k);
        if (!p) dots.set(k, (p = new Path2D()));
        p.moveTo(x + 3.5, y);
        p.arc(x, y, 3.5, 0, 6.2832);
        continue;
      }
      const sp = sprite(m.glyph, m.color, size, dpr);
      if (f) ctx.globalAlpha = 0.4;
      ctx.drawImage(sp, x - sp.full / 2, y - sp.full / 2, sp.full, sp.full);
      if (f) ctx.globalAlpha = 1;
    }
    ctx.lineWidth = 2; ctx.strokeStyle = "#14130e";
    for (const [k, p] of dots) {
      ctx.globalAlpha = k[0] === "f" ? 0.4 : 1;
      ctx.stroke(p);
      ctx.fillStyle = k[0] === "f" ? k.slice(1) : k;
      ctx.fill(p);
    }
    ctx.globalAlpha = 1;
    if (selected) {
      const [x, y] = place(selected, sc, min);
      const big = Math.max(size, 20) + 6;
      const sp = sprite(selected.glyph, selected.color, big, dpr);
      ctx.beginPath();
      ctx.arc(x, y, big * 0.95, 0, 6.2832);
      ctx.lineWidth = 5; ctx.strokeStyle = "#14130e"; ctx.stroke();
      ctx.lineWidth = 2.5; ctx.strokeStyle = "#fffdf6"; ctx.stroke();
      ctx.drawImage(sp, x - sp.full / 2, y - sp.full / 2, sp.full, sp.full);
    }
    Object.assign(stats, { drawn: n, total: items.length, ms: performance.now() - t0, size });
  }
  const redraw = () => { if (!raf) raf = requestAnimationFrame(draw); };
  map.on("move zoom viewreset resize zoomend", redraw);

  return {
    redraw,
    stats,
    drawNow: draw,
    setItems(list) { items = list; redraw(); },
    setSelected(m) { selected = m; redraw(); },
    // Nearest visible marker within tol css px of a container point.
    hit(pt, tol) {
      const sc = 2 ** map.getZoom();
      const min = map.getPixelBounds().min;
      let best = null, bd = tol * tol;
      const test = (m) => {
        const dx = m.x * sc - min.x - pt.x, dy = m.y * sc - min.y - pt.y;
        const d = dx * dx + dy * dy;
        if (d <= bd) { bd = d; best = m; }
      };
      items.forEach(test);
      if (selected) test(selected);
      return best;
    },
    tol() { return Math.max(14, sizeFor() / 2 + 8) + (matchMedia("(pointer: coarse)").matches ? 8 : 0); },
  };
}
