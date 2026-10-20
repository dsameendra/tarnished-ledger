"""Encode the cleaned images to WebP in assets/map/ at native size and print the sizes.
usage: export.py <repo_root> [quality_surface quality_under quality_dlc]"""
import os
import sys

from PIL import Image

import common as C

ITEMS = [('base', 'surface'), ('under', 'underground'), ('dlc', 'dlc')]

if __name__ == '__main__':
    root = sys.argv[1]
    qs = [int(q) for q in sys.argv[2:5]] or [78, 78, 78]
    os.makedirs(root + '/assets/map', exist_ok=True)
    for (key, name), q in zip(ITEMS, qs):
        im = Image.open('%s/clean_%s_telea.png' % (C.WORK, key)).convert('RGB')
        p = '%s/assets/map/%s.webp' % (root, name)
        im.save(p, 'WEBP', quality=q, method=6)
        print(name, im.size, q, os.path.getsize(p) // 1024, 'KB')
