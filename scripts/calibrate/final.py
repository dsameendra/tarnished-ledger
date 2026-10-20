"""Final calibration: uniform-scale, axis-aligned model (px = s*m + t) per map.

The free affine fits (fit.py / refine.py) show no rotation or shear beyond noise on the surface and DLC
maps (b/a, d/a < 0.002), so the final model is constrained to a = e = s, b = d = 0. The three underground
sub-maps share one scale s and get their own translation (they sit at different offsets in MapGenie space).
Each projected grace is localised with a masked template search (refine.localise) and the model is fitted
with trimmed least squares. Writes calib_final.json (transforms, residuals, per-grace centres).
"""
import json

import cv2
import numpy as np

import common as C
import refine as R

QF = 1.6
SUB = {'ainsel': 1349, 'siofra': 1334, 'deeproot': 1350}


def uniform_fit(groups):
    """groups: list of (Pm, Pp). Common scale s, per-group translation. returns s, [t...]"""
    X = np.vstack([g[0] - g[0].mean(0) for g in groups])
    Y = np.vstack([g[1] - g[1].mean(0) for g in groups])
    s = (X * Y).sum() / (X * X).sum()
    return s, [g[1].mean(0) - s * g[0].mean(0) for g in groups]


def run_model(imf, tmpl, groups, s, ts, half, qf=QF, rounds=6):
    """groups: list of (graces list). iterate: project, localise, trimmed refit. returns s, ts, detail."""
    t, mask = tmpl
    detail = None
    for it in range(rounds):
        meas = []
        for gr, tr in zip(groups, ts):
            Q = np.array([[g['xm'], g['ym']] for g in gr])
            pr = s * Q + tr
            ms = [R.localise(imf, t, mask, p, half) for p in pr]
            idx = [i for i, m in enumerate(ms) if m is not None]
            qs = np.array([ms[i][2] for i in idx])
            qthr = qf * np.percentile(qs, 25)  # keep clean, well-matching discs only (qf large: keep all)
            idx = [i for i, q in zip(idx, qs) if q <= qthr]
            meas.append((Q[idx], np.array([ms[i][:2] for i in idx]), [gr[i]['id'] for i in idx]))
        keep = [np.ones(len(m[0]), bool) for m in meas]
        for rd in range(6):
            s, ts = uniform_fit([(m[0][k], m[1][k]) for m, k in zip(meas, keep)])
            keep = []
            for m, tr in zip(meas, ts):
                r = np.linalg.norm(m[1] - (s * m[0] + tr), axis=1)
                lim = 6.0 if rd < 2 else float(np.clip(2.5 * np.median(r), 2.5, 5.0))
                keep.append(r < lim)
        detail = (meas, keep)
    return s, ts, detail


if __name__ == '__main__':
    ims = {k: cv2.imread('%s/%s.png' % (C.IMAGES, k)) for k in '246'}
    seeds = {'2': C.seeds_surface(ims['2']), '4': C.seeds_hough(ims['4']), '6': C.seeds_hough(ims['6'])}
    coarse = json.load(open(C.WORK + '/calib_affine.json'))
    lb = C.graces('lands-between')
    sh = C.graces('realm-of-shadow')
    G = {g['id']: g for g in lb + sh}
    out = {}

    def stats(name, meas, keep, s, tr, extra=None):
        P = np.vstack([m[1][k] for m, k in zip(meas, keep)])
        Q = np.vstack([m[0][k] for m, k in zip(meas, keep)])
        return None

    jobs = {
        'base': ('2', 7, 10, [[g for g in lb if g['region'] not in (1349, 1350, 1334)]], ['_']),
        'dlc': ('6', 10.5, 15, [sh], ['_']),
        'under': ('4', 10.5, 15, [[g for g in lb if g['region'] == SUB[k]] for k in SUB], list(SUB)),
    }
    for key, (img, rad, half, groups, names) in jobs.items():
        im = ims[img]
        tm, mask, nt = R.make_template(im, seeds[img], half, rad)
        # initial guess from the coarse affine fits
        if key == 'under':
            gs = []
            for nm, gr in zip(names, groups):
                pairs = coarse['under_' + nm]['pairs']
                gs.append((np.array([[G[i]['xm'], G[i]['ym']] for i, _ in pairs]), np.array([p for _, p in pairs])))
        else:
            pairs = coarse[key]['pairs']
            gs = [(np.array([[G[i]['xm'], G[i]['ym']] for i, _ in pairs]), np.array([p for _, p in pairs]))]
        s, ts = uniform_fit(gs)
        s, ts, (meas, keep) = run_model(im.astype(np.float32), (tm, mask), groups, s, ts, half, qf=1000.0 if key == 'under' else QF)
        res = {'s': float(s), 'subs': {}}
        allr = []
        for nm, m, k, tr, gr in zip(names, meas, keep, ts, groups):
            r = np.linalg.norm(m[1] - (s * m[0] + tr), axis=1)
            allr.append(r[k])
            res['subs'][nm] = dict(T=[float(s), 0.0, float(tr[0]), 0.0, float(s), float(tr[1])],
                                   inliers=int(k.sum()), measured=len(r), graces=len(gr),
                                   median=float(np.median(r[k])), p90=float(np.percentile(r[k], 90)), max=float(r[k].max()),
                                   inlier_ids=[i for i, kk in zip(m[2], k) if kk],
                                   centres=[[i, float(p[0]), float(p[1])] for i, p in zip(m[2], m[1])])
            print('%-6s %-9s s=%.0f t=(%.0f, %.0f) measured %3d/%3d inliers %3d median %.2f p90 %.2f max %.2f' % (
                key, nm, s, tr[0], tr[1], len(r), len(gr), k.sum(), np.median(r[k]), np.percentile(r[k], 90), r[k].max()))
        out[key] = res
    json.dump(out, open(C.WORK + '/calib_final.json', 'w'))
