#!/usr/bin/env python3
"""Write scripts/drawings/kalam-advances.json: the Kalam advance width of every character, in em, for weights 400 and 700.

The drawing generators (scripts/drawings/) measure labels with these numbers, the same hmtx advances that
en-translation-wip/tools/fit.py reads, so a node script can tell whether a label fits its box without fontTools.
Run from the site root after a Kalam upgrade: python3 scripts/dev/kalam-advances.py
"""
import json
from pathlib import Path

from fontTools.ttLib import TTFont

FONTS = Path('node_modules/@fontsource/kalam/files')
out = {}
for weight in (400, 700):
    cmap = {}
    for sub in ('latin', 'latin-ext'):
        f = TTFont(str(FONTS / f'kalam-{sub}-{weight}-normal.woff'))
        upem = f['head'].unitsPerEm
        hmtx = f['hmtx'].metrics
        for cp, g in f.getBestCmap().items():
            if cp not in cmap:
                cmap[cp] = round(hmtx[g][0] / upem, 4)
    out[str(weight)] = {chr(cp): cmap[cp] for cp in sorted(cmap)}
Path('scripts/drawings/kalam-advances.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n')
print('kalam-advances.json:', {k: len(v) for k, v in out.items()}, 'characters')
