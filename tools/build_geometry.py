#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Measure original STL vertices without changing meshes; cache by size/mtime."""
from pathlib import Path
from datetime import datetime, timezone
import json, struct, re
import numpy as np

BASE = Path(__file__).resolve().parents[1]
LIB = BASE.parent / '261021_VAULT_USSA_S'
OUT = BASE / 'dist/geometry.json'
DTYPE = np.dtype([('normal', '<f4', (3,)), ('vertices', '<f4', (3, 3)), ('attr', '<u2')])

def measure(path):
    with path.open('rb') as stream:
        head = stream.read(84)
    count = struct.unpack('<I', head[80:84])[0] if len(head) == 84 else 0
    if count and path.stat().st_size == 84 + count * 50:
        mesh = np.memmap(path, dtype=DTYPE, mode='r', offset=84, shape=(count,))
        points = mesh['vertices']
        low = points.min(axis=(0, 1)).astype(float)
        high = points.max(axis=(0, 1)).astype(float)
    else:
        points = np.array([list(map(float, m)) for m in re.findall(
            r'\bvertex\s+([-+\deE.]+)\s+([-+\deE.]+)\s+([-+\deE.]+)', path.read_text())])
        if not len(points):
            raise ValueError('No STL vertices: ' + str(path))
        low, high = points.min(axis=0), points.max(axis=0)
    dimensions = high - low
    if not np.isfinite(dimensions).all() or (dimensions <= 0).any():
        raise ValueError('Invalid geometry: ' + str(path))
    # Round outward, so display/index precision never turns an oversized part into a fit.
    return {'size': (np.ceil(dimensions * 1000) / 1000).tolist(),
            'min': low.tolist(), 'max': high.tolist()}

def main():
    catalog = json.loads((BASE / 'dist/catalog.json').read_text())
    previous = json.loads(OUT.read_text()).get('records', {}) if OUT.exists() else {}
    records = {}
    stls = [f for f in catalog['files'] if f['path'].lower().endswith('.stl')]
    for index, file in enumerate(stls, 1):
        path = LIB / file['path']
        stat = path.stat()
        cached = previous.get(file['path'], {})
        if cached.get('sourceBytes') == stat.st_size and cached.get('sourceMtimeNs') == stat.st_mtime_ns:
            records[file['path']] = cached
        else:
            records[file['path']] = {**measure(path), 'sourceBytes': stat.st_size,
                                    'sourceMtimeNs': stat.st_mtime_ns}
        if index % 50 == 0:
            print(f'Measured {index}/{len(stls)}', flush=True)
    result = {'version': 1, 'unit': 'mm', 'method': 'Original STL vertex axis-aligned bounds; no scaling',
              'updatedAt': datetime.now(timezone.utc).isoformat(), 'records': records}
    OUT.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')))
    print(f'Complete: {len(records)} STL geometry records', flush=True)

if __name__ == '__main__':
    main()
