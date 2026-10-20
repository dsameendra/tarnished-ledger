"""Fit pixel = affine(mercator) per (sub)map from detected grace discs vs MapGenie Site of Grace data.

Stage 1: scale sweep + translation voting (axis-aligned similarity) finds the rough alignment.
Stage 2: iterative closest point with a full 6-parameter affine (or similarity) least squares.
Writes calib.json with transforms, inlier counts, residuals.
"""
import json
import sys

import cv2
import numpy as np

import common as C


def vote(P, Q, s_lo, s_hi, steps=400, bin_px=3.0):
    """P: seed pixels (n,2); Q: grace mercator (m,2). returns best (s, t, votes)."""
    best = (0, None, None)
    for s in np.linspace(s_lo, s_hi, steps):
        T = (P[:, None, :] - s * Q[None, :, :]).reshape(-1, 2)
        k = np.round(T / bin_px).astype(np.int64)
        key = k[:, 0] * 100003 + k[:, 1]
        u, cnt = np.unique(key, return_counts=True)
        i = cnt.argmax()
        if cnt[i] > best[0]:
            sel = key == u[i]
            best = (int(cnt[i]), (s, T[sel].mean(0)), None)
    return best


def solve(Pm, Pp, mode):
    """least squares px = A*m + t. mode 'affine' or 'sim' (px y-down; allows rotation, uniform scale)."""
    if mode == 'affine':
        A = np.c_[Pm, np.ones(len(Pm))]
        cx = np.linalg.lstsq(A, Pp[:, 0], rcond=None)[0]
        cy = np.linalg.lstsq(A, Pp[:, 1], rcond=None)[0]
        return np.array([cx[0], cx[1], cx[2], cy[0], cy[1], cy[2]])
    # similarity: x = a*X - b*Y + c ; y = b*X + a*Y + f
    n = len(Pm)
    M = np.zeros((2 * n, 4))
    M[0::2] = np.c_[Pm[:, 0], -Pm[:, 1], np.ones(n), np.zeros(n)]
    M[1::2] = np.c_[Pm[:, 1], Pm[:, 0], np.zeros(n), np.ones(n)]
    a, b, c, f = np.linalg.lstsq(M, Pp.reshape(-1), rcond=None)[0]
    return np.array([a, -b, c, b, a, f])


def apply(T, Pm):
    return np.c_[T[0] * Pm[:, 0] + T[1] * Pm[:, 1] + T[2], T[3] * Pm[:, 0] + T[4] * Pm[:, 1] + T[5]]


def icp(seeds, gr, T, mode, thr_px=6.0, iters=15):
    Q = np.array([[g['xm'], g['ym']] for g in gr])
    P = np.array(seeds)
    pairs = []
    for it in range(iters):
        proj = apply(T, Q)
        d = np.linalg.norm(proj[:, None, :] - P[None, :, :], axis=2)
        j = d.argmin(1)
        dm = d[np.arange(len(Q)), j]
        # one-to-one: keep best grace per seed
        ok = np.where(dm < thr_px)[0]
        keep = {}
        for i in ok:
            if j[i] not in keep or dm[i] < dm[keep[j[i]]]:
                keep[j[i]] = i
        pairs = [(i, j[i]) for i in keep.values()]
        if len(pairs) < 4:
            break
        Pm = Q[[p[0] for p in pairs]]
        Pp = P[[p[1] for p in pairs]]
        # robust: iterate with trimming
        T = solve(Pm, Pp, mode)
        r = np.linalg.norm(apply(T, Pm) - Pp, axis=1)
        good = r < max(3 * np.median(r), 1.5)
        if good.sum() >= 4:
            T = solve(Pm[good], Pp[good], mode)
        thr_px = max(2.5, thr_px * 0.8)
    Pm = Q[[p[0] for p in pairs]]
    Pp = P[[p[1] for p in pairs]]
    r = np.linalg.norm(apply(T, Pm) - Pp, axis=1)
    return T, pairs, r


def fit_group(name, seeds, gr, mode, s_range=None):
    P = np.array(seeds)
    Q = np.array([[g['xm'], g['ym']] for g in gr])
    if s_range is None:
        ext_p = np.ptp(P, 0).max()
        ext_q = np.ptp(Q, 0).max()
        s0 = ext_p / ext_q
        s_range = (s0 * 0.7, s0 * 1.3)
    v, (s, t), _ = vote(P, Q, *s_range)
    T = np.array([s, 0, t[0], 0, s, t[1]])
    T, pairs, r = icp(seeds, gr, T, mode)
    print('%-9s votes %3d seeds %3d graces %3d inliers %3d median %.2f max %.2f scale %.1f sx/sy %.3f' % (
        name, v, len(seeds), len(gr), len(pairs), np.median(r), r.max(), s, abs(T[0] / T[4])))
    return dict(T=[float(x) for x in T], inliers=len(pairs), seeds=len(seeds), graces=len(gr),
                median=float(np.median(r)), max=float(r.max()),
                pairs=[(gr[i]['id'], [float(x) for x in P[j]]) for i, j in pairs])


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'affine'
    out = {}
    imgs = {k: cv2.imread('%s/%s.png' % (C.IMAGES, k)) for k in '246'}
    lb = C.graces('lands-between')
    sh = C.graces('realm-of-shadow')
    lb_s = [g for g in lb if g['region'] not in (1349, 1350, 1334)]
    out['base'] = fit_group('base', C.seeds_surface(imgs['2']), lb_s, mode)
    out['dlc'] = fit_group('dlc', C.seeds_hough(imgs['6']), sh, mode)
    us = C.seeds_hough(imgs['4'])
    groups = {'deeproot': (1350, lambda p: p[1] < 580),
              'ainsel': (1349, lambda p: p[0] < 740 and p[1] > 650),
              'siofra': (1334, lambda p: p[0] > 1100 and p[1] > 550)}
    for k, (rid, f) in groups.items():
        out['under_' + k] = fit_group(k, [p for p in us if f(p)], [g for g in lb if g['region'] == rid], mode)
    json.dump(out, open(C.WORK + '/calib_%s.json' % mode, 'w'))
