"""Refine the coarse fits: localise each projected grace disc in the image with a masked template
search (template = median of isolated discs from fit.py's seeds) in a small window around the
prediction, then re-fit with trimmed least squares. Writes calib_refined_<mode>.json.

usage: refine.py <mode: affine|sim> ; reads calib_<mode>.json from fit.py.
"""
import json
import sys

import cv2
import numpy as np

import common as C
import fit

SPEC = {  # key: (image, graces name, grace filter, disc radius px, template half-size)
    'base': ('2', 'lands-between', lambda g: g['region'] not in (1349, 1350, 1334), 7, 10),
    'dlc': ('6', 'realm-of-shadow', lambda g: True, 10.5, 15),
    'under_deeproot': ('4', 'lands-between', lambda g: g['region'] == 1350, 10.5, 15),
    'under_ainsel': ('4', 'lands-between', lambda g: g['region'] == 1349, 10.5, 15),
    'under_siofra': ('4', 'lands-between', lambda g: g['region'] == 1334, 10.5, 15),
}
SEARCH = 7


def make_template(im, pts, half, rad):
    ps = []
    for x, y in pts:
        # sub-pixel shift each patch so that the disc centre sits on the patch centre
        cx, cy = int(round(x)), int(round(y))
        if half + 3 < cx < im.shape[1] - half - 4 and half + 3 < cy < im.shape[0] - half - 4:
            M = np.float32([[1, 0, half - (x - (cx - half))], [0, 1, half - (y - (cy - half))]])
            # translate so that (x, y) lands at (half, half) in the output patch
            M = np.float32([[1, 0, half - x], [0, 1, half - y]])
            ps.append(cv2.warpAffine(im, M, (2 * half + 1, 2 * half + 1), flags=cv2.INTER_CUBIC).astype(np.float32))
    ps = np.array(ps)
    t = np.median(ps, 0)
    for _ in range(3):
        d = ((ps - t) ** 2).mean((1, 2, 3))
        t = np.median(ps[d <= np.median(d)], 0)
    yy, xx = np.mgrid[-half:half + 1, -half:half + 1]
    mask = np.dstack([((xx ** 2 + yy ** 2) <= rad ** 2).astype(np.float32)] * 3)
    return t.astype(np.float32), mask, len(ps)


def localise(imf, t, mask, p, half):
    x, y = p
    if not (half + SEARCH + 2 < x < imf.shape[1] - half - SEARCH - 3 and half + SEARCH + 2 < y < imf.shape[0] - half - SEARCH - 3):
        return None
    x0, y0 = int(round(x)), int(round(y))
    w = half + SEARCH
    sub = imf[y0 - w:y0 + w + 1, x0 - w:x0 + w + 1]
    res = cv2.matchTemplate(sub, t, cv2.TM_SQDIFF, mask=mask)
    res = np.nan_to_num(res, nan=1e18)
    iy, ix = np.unravel_index(res.argmin(), res.shape)
    dx = dy = 0.0
    if 0 < ix < res.shape[1] - 1 and 0 < iy < res.shape[0] - 1:
        a, b, c = res[iy, ix - 1], res[iy, ix], res[iy, ix + 1]
        den = a - 2 * b + c
        dx = 0.5 * (a - c) / den if den > 0 else 0
        a, b, c = res[iy - 1, ix], res[iy, ix], res[iy + 1, ix]
        den = a - 2 * b + c
        dy = 0.5 * (a - c) / den if den > 0 else 0
    # quality: template-normalised error
    q = float(res[iy, ix] / (mask.sum() * 255.0 ** 2))
    return x0 - SEARCH + ix + dx, y0 - SEARCH + iy + dy, q


def trimmed(Pm, Pp, mode, rounds=5):
    keep = np.ones(len(Pm), bool)
    for _ in range(rounds):
        T = fit.solve(Pm[keep], Pp[keep], mode)
        r = np.linalg.norm(fit.apply(T, Pm) - Pp, axis=1)
        keep = r < max(1.5, 2.5 * np.median(r[keep]))
    T = fit.solve(Pm[keep], Pp[keep], mode)
    r = np.linalg.norm(fit.apply(T, Pm) - Pp, axis=1)
    return T, keep, r


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'affine'
    c0 = json.load(open(C.WORK + '/calib_%s.json' % mode))
    ims = {k: cv2.imread('%s/%s.png' % (C.IMAGES, k)) for k in '246'}
    seeds = {'2': C.seeds_surface(ims['2']), '4': C.seeds_hough(ims['4']), '6': C.seeds_hough(ims['6'])}
    out = {}
    for key, (img, name, flt, rad, half) in SPEC.items():
        im = ims[img]
        imf = im.astype(np.float32)
        t, mask, nt = make_template(im, seeds[img], half, rad)
        gr = [g for g in C.graces(name) if flt(g)]
        Q = np.array([[g['xm'], g['ym']] for g in gr])
        T = np.array(c0[key]['T'])
        for it in range(3):
            pr = fit.apply(T, Q)
            ms = [localise(imf, t, mask, p, half) for p in pr]
            idx = [i for i, m in enumerate(ms) if m is not None]
            qs = np.array([ms[i][2] for i in idx])
            ok = [i for i, q in zip(idx, qs) if q <= np.percentile(qs, 60)]  # best-matching discs only
            Pp = np.array([ms[i][:2] for i in ok])
            Pm = Q[ok]
            T, keep, r = trimmed(Pm, Pp, mode)
        ids = [gr[i]['id'] for i, k in zip(ok, keep) if k]
        print('%-15s tmpl %3d measured %3d / %3d used %3d inliers %3d median %.2f p90 %.2f max %.2f' % (
            key, nt, len(idx), len(gr), len(ok), keep.sum(), np.median(r[keep]), np.percentile(r[keep], 90), r[keep].max()))
        out[key] = dict(T=[float(v) for v in T], inliers=int(keep.sum()), measured=len(idx), graces=len(gr),
                        median=float(np.median(r[keep])), p90=float(np.percentile(r[keep], 90)), max=float(r[keep].max()),
                        inlier_ids=ids, centres=[[gr[i]['id'], float(ms[i][0]), float(ms[i][1])] for i in idx])
    json.dump(out, open(C.WORK + '/calib_refined_%s.json' % mode, 'w'))
