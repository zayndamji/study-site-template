#!/usr/bin/env python3
"""Add data-page to citation pills that lack one, from a JSON map of citation text -> page.

  python3 add_pages.py content/units/02.html pages.json           # report only
  python3 add_pages.py content/units/02.html pages.json --write   # edit the file in place

pages.json: {"Ex 1.2": 42, "Fig 1.4": 47, …}. An element matches when its text (tags removed,
whitespace collapsed) equals a key; --ignore-case relaxes that. Only <span class="cite"> and
<td class="cite"> (any other classes allowed) without data-page are touched. The report lists
citations with no entry in the map, so you can complete it and run again.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
from pathlib import Path

OPEN_RX = re.compile(r'<(span|td)\b([^>]*\bclass="[^"]*(?<![\w-])cite(?![\w-])[^"]*"[^>]*)>', re.I)
TAG_RX = re.compile(r'<[^>]+>')


def close_of(text, tag, start):
    """Index just past the </tag> matching an element whose content starts at `start`."""
    rx = re.compile(rf'<(/?){tag}\b[^>]*>', re.I)
    depth = 1
    for m in rx.finditer(text, start):
        depth += -1 if m.group(1) else 1
        if depth == 0:
            return m.start(), m.end()
    return None


def norm(s, fold):
    s = ' '.join(html.unescape(TAG_RX.sub('', s)).split())
    return s.casefold() if fold else s


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('file')
    ap.add_argument('map', help='JSON file {"citation text": page}')
    ap.add_argument('--write', action='store_true', help='edit the file in place (default: report only)')
    ap.add_argument('--ignore-case', action='store_true')
    a = ap.parse_args(argv)
    path = Path(a.file)
    text = path.read_text(encoding='utf-8')
    raw = json.loads(Path(a.map).read_text(encoding='utf-8'))
    pages = {norm(k, a.ignore_case): v for k, v in raw.items()}
    out, pos, added, missing, kept = [], 0, 0, {}, 0
    for m in OPEN_RX.finditer(text):
        if m.start() < pos:
            continue
        tag, attrs = m.group(1), m.group(2)
        end = close_of(text, tag, m.end())
        if not end:
            print(f'warning: unclosed <{tag} class="cite"> at offset {m.start()}', file=sys.stderr)
            continue
        if re.search(r'\bdata-page\s*=', attrs):
            kept += 1
            continue
        label = norm(text[m.end():end[0]], a.ignore_case)
        if label in pages:
            out.append(text[pos:m.start()])
            out.append(f'<{tag}{attrs.rstrip()} data-page="{html.escape(str(pages[label]), quote=True)}">')
            pos = m.end()
            added += 1
        else:
            missing[label] = missing.get(label, 0) + 1
    out.append(text[pos:])
    print(f'{path}: {added} page(s) added, {kept} already had one, {sum(missing.values())} without a map entry')
    for label, n in sorted(missing.items()):
        print(f'  no entry: {label!r}' + (f' (x{n})' if n > 1 else ''))
    if a.write and added:
        path.write_text(''.join(out), encoding='utf-8')
        print('written')
    elif added and not a.write:
        print('(report only; pass --write to edit the file)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
