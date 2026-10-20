"""Full-resolution maps: remove the baked-in grace discs from the large images and cut them into a tile pyramid.

The large images are the same maps as the calibrated screenshots at a higher resolution (align.py measured pure
scaling, offsets under 0.2 old px), so the marker calibration in js/data/map-calib.js is unchanged: tiles are cut
so that pyramid level z covers (old width x 2^z) pixels, i.e. one Leaflet zoom level per level with the same
coordinates as before.

usage: hires.py <repo> <hires-dir> <work-dir>
  hires-dir: lands-between-surface.png, lands-between-underground.jpg, shadow-of-erd-tree.png
  work-dir:  mask_base.png, mask_under.png, mask_dlc.png (grace-disc masks from inpaint.py at the old resolution)
writes assets/map/tiles/<name>/<z>/<x>/<y>.webp and assets/map/<name>.webp (old size, for first paint and the overview).
"""
import math
import os
import sys

os.environ["OPENCV_IO_MAX_IMAGE_PIXELS"] = str(2 ** 40)
import cv2
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
TILE = 512
EX_MAX = float(os.environ.get("EX_MAX", "150"))  # largest mismatch at the icon edge for a copied patch to be used
JOBS = {  # name: (file, old mask, old size, webp quality for the small copy)
    "surface": ("lands-between-surface.png", "mask_base.png", (1886, 1960), 90),
    "underground": ("lands-between-underground.jpg", "mask_under.png", (2000, 1961), 92),
    "dlc": ("shadow-of-erd-tree.png", "mask_dlc.png", (1883, 1960), 90),
}


def load(path):
    a = np.array(Image.open(path).convert("RGBA"))
    rgb = a[..., :3].astype(np.float32) * (a[..., 3:4].astype(np.float32) / 255.0)  # transparent edges become black
    return cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2BGR)


def gold(im):
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    return ((h >= 14) & (h <= 28) & (s >= 110) & (v >= 90) & (v <= 235)).astype(np.uint8)


def retexture(crop, out, mask, k):
    """inpainting leaves smooth blobs; add grain matched to the local high-pass energy of the surroundings."""
    rng = np.random.default_rng(7)
    f = crop.astype(np.float32)
    hp = f - cv2.GaussianBlur(f, (0, 0), max(1.0, k * 0.55))
    valid = (1 - cv2.dilate(mask, np.ones((3, 3), np.uint8))).astype(np.float32)
    num = cv2.GaussianBlur((hp ** 2).mean(2) * valid, (0, 0), 8 * k)
    den = cv2.GaussianBlur(valid, (0, 0), 8 * k) + 1e-3
    sigma = np.sqrt(num / den)
    grain = cv2.GaussianBlur(rng.normal(0, 1, mask.shape).astype(np.float32), (0, 0), 0.7 * k * 0.6) * 1.6
    soft = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 1.0 * k * 0.6)[..., None]
    res = out.astype(np.float32) + (grain * sigma * 0.8)[..., None] * soft
    return np.clip(res, 0, 255).astype(np.uint8)


def tone_fill(crop, hole, other, k):
    """Terrain colour for a hole, estimated from clean pixels in a ring around it: outliers (dark icon outlines, glow)
    are rejected, then the colour is spread inward with Gaussians of growing size so near pixels dominate."""
    f = crop.astype(np.float32)
    lum = f.mean(2)
    dist = cv2.distanceTransform((hole == 0).astype(np.uint8), cv2.DIST_L2, 3)
    ring = (other == 0) & (dist > 2.0 * k) & (dist < 16.0 * k)
    if ring.sum() < 50:
        ring = (other == 0) & (dist < 30.0 * k)
    med = np.median(lum[ring])
    mad = np.median(np.abs(lum[ring] - med)) + 1.0
    ring &= (np.abs(lum - med) < 2.6 * mad + 10) & (lum >= med - 0.4 * mad)  # paper colour, not the ink lines
    wgt = ring.astype(np.float32)
    out = np.zeros_like(f)
    have = np.zeros(hole.shape, bool)
    for sig in (2.5 * k, 5 * k, 10 * k, 20 * k):
        den = cv2.GaussianBlur(wgt, (0, 0), sig)
        num = cv2.GaussianBlur(f * wgt[..., None], (0, 0), sig)
        est = num / np.maximum(den, 1e-6)[..., None]
        take = (hole > 0) & ~have & (den > 0.03)
        out[take] = est[take]
        have |= take
    out[(hole > 0) & ~have] = f[ring].mean(0) if ring.any() else f.mean((0, 1))
    return out


def exemplar_fill(im, allmask, lab, i, bbox, k):
    """Terrain copied from next to the icon: the nearby patch whose surroundings match the icon's surroundings best.
    The icon's own glow ring (inside 2.2k of the hole) is ignored when matching. Returns the patch and its score."""
    h, w = im.shape[:2]
    x, y, bw, bh = bbox
    pad = int(11 * k) + 6
    tx0, ty0, tx1, ty1 = max(0, x - pad), max(0, y - pad), min(w, x + bw + pad), min(h, y + bh + pad)
    th, tw = ty1 - ty0, tx1 - tx0
    S = int(1.3 * max(bw, bh)) + 70
    sx0, sy0, sx1, sy1 = max(0, tx0 - S), max(0, ty0 - S), min(w, tx1 + S), min(h, ty1 + S)
    search = im[sy0:sy1, sx0:sx1]
    if search.shape[0] <= th or search.shape[1] <= tw:
        return None
    comp = lab[ty0:ty1, tx0:tx1] == i
    dist = cv2.distanceTransform((~comp).astype(np.uint8), cv2.DIST_L2, 3)
    known = (allmask[ty0:ty1, tx0:tx1] == 0) & (dist > 2.2 * k)
    wgt = known.astype(np.float32) * np.exp(-np.maximum(dist - 2.2 * k, 0) / (4.0 * k + 2.0))
    tmask = np.repeat(wgt[..., None], 3, axis=2)
    tpl = im[ty0:ty1, tx0:tx1].astype(np.float32)
    score = cv2.matchTemplate(search.astype(np.float32), tpl, cv2.TM_SQDIFF, mask=tmask) / max(1e-3, float(wgt.sum()) * 3.0)
    bad = cv2.boxFilter(allmask[sy0:sy1, sx0:sx1].astype(np.float32), -1, (tw, th), normalize=False, anchor=(0, 0), borderType=cv2.BORDER_CONSTANT)
    score[bad[:score.shape[0], :score.shape[1]] > 0] = np.inf
    if not np.isfinite(score).any():
        return None
    py, px = np.unravel_index(int(np.argmin(score)), score.shape)
    src = search[py:py + th, px:px + tw].astype(np.float32)
    dst = tpl
    ring = known & (dist < 7.0 * k)
    if ring.sum() < 30:
        ring = known
    src = src + (dst[ring].mean(0) - src[ring].mean(0))
    return (tx0, ty0, tx1, ty1), src, comp, float(score[py, px])


def lama_fill(out, lab, n, st, k, lama):
    """Fill every icon with a learned inpainting model (LaMa), one native-resolution crop per icon. The crop masks all
    icons in it, but only the icon being filled is written back, with a feathered edge."""
    from PIL import Image as PILImage
    h, w = out.shape[:2]
    box = [int(v) for v in os.environ["BOX"].split(",")] if os.environ.get("BOX") else None
    done = 0
    for i in range(1, n):
        x, y, bw, bh = st[i, :4]
        if box and not (box[0] <= x <= box[2] and box[1] <= y <= box[3]):
            continue
        half = max(160, max(bw, bh) // 2 + int(10 * k) + 60)
        cx, cy = x + bw // 2, y + bh // 2
        x0, y0 = max(0, min(w - 2 * half, cx - half)), max(0, min(h - 2 * half, cy - half))
        x1, y1 = min(w, x0 + 2 * half), min(h, y0 + 2 * half)
        crop = out[y0:y1, x0:x1]
        comp = (lab[y0:y1, x0:x1] == i)
        allm = (lab[y0:y1, x0:x1] > 0).astype(np.uint8)
        allm = cv2.dilate(allm, np.ones((5, 5), np.uint8))  # the model wants the hole a little generous
        res = lama(PILImage.fromarray(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)), PILImage.fromarray(allm * 255))
        res = cv2.cvtColor(np.array(res)[:crop.shape[0], :crop.shape[1]], cv2.COLOR_RGB2BGR)
        alpha = np.maximum(np.clip(cv2.GaussianBlur(comp.astype(np.float32), (0, 0), 0.8 * k) * 1.5, 0, 1), comp.astype(np.float32))[..., None]
        # near other icons only touch this icon's own area so neighbours are not half-filled twice
        alpha = alpha * ((lab[y0:y1, x0:x1] == 0) | comp)[..., None]
        out[y0:y1, x0:x1] = (res.astype(np.float32) * alpha + crop.astype(np.float32) * (1 - alpha)).astype(np.uint8)
        done += 1
        if done % 25 == 0:
            print("    %d icons filled" % done, flush=True)
    return done


def clean(im, old_mask, k):
    h, w = im.shape[:2]
    mask = cv2.resize(old_mask, (w, h), interpolation=cv2.INTER_NEAREST)
    r = int(math.ceil(k * 1.5))  # the icon's glow and outline reach a little past the detected disc
    mask = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))
    near = cv2.dilate(mask, np.ones((int(2 * k + 3), int(2 * k + 3)), np.uint8))
    mask |= gold(im) & near  # gold rim that stuck out of the warped mask
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(mask)
    out = im.copy()
    if os.environ.get("FILL", "lama") == "lama":
        from simple_lama_inpainting import SimpleLama
        done = lama_fill(out, lab, n, st, k, SimpleLama())
        print("  masked %d px in %d icons (%d filled with LaMa)" % (int(mask.sum()), n - 1, done))
        return out
    m = int(30 * k) + 20
    used, scores = 0, []
    for i in range(1, n):
        x, y, bw, bh = st[i, :4]
        got = exemplar_fill(out, mask, lab, i, tuple(st[i, :4]), k)
        if got is not None:
            scores.append(got[3])
        if got is not None and got[3] <= EX_MAX:
            (ex0, ey0, ex1, ey1), src, comp, _ = got
            soft = np.clip(cv2.GaussianBlur(comp.astype(np.float32), (0, 0), 0.9 * k) * 1.5, 0, 1)
            soft = np.maximum(soft, comp.astype(np.float32))[..., None]
            dst = out[ey0:ey1, ex0:ex1].astype(np.float32)
            out[ey0:ey1, ex0:ex1] = np.clip(src * soft + dst * (1 - soft), 0, 255).astype(np.uint8)
            used += 1
            continue
        x0, y0, x1, y1 = max(0, x - m), max(0, y - m), min(w, x + bw + m), min(h, y + bh + m)
        crop = out[y0:y1, x0:x1]
        comp = (lab[y0:y1, x0:x1] == i).astype(np.uint8)
        other = (lab[y0:y1, x0:x1] > 0).astype(np.uint8)
        fill = np.clip(tone_fill(crop, comp, other, k), 0, 255).astype(np.uint8)
        res = retexture(crop, fill, comp, k)
        alpha = np.maximum(np.clip(cv2.GaussianBlur(comp.astype(np.float32), (0, 0), 0.8 * k) * 1.5, 0, 1), comp.astype(np.float32))[..., None]
        blended = (res.astype(np.float32) * alpha + crop.astype(np.float32) * (1 - alpha)).astype(np.uint8)
        out[y0:y1, x0:x1] = np.where((alpha > 0.01) & ((lab[y0:y1, x0:x1] == 0) | (lab[y0:y1, x0:x1] == i))[..., None], blended, crop)
    if scores:
        print("  exemplar score percentiles 10/50/90:", [int(np.percentile(scores, p)) for p in (10, 50, 90)])
    print("  masked %d px in %d icons (%d copied from nearby terrain, %d tone fills)" % (int(mask.sum()), n - 1, used, n - 1 - used))
    return out


def tiles(img, base_w, base_h, zmax, dest):
    """Level z is the image resized to base * 2^z; each level is cut into TILE x TILE webp tiles."""
    size = {z: (base_w * 2 ** z, base_h * 2 ** z) for z in range(zmax + 1)}
    cur = cv2.resize(img, size[zmax], interpolation=cv2.INTER_LANCZOS4)
    total = 0
    for z in range(zmax, -1, -1):
        if z != zmax:
            cur = cv2.resize(cur, size[z], interpolation=cv2.INTER_AREA)
        w, h = size[z]
        nx, ny = math.ceil(w / TILE), math.ceil(h / TILE)
        pad = cv2.copyMakeBorder(cur, 0, ny * TILE - h, 0, nx * TILE - w, cv2.BORDER_CONSTANT, value=(0, 0, 0))
        for ty in range(ny):
            for tx in range(nx):
                t = pad[ty * TILE:(ty + 1) * TILE, tx * TILE:(tx + 1) * TILE]
                p = "%s/%d/%d/%d.webp" % (dest, z, tx, ty)
                os.makedirs(os.path.dirname(p), exist_ok=True)
                Image.fromarray(cv2.cvtColor(t, cv2.COLOR_BGR2RGB)).save(p, "WEBP", quality=80, method=5)
                total += os.path.getsize(p)
        print("  level %d: %dx%d px, %dx%d tiles" % (z, w, h, nx, ny))
    return total


if __name__ == "__main__":
    repo, src, work = sys.argv[1:4]
    only = sys.argv[4:] or list(JOBS)
    for name in only:
        f, mk, (bw, bh), q = JOBS[name]
        print(name)
        im = load(os.path.join(src, f))
        k = max(im.shape[1] / bw, im.shape[0] / bh)
        old = (cv2.imread(os.path.join(work, mk), 0) > 0).astype(np.uint8)
        out = clean(im, old, k)
        cv2.imwrite(os.path.join(work, "hires_clean_%s.png" % name), out)
        zmax = math.ceil(math.log2(k))
        total = tiles(out, bw, bh, zmax, os.path.join(repo, "assets/map/tiles", name))
        small = cv2.resize(out, (bw, bh), interpolation=cv2.INTER_AREA)
        Image.fromarray(cv2.cvtColor(small, cv2.COLOR_BGR2RGB)).save(os.path.join(repo, "assets/map", name + ".webp"), "WEBP", quality=q, method=6)
        print("  tiles %.1f MB, zmax %d" % (total / 1e6, zmax))
