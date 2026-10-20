"""Draw projected MapGenie graces (red rings) and named landmarks (green crosses + label) over an image.
usage: overlay.py <image> <map: base|under|dlc> <out.png>   (uses calib_final.json)"""
import json
import sys

import cv2
import numpy as np

import common as C

LANDMARKS = ['Divine Tower of', 'Isolated Divine Tower', 'Roundtable Hold', 'Stormveil Castle', 'Raya Lucaria Academy', 'Redmane Castle',
             'Mohgwyn Dynasty Mausoleum', 'Crumbling Farum Azula', 'Elphael', 'Leyndell', 'Volcano Manor', 'Belurat',
             'Castle Ensis', 'Shadow Keep', 'Enir-Ilim']

if __name__ == '__main__':
    img, key, outp = sys.argv[1:4]
    cal = json.load(open(C.WORK + '/calib_final.json'))[key]['subs']
    im = cv2.imread(img)
    name = 'realm-of-shadow' if key == 'dlc' else 'lands-between'
    d = C.load(name)
    reg = {r['id']: r['title'] for r in d['regions']}
    sub_of = {1349: 'ainsel', 1334: 'siofra', 1350: 'deeproot'}
    for l in d['locations']:
        if key == 'base':
            sub = '_' if l['region_id'] not in sub_of else None
        elif key == 'under':
            sub = sub_of.get(l['region_id'])
        else:
            sub = '_'
        if sub is None:
            continue
        T = cal[sub]['T']
        xm, ym = C.merc(float(l['latitude']), float(l['longitude']))
        x, y = T[0] * xm + T[1] * ym + T[2], T[3] * xm + T[4] * ym + T[5]
        if l['category_id'] == C.GRACE_CAT:
            cv2.circle(im, (int(round(x)), int(round(y))), 11, (0, 0, 255), 1)
        elif any(l['title'].startswith(n) for n in LANDMARKS) and l['category_id'] in (5656, 5664, 5657):
            cv2.drawMarker(im, (int(round(x)), int(round(y))), (0, 255, 0), cv2.MARKER_CROSS, 24, 2)
            cv2.putText(im, l['title'][:22], (int(x) + 10, int(y) - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
    cv2.imwrite(outp, im)
