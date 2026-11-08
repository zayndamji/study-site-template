#!/usr/bin/env python3
"""Render the demo's own source material into the files the site cites.

  sources/slides/NN.json  ->  static/assets/sources/NNs/001.webp …  (+ index.js / index.json manifest)
  sources/reader/NN.json  ->  static/reader.pdf  (all lectures' reader pages, in order)

The demo writes its "slides" and "reader" itself, so every slide chip, quote and page citation
in the notes points at something real. Needs Pillow (pip install pillow).

  python3 demo/tools/render_sources.py [--only 01,02] [--no-reader]

Slide JSON:  {"title": "…", "slides": [{"title": "…", "bullets": ["…", …], "note": "optional footer"}, …]}
Reader JSON: {"pages": [{"heading": "…", "paragraphs": ["…", …]}, …]}   (4 pages per lecture)
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

DEMO = Path(__file__).resolve().parents[1]
SLIDES_IN, READER_IN = DEMO / 'sources' / 'slides', DEMO / 'sources' / 'reader'
OUT = DEMO / 'static' / 'assets' / 'sources'
READER_OUT = DEMO / 'static' / 'reader.pdf'
W, H = 960, 540
PAGE_W, PAGE_H = 1240, 1754  # A4 at 150 dpi

FONT_CANDIDATES = [
    '/System/Library/Fonts/Supplemental/Arial Unicode.ttf', '/Library/Fonts/Arial Unicode.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf',
]
SERIF_CANDIDATES = [
    '/System/Library/Fonts/Supplemental/STIXTwoText.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf',
] + FONT_CANDIDATES


def font(size, serif=False):
    for p in (SERIF_CANDIDATES if serif else FONT_CANDIDATES):
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    sys.exit('No Unicode TrueType font found; add one to FONT_CANDIDATES.')


def wrap(draw, text, fnt, width):
    lines, line = [], ''
    for word in text.split():
        test = (line + ' ' + word).strip()
        if draw.textlength(test, font=fnt) <= width or not line:
            line = test
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def render_slide(deck_title, i, n, s):
    img = Image.new('RGB', (W, H), '#fbfaf7')
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 10], fill='#0f6b5c')
    title_f, body_f, small_f = font(40), font(26), font(16)
    y = 46
    for line in wrap(d, s['title'], title_f, W - 120):
        d.text((60, y), line, font=title_f, fill='#14201d')
        y += 50
    y += 18
    for b in s.get('bullets', []):
        lines = wrap(d, b, body_f, W - 160)
        d.ellipse([66, y + 12, 76, y + 22], fill='#0f6b5c')
        for k, line in enumerate(lines):
            d.text((92, y), line, font=body_f, fill='#24302d')
            y += 36
        y += 12
    foot = f'{deck_title}  ·  {i} / {n}'
    if s.get('note'):
        foot = s['note'] + '   ·   ' + foot
    d.text((60, H - 36), foot, font=small_f, fill='#7a8682')
    return img


def render_deck(nn):
    data = json.loads((SLIDES_IN / f'{nn}.json').read_text(encoding='utf-8'))
    slides = data['slides']
    deck = f'{nn}s'
    out = OUT / deck
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob('*.webp'):
        old.unlink()
    for i, s in enumerate(slides, 1):
        render_slide(data.get('title', f'Lecture {nn} slides'), i, len(slides), s).save(out / f'{i:03d}.webp', quality=80)
    return deck, {'n': len(slides), 'w': W, 'h': H, 'pattern': '{deck}/{n:03}.webp',
                  'label': data.get('title', f'Lecture {nn} slides'), 'prefix': 's'}


def render_reader():
    pages = []
    for f in sorted(READER_IN.glob('*.json')):
        pages += json.loads(f.read_text(encoding='utf-8'))['pages']
    if not pages:
        return 0
    head_f, body_f, small_f = font(44, serif=True), font(30, serif=True), font(22)
    imgs = []
    for num, p in enumerate(pages, 1):
        img = Image.new('RGB', (PAGE_W, PAGE_H), 'white')
        d = ImageDraw.Draw(img)
        d.text((130, 70), 'Probability Notebook · Reader', font=small_f, fill='#7a8682')
        y = 150
        for line in wrap(d, p['heading'], head_f, PAGE_W - 260):
            d.text((130, y), line, font=head_f, fill='#14201d')
            y += 58
        y += 26
        for para in p.get('paragraphs', []):
            for line in wrap(d, para, body_f, PAGE_W - 260):
                d.text((130, y), line, font=body_f, fill='#222')
                y += 44
            y += 24
        if y > PAGE_H - 140:
            print(f'warning: reader page {num} overflows; shorten it', file=sys.stderr)
        d.text((PAGE_W // 2, PAGE_H - 80), str(num), font=small_f, fill='#555', anchor='mm')
        imgs.append(img)
    imgs[0].save(READER_OUT, save_all=True, append_images=imgs[1:], resolution=150)
    return len(imgs)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', help='comma-separated lecture ids, e.g. 01,02')
    ap.add_argument('--no-reader', action='store_true')
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    man_p = OUT / 'index.json'
    manifest = json.loads(man_p.read_text()) if man_p.exists() else {'decks': {}}
    only = set(a.only.split(',')) if a.only else None
    for f in sorted(SLIDES_IN.glob('*.json')):
        if only and f.stem not in only:
            continue
        deck, entry = render_deck(f.stem)
        manifest['decks'][deck] = entry
        print(f'{deck}: {entry["n"]} slides')
    man_p.write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    (OUT / 'index.js').write_text('window.STUDY_SOURCES = ' + json.dumps(manifest, ensure_ascii=False) + ';\n', encoding='utf-8')
    if not a.no_reader:
        print(f'reader.pdf: {render_reader()} pages')


if __name__ == '__main__':
    main()
