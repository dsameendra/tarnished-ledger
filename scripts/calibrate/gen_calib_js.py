"""Write js/data/map-calib.js from calib_final.json.
usage: gen_calib_js.py <repo_root>"""
import json
import sys

import common as C

TEMPLATE = '''// Map calibration (MapGenie lat/lng -> pixels) fitted on in-game map screenshots: surface, underground, Realm of Shadow; median residual px: {res}
export const CALIB = {{
  base: {{ img: "assets/map/surface.webp", w: {bw}, h: {bh}, t: {{ _: {base} }} }},
  under: {{ img: "assets/map/underground.webp", w: {uw}, h: {uh}, t: {{ ainsel: {ainsel}, siofra: {siofra}, deeproot: {deeproot} }} }},
  dlc: {{ img: "assets/map/dlc.webp", w: {dw}, h: {dh}, t: {{ _: {dlc} }} }},
  // Roundtable Hold: MapGenie positions only, no fitted image (there is no public floor plan). 22,000,000 px per Web Mercator unit, 90px margin.
  hub: {{ img: "assets/map/hub.svg", w: 1602, h: 1252, t: {{ _: [22000000.0, 0.0, -10946660.651, 0.0, 22000000.0, -10964284.541] }} }},
}};

export function project(mapKey, sub, lat, lng) {{
  const t = CALIB[mapKey].t[sub || "_"];
  const xm = (lng + 180) / 360;
  const ym = (1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2;
  return [t[0] * xm + t[1] * ym + t[2], t[3] * xm + t[4] * ym + t[5]];
}}
'''


def fmt(T):
    return '[' + ', '.join(repr(float(round(v, 3))) if abs(v) > 100 else repr(float(v)) for v in T) + ']'


if __name__ == '__main__':
    root = sys.argv[1]
    cal = json.load(open(C.WORK + '/calib_final.json'))
    res = ' '.join('%s=%.2f' % (k if s == '_' else k + '.' + s, v['subs'][s]['median'])
                   for k, v in cal.items() for s in v['subs'])
    sub = {k: {s: fmt(d['T']) for s, d in v['subs'].items()} for k, v in cal.items()}
    from PIL import Image
    size = {n: Image.open('%s/assets/map/%s.webp' % (root, n)).size for n in ('surface', 'underground', 'dlc')}
    src = TEMPLATE.format(res=res, bw=size['surface'][0], bh=size['surface'][1], uw=size['underground'][0],
                          uh=size['underground'][1], dw=size['dlc'][0], dh=size['dlc'][1],
                          base=sub['base']['_'], dlc=sub['dlc']['_'], **sub['under'])
    open(root + '/js/data/map-calib.js', 'w').write(src)
    print(src)
