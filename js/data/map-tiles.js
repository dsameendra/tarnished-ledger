// High-resolution tile pyramids, one per map image. Level z is the image at (calibrated width x 2^z) pixels, cut into
// 512px tiles, so tile coordinates line up with the marker coordinates at every Leaflet zoom level.
// Cut by scripts/calibrate/hires.py; the single-file images in assets/map/*.webp are the first paint and the overview.
export const TILES = {
  base: { path: "assets/map/tiles/surface", zmax: 2, size: 512 },
  under: { path: "assets/map/tiles/underground", zmax: 1, size: 512 },
  dlc: { path: "assets/map/tiles/dlc", zmax: 1, size: 512 },
};
