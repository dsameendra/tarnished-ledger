// Map calibration (MapGenie lat/lng -> pixels) fitted on in-game map screenshots: surface, underground, Realm of Shadow; median residual px: base=2.22 dlc=2.28 under.ainsel=2.51 under.siofra=2.65 under.deeproot=2.92
export const CALIB = {
  base: { img: "assets/map/surface.webp", w: 1886, h: 1960, t: { _: [1872121.308, 0.0, -931667.87, 0.0, 1872121.308, -931285.193] } },
  under: { img: "assets/map/underground.webp", w: 2000, h: 1961, t: { ainsel: [3879145.19, 0.0, -1930564.749, 0.0, 3879145.19, -1934449.88], siofra: [3879145.19, 0.0, -1930880.325, 0.0, 3879145.19, -1935572.457], deeproot: [3879145.19, 0.0, -1931009.425, 0.0, 3879145.19, -1934666.823] } },
  dlc: { img: "assets/map/dlc.webp", w: 1883, h: 1960, t: { _: [4024875.957, 0.0, -2003772.973, 0.0, 4024875.957, -2004035.483] } },
};

export function project(mapKey, sub, lat, lng) {
  const t = CALIB[mapKey].t[sub || "_"];
  const xm = (lng + 180) / 360;
  const ym = (1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2;
  return [t[0] * xm + t[1] * ym + t[2], t[3] * xm + t[4] * ym + t[5]];
}
