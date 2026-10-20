"""Remove baked-in Site of Grace discs: mask = disc (+ glow) at each calibrated grace position, snapped to
the measured disc centre when one is available, plus nearby gold pixels; then cv2.inpaint.

usage: inpaint.py <telea|ns> ; writes clean_<name>_<method>.png into the work dir.
"""
import json
import sys

import cv2
import numpy as np

import common as C

JOBS = {  # key: (image, graces name, grace filter by sub, disc mask radius)
    'base': ('2', 'lands-between', {'_': lambda g: g['region'] not in (1349, 1350, 1334)}, 7.5),
    'dlc': ('6', 'realm-of-shadow', {'_': lambda g: True}, 15.5),
    'under': ('4', 'lands-between', {'ainsel': lambda g: g['region'] == 1349, 'siofra': lambda g: g['region'] == 1334,
                                     'deeproot': lambda g: g['region'] == 1350}, 15.5),
}


def build_mask(key, cal, im):
    img, name, subs, rad = JOBS[key]
    mask = np.zeros(im.shape[:2], np.uint8)
    gm = cv2.dilate(C.gold_mask(im), np.ones((3, 3), np.uint8))
    for sub, flt in subs.items():
        c = cal[key]['subs'][sub]
        T = c['T']
        centres = {i: (x, y) for i, x, y in c['centres']}
        for g in C.graces(name):
            if not flt(g):
                continue
            px, py = T[0] * g['xm'] + T[2], T[4] * g['ym'] + T[5]
            cx, cy = px, py
            if g['id'] in centres:
                mx, my = centres[g['id']]
                if abs(mx - px) < 4 and abs(my - py) < 4:
                    cx, cy = mx, my
            if not (0 <= cx < im.shape[1] and 0 <= cy < im.shape[0]):
                continue
            local = np.zeros_like(mask)
            cv2.circle(local, (int(round(cx)), int(round(cy))), int(round(rad)), 1, -1)
            near = np.zeros_like(mask)
            cv2.circle(near, (int(round(cx)), int(round(cy))), int(round(rad + 2)), 1, -1)
            mask |= local | (gm & near)
    if key != 'base':  # extra discs found in the image itself (graces missing from the MapGenie list)
        gmc = C.gold_mask(im)
        for x, y in C.seeds_hough(im):
            x0, y0 = int(round(x)), int(round(y))
            if gmc[y0 - 12:y0 + 13, x0 - 12:x0 + 13].sum() >= 170:
                cv2.circle(mask, (x0, y0), int(round(rad)), 1, -1)
    return mask


def retexture(im, out, mask):
    """inpainting leaves smooth blobs; add luminance grain matching the local high-pass energy of the surroundings."""
    rng = np.random.default_rng(7)
    f = im.astype(np.float32)
    hp = f - cv2.GaussianBlur(f, (0, 0), 2.0)
    valid = (1 - cv2.dilate(mask, np.ones((3, 3), np.uint8))).astype(np.float32)
    num = cv2.GaussianBlur((hp ** 2).mean(2) * valid, (0, 0), 8)
    den = cv2.GaussianBlur(valid, (0, 0), 8) + 1e-3
    sigma = np.sqrt(num / den)
    grain = rng.normal(0, 1, mask.shape).astype(np.float32)
    grain = cv2.GaussianBlur(grain, (0, 0), 0.7) * 1.6
    soft = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 1.0)[..., None]
    res = out.astype(np.float32) + (grain * sigma * 0.8)[..., None] * soft
    return np.clip(res, 0, 255).astype(np.uint8)


if __name__ == '__main__':
    method = sys.argv[1] if len(sys.argv) > 1 else 'telea'
    flag = cv2.INPAINT_TELEA if method == 'telea' else cv2.INPAINT_NS
    cal = json.load(open(C.WORK + '/calib_final.json'))
    for key, (img, *_r) in JOBS.items():
        im = cv2.imread('%s/%s.png' % (C.IMAGES, img))
        mask = build_mask(key, cal, im)
        cv2.imwrite('%s/mask_%s.png' % (C.WORK, key), mask * 255)
        out = cv2.inpaint(im, mask, 3, flag)
        out = retexture(im, out, mask)
        cv2.imwrite('%s/clean_%s_%s.png' % (C.WORK, key, method), out)
        print(key, method, int(mask.sum()), 'masked px')
