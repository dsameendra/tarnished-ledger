"""Shared helpers: MapGenie data loading, Web Mercator normalisation, grace seed detection."""
import json
import math

import cv2
import numpy as np

SRC = '/private/tmp/claude-501/-Users-dsameendra-Documents-Code-tarnished-ledger/b705d88b-9494-40eb-96dc-0605fba2809e'
DATA = SRC + '/scratchpad/mapgenie'
IMAGES = SRC + '/images'
WORK = SRC + '/scratchpad/calib/out'
GRACE_CAT = 5658


def merc(lat, lng):
    xm = (lng + 180) / 360
    r = math.radians(lat)
    ym = (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2
    return xm, ym


def load(name):
    return json.load(open('%s/%s.json' % (DATA, name)))


def graces(name):
    d = load(name)
    out = []
    for l in d['locations']:
        if l['category_id'] == GRACE_CAT:
            xm, ym = merc(float(l['latitude']), float(l['longitude']))
            out.append(dict(id=l['id'], title=l['title'], region=l['region_id'], xm=xm, ym=ym))
    return out


def gold_mask(im):
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    return ((h >= 14) & (h <= 28) & (s >= 110) & (v >= 90) & (v <= 235)).astype(np.uint8)


def seeds_surface(im):
    m = cv2.morphologyEx(gold_mask(im), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    n, _, st, c = cv2.connectedComponentsWithStats(m)
    return [(c[i][0], c[i][1]) for i in range(1, n)
            if 60 <= st[i, 4] <= 200 and 0.8 < st[i, 2] / st[i, 3] < 1.25]


def seeds_hough(im, rmin=9, rmax=13):
    g = cv2.GaussianBlur(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY), (0, 0), 1.2)
    gm = gold_mask(im)
    cs = cv2.HoughCircles(g, cv2.HOUGH_GRADIENT, 1, 14, param1=100, param2=18, minRadius=rmin, maxRadius=rmax)
    out = []
    for x, y, r in (cs[0] if cs is not None else []):
        x0, y0 = int(x), int(y)
        if gm[max(0, y0 - 14):y0 + 15, max(0, x0 - 14):x0 + 15].sum() >= 80:
            out.append((float(x), float(y)))
    return out
