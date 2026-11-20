#!/usr/bin/env python3
"""Validate every pack in packs/. No network, no station.

Checks:
  - directory name matches the id regex
  - widget.js exists
  - no single file over 2 MB
  - no .js file contains its own pack id (packs are location-independent)
"""
import pathlib
import re
import sys

ID = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$')
MAX_BYTES = 2 * 1024 * 1024


def main():
    root = pathlib.Path(__file__).resolve().parents[1] / 'packs'
    if not root.is_dir():
        print(f'FAIL no packs/ dir at {root}')
        return 1
    bad = 0
    packs = [p for p in sorted(root.iterdir()) if p.is_dir()]
    if not packs:
        print('FAIL no packs found')
        return 1
    for p in packs:
        if not ID.match(p.name):
            print(f'FAIL id      {p.name}')
            bad += 1
        if not (p / 'widget.js').is_file():
            print(f'FAIL missing {p.name}/widget.js')
            bad += 1
        for f in p.rglob('*'):
            if not f.is_file():
                continue
            if f.stat().st_size > MAX_BYTES:
                print(f'FAIL big     {f} ({f.stat().st_size} bytes)')
                bad += 1
            if f.suffix == '.js' and p.name.encode() in f.read_bytes():
                print(f'FAIL id-in-js {f}')
                bad += 1
        print(f'ok   {p.name}')
    print('OK' if bad == 0 else f'{bad} problem(s)')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
