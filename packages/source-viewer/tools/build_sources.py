#!/usr/bin/env python3
"""Write the source-viewer manifest (index.js + index.json) and, optionally, pack sprite sheets.

INPUT is a folder of frame images (one deck) or a folder of deck folders (one deck per
subfolder, named after the deck id). Frames are ordered by natural sort of their file names
(p2.png before p10.png); frame 1 is the first.

  # one file per frame (stdlib only): copies frames to OUT/<deck>/001.png, 002.png, …
  python3 build_sources.py renders/ --out my-site/static/assets/sources

  # frames already in OUT/<deck>/ named 1.webp… or 001.webp…: just (re)write the manifest
  python3 build_sources.py my-site/static/assets/sources/A --out my-site/static/assets/sources

  # sprite sheets (needs Pillow): OUT/<deck>-00.webp, -01.webp, … with 5x5 frames each
  python3 build_sources.py renders/ --out my-site/static/assets/sources --sprites --width 880 --quality 60

  # labels shown in the popover caption
  python3 build_sources.py renders/A --deck A --label "Deck A" --prefix s --out …

Other options: --labels labels.json ({"deck": "Label"}), --only A,B, --format webp|png|jpeg
(convert frames, needs Pillow), --size WxH (frame size when it cannot be read, e.g. SVG),
--dry-run. The manifest is merged: decks not named in this run are kept.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import struct
import sys
from pathlib import Path

IMAGE_EXT = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.svg'}
SHEET_RX = re.compile(r'-\d{2,}\.(webp|png|jpe?g)$')


def natural(p: Path):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r'(\d+)', p.name)]


def frames_in(folder: Path):
    return sorted((p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXT), key=natural)


def image_size(path: Path):
    """(width, height) of a PNG, JPEG, GIF or WebP file using only the standard library; None if unknown."""
    with open(path, 'rb') as f:
        head = f.read(64)
        if head[:8] == b'\x89PNG\r\n\x1a\n':
            return struct.unpack('>II', head[16:24])
        if head[:6] in (b'GIF87a', b'GIF89a'):
            return struct.unpack('<HH', head[6:10])
        if head[:4] == b'RIFF' and head[8:12] == b'WEBP':
            kind = head[12:16]
            if kind == b'VP8 ':
                w, h = struct.unpack('<HH', head[26:30])
                return w & 0x3FFF, h & 0x3FFF
            if kind == b'VP8L':
                b = head[21:25]
                w = 1 + (((b[1] & 0x3F) << 8) | b[0])
                h = 1 + (((b[3] & 0x0F) << 10) | (b[2] << 2) | ((b[1] & 0xC0) >> 6))
                return w, h
            if kind == b'VP8X':
                w = 1 + int.from_bytes(head[24:27], 'little')
                h = 1 + int.from_bytes(head[27:30], 'little')
                return w, h
            return None
        if head[:2] == b'\xff\xd8':
            f.seek(2)
            while True:
                b = f.read(1)
                while b and b != b'\xff':
                    b = f.read(1)
                while b == b'\xff':
                    b = f.read(1)
                if not b:
                    return None
                marker = b[0]
                if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
                    continue
                seg = f.read(2)
                if len(seg) < 2:
                    return None
                length = struct.unpack('>H', seg)[0]
                if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                    data = f.read(5)
                    h, w = struct.unpack('>HH', data[1:5])
                    return w, h
                f.seek(length - 2, 1)
    return None


def find_decks(inputs, deck_id):
    decks = []
    for raw in inputs:
        d = Path(raw)
        if not d.is_dir():
            sys.exit(f'error: {d} is not a folder')
        if frames_in(d):
            decks.append((deck_id or d.name, d))
        else:
            subs = [s for s in sorted(d.iterdir(), key=natural) if s.is_dir() and frames_in(s)]
            if not subs:
                sys.exit(f'error: no images in {d} or its subfolders')
            if deck_id:
                sys.exit('error: --deck names one deck; INPUT holds several deck folders')
            decks += [(s.name, s) for s in subs]
    ids = [k for k, _ in decks]
    dup = {k for k in ids if ids.count(k) > 1}
    if dup:
        sys.exit('error: duplicate deck ids: ' + ', '.join(sorted(dup)))
    return decks


def read_manifest(out: Path):
    j, s = out / 'index.json', out / 'index.js'
    try:
        if j.exists():
            return json.loads(j.read_text(encoding='utf-8'))
        if s.exists():
            m = re.search(r'=\s*(\{.*\})\s*;?\s*$', s.read_text(encoding='utf-8'), re.S)
            if m:
                return json.loads(m.group(1))
    except ValueError as e:
        sys.exit(f'error: cannot read the existing manifest in {out}: {e}')
    return {'decks': {}}


def write_manifest(out: Path, man: dict):
    man['decks'] = dict(sorted(man.get('decks', {}).items()))
    text = json.dumps(man, ensure_ascii=False, separators=(',', ':'))
    (out / 'index.json').write_text(text + '\n', encoding='utf-8')
    # the same data as a script, for pages opened from disk (file:// blocks fetch, not <script>)
    (out / 'index.js').write_text('window.STUDY_SOURCES=' + text + ';\n', encoding='utf-8')


def need_pillow():
    try:
        from PIL import Image  # noqa: F401
        return Image
    except ImportError:
        sys.exit('error: this mode needs Pillow (python3 -m pip install Pillow)')


def flatten(Image, path):
    im = Image.open(path)
    im.load()
    if im.mode in ('RGBA', 'LA', 'P'):
        im = im.convert('RGBA')
        bg = Image.new('RGBA', im.size, 'white')
        bg.alpha_composite(im)
        im = bg
    return im.convert('RGB')


def save(im, path: Path, fmt, quality):
    if fmt == 'webp':
        im.save(path, 'WEBP', quality=quality, method=6)
    elif fmt == 'jpeg':
        im.save(path, 'JPEG', quality=quality, optimize=True, progressive=True)
    else:
        im.save(path, 'PNG', optimize=True)


def per_frame(deck, src, files, out: Path, a):
    """One file per frame -> OUT/<deck>/<NNN>.<ext>. Returns the manifest entry."""
    dest = out / deck
    n = len(files)
    pad = max(3, len(str(n)))
    if src.resolve() == dest.resolve():
        exts = {f.suffix.lower() for f in files}
        names = [f.stem for f in files]
        widths = {len(s) for s in names}
        ok = (len(exts) == 1 and all(s.isdigit() for s in names) and [int(s) for s in names] == list(range(1, n + 1))
              and (len(widths) == 1 or all(not s.startswith('0') for s in names)))
        if not ok:
            sys.exit(f'error: frames already in {dest} must be named 1{files[0].suffix}, 2{files[0].suffix}, … '
                     f'or 001{files[0].suffix}, 002{files[0].suffix}, …; or point INPUT at another folder to copy them')
        w = widths.pop() if len(widths) == 1 and names[0].startswith('0') else 0
        pattern = '{deck}/{n' + (f':0{w}' if w else '') + '}' + exts.pop()
        size = a.size or image_size(files[0])
        return pattern, size
    convert = a.format or a.width
    if convert:
        Image = need_pillow()
        fmt = a.format or 'webp'
        ext = '.jpg' if fmt == 'jpeg' else '.' + fmt
    else:
        exts = {f.suffix.lower() for f in files}
        if len(exts) > 1:
            sys.exit(f'error: deck {deck} mixes {", ".join(sorted(exts))}; use --format (needs Pillow) to convert')
        ext = exts.pop()
    if a.dry_run:
        return '{deck}/{n:0' + str(pad) + '}' + ext, a.size or image_size(files[0])
    dest.mkdir(parents=True, exist_ok=True)
    for old in dest.iterdir():
        if old.is_file() and old.stem.isdigit():
            old.unlink()
    size = None
    for i, f in enumerate(files, 1):
        target = dest / f'{i:0{pad}d}{ext}'
        if convert:
            im = flatten(Image, f)
            if a.width and im.width != a.width:
                im = im.resize((a.width, round(im.height * a.width / im.width)), Image.LANCZOS)
            size = size or im.size
            save(im, target, fmt, a.quality)
        else:
            shutil.copyfile(f, target)
    return '{deck}/{n:0' + str(pad) + '}' + ext, a.size or size or image_size(files[0])


def sprites(deck, files, out: Path, a):
    """cols x rows frames per sheet -> OUT/<deck>-<kk>.<ext>. Returns the manifest entry."""
    Image = need_pillow()
    fmt = a.format or 'webp'
    ext = 'jpg' if fmt == 'jpeg' else fmt
    first = Image.open(files[0])
    w = a.width or first.width
    h = round(first.height * w / first.width)
    per = a.cols * a.rows
    sheets = -(-len(files) // per)
    if not a.dry_run:
        for old in out.glob(f'{deck}-*'):
            rest = old.name[len(deck) + 1:]
            if old.is_file() and SHEET_RX.search(old.name) and rest.split('.')[0].isdigit():
                old.unlink()
        for k in range(sheets):
            chunk = files[k * per:(k + 1) * per]
            sheet = Image.new('RGB', (w * a.cols, h * a.rows), 'white')
            for j, f in enumerate(chunk):
                im = flatten(Image, f)
                if im.size != (w, h):
                    im = im.resize((w, h), Image.LANCZOS)
                sheet.paste(im, ((j % a.cols) * w, (j // a.cols) * h))
            save(sheet, out / f'{deck}-{k:02d}.{ext}', fmt, a.quality)
    entry = {'w': w, 'h': h, 'cols': a.cols, 'rows': a.rows}
    if ext != 'webp':
        entry['sheet'] = '{deck}-{k:02}.' + ext
    return entry, sheets


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('inputs', nargs='+', metavar='INPUT', help='folder of frames, or folder of deck folders')
    ap.add_argument('--out', required=True, help='output folder, usually <site>/static/assets/sources')
    ap.add_argument('--deck', help='deck id when INPUT is a single deck (default: the folder name)')
    ap.add_argument('--label', help='caption label for the deck (single deck only)')
    ap.add_argument('--labels', help='JSON file {"deck id": "label"}')
    ap.add_argument('--prefix', help='citation prefix stored with the deck(s), used in captions of explicit chips')
    ap.add_argument('--only', help='comma-separated deck ids to process')
    ap.add_argument('--sprites', action='store_true', help='pack frames into sprite sheets (needs Pillow)')
    ap.add_argument('--cols', type=int, default=5)
    ap.add_argument('--rows', type=int, default=5)
    ap.add_argument('--width', type=int, help='resize frames to this width in px (needs Pillow)')
    ap.add_argument('--quality', type=int, default=60, help='WebP/JPEG quality (default 60)')
    ap.add_argument('--format', choices=['webp', 'png', 'jpeg'], help='output image format (needs Pillow)')
    ap.add_argument('--size', help='frame size WxH, when it cannot be read from the files')
    ap.add_argument('--dry-run', action='store_true', help='report what would be written; write nothing')
    a = ap.parse_args(argv)
    if a.size:
        m = re.fullmatch(r'(\d+)[x×](\d+)', a.size)
        if not m:
            sys.exit('error: --size must look like 1600x900')
        a.size = (int(m.group(1)), int(m.group(2)))
    if a.cols < 1 or a.rows < 1:
        sys.exit('error: --cols and --rows must be at least 1')

    out = Path(a.out)
    decks = find_decks(a.inputs, a.deck)
    if a.only:
        keep = set(a.only.split(','))
        decks = [(k, d) for k, d in decks if k in keep]
    if a.label and len(decks) != 1:
        sys.exit('error: --label needs exactly one deck; use --labels FILE for several')
    labels = json.loads(Path(a.labels).read_text(encoding='utf-8')) if a.labels else {}
    if a.label:
        labels[decks[0][0]] = a.label
    if not a.dry_run:
        out.mkdir(parents=True, exist_ok=True)
    man = read_manifest(out)
    man.setdefault('decks', {})

    for deck, src in decks:
        files = frames_in(src)
        old = man['decks'].get(deck, {})
        entry = {'n': len(files)}
        if a.sprites:
            e, sheets = sprites(deck, files, out, a)
            entry.update(e)
            how = f'{sheets} sheet(s) of {a.cols}x{a.rows}'
        else:
            pattern, size = per_frame(deck, src, files, out, a)
            if not size:
                sys.exit(f'error: cannot read the size of {files[0]}; pass --size WxH')
            entry.update({'w': size[0], 'h': size[1], 'pattern': pattern})
            how = 'one file per frame (' + pattern + ')'
            if not a.dry_run and not a.size:
                odd = [f.name for f in files[1:] if (lambda s: s and abs(s[0] * size[1] - s[1] * size[0]) > 0.02 * s[0] * size[1])(image_size(f))]
                if odd:
                    print(f'  note: {len(odd)} frame(s) of {deck} have a different shape than frame 1 '
                          f'(e.g. {odd[0]}); they are shown letterboxed', file=sys.stderr)
        label = labels.get(deck, old.get('label'))
        if label:
            entry['label'] = label
        prefix = a.prefix if a.prefix is not None else old.get('prefix')
        if prefix:
            entry['prefix'] = prefix
        man['decks'][deck] = entry
        print(f'{deck}: {len(files)} frames, {how}')
    if a.dry_run:
        print('(dry run: nothing written)')
        return 0
    write_manifest(out, man)
    print(f'wrote {out / "index.js"} and index.json ({len(man["decks"])} deck(s))')
    return 0


if __name__ == '__main__':
    sys.exit(main())
