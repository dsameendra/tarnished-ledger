# Map calibration pipeline

Produces `assets/map/{surface,underground,dlc}.webp` and `js/data/map-calib.js` from three in-game map
screenshots and the public MapGenie JSON (`lands-between.json` = map 413, `realm-of-shadow.json` = map 638,
`page-mapdata-categories.json`). Only supplied images and the open JSON are used. The screenshots are not
committed; paths are set at the top of `common.py` (`SRC`, `DATA`, `IMAGES`, `WORK`).

## Setup

```
python3 -m venv venv && ./venv/bin/pip install -r scripts/calibrate/requirements.txt   # keep the venv outside the repo
```

## Run order

All scripts are run with the venv python from any directory; intermediates go to `WORK`.

1. `fit.py affine` - coarse fit. Detects Site of Grace discs (gold colour blobs on the surface map, Hough circles
   on the larger underground/DLC icons), votes over scale and translation against the MapGenie Site of Grace
   category (id 5658), then runs ICP with a full affine. Underground discs are split per sub-map by pixel
   area and matched against the region ids Ainsel River (1349), Siofra River (1334), Deeproot Depths (1350).
   Writes `calib_affine.json`. The surface fit excludes the three underground regions, whose MapGenie
   coordinates live beside the surface map.
2. `refine.py affine` - optional diagnostics: localises each projected grace with a masked template search and
   re-fits a free affine. It showed no rotation or shear beyond noise (b/a, d/a < 0.002), so the final model is
   constrained.
3. `final.py` - final model, `px = s * m + t` per map (`a = e = s`, `b = d = 0`). The three underground
   sub-maps share one scale and have separate translations. Iterates localise -> trimmed least squares.
   Writes `calib_final.json` (transforms, residuals, per-grace measured centres).
4. `overlay.py <image> <base|under|dlc> <out.png>` - draws projected graces (red) and landmarks (green) for a
   visual check.
5. `inpaint.py telea` - removes the grace discs (mask = disc and glow at every calibrated grace position, snapped
   to the measured centre, plus extra Hough discs not in MapGenie), `cv2.inpaint` (Telea), then adds grain
   matched to the surroundings so the filled spots do not look like smooth blobs. Writes
   `clean_<key>_telea.png` (`inpaint.py ns` for Navier-Stokes; Telea looked sharper).
6. `export.py <repo> 90 92 90` - WebP at native size (qualities per map).
7. `gen_calib_js.py <repo>` - writes `js/data/map-calib.js`; its first line records the median residuals,
   which `test/calib.test.mjs` checks against the 3 px threshold.

`detect.py` from an earlier iteration (global template matching) was dropped; the colour/Hough seeds in
`common.py` replace it.

## Notes

- Residual floor: MapGenie marker coordinates are hand-placed, so roughly 2 px rms noise per axis remains
  even with 100+ inliers; residuals showed no spatial pattern.
- Normalised Web Mercator: `xm = (lng + 180) / 360`, `ym = (1 - ln(tan(lat) + 1/cos(lat)) / pi) / 2`.
