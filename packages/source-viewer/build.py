"""source-viewer build hooks: `study.py check` reports a missing manifest and explicit chips
(<button class="sv-chip" data-deck="…">, <span class="sv-ref" …>) whose deck the manifest does not list."""
import json
import re

CHIP_RX = re.compile(r'<(?:button|span)\b[^>]*\bclass="[^"]*\bsv-(?:chip|ref)\b[^"]*"[^>]*>', re.I)
DECK_RX = re.compile(r'\bdata-deck="([^"]*)"')
PAGE_RX = re.compile(r'<body\b[^>]*\bdata-page="([^"]*)"')
SVPAGE_RX = re.compile(r'\bdata-sv-page="([^"]*)"')


def _rel(ctx, p):
    try:
        return str(p.relative_to(ctx.site_dir))
    except ValueError:
        return str(p)


def _manifest(ctx, opts):
    base = str(opts.get('base') or '')
    if re.match(r'^[a-z][\w+.-]*:|^/', base, re.I):
        return None, None  # absolute URL or root path: cannot check locally
    folder = ctx.out_dir / base
    j, s = ctx.built_file(f'{base}/index.json'), ctx.built_file(f'{base}/index.js')
    try:
        if j.exists():
            return json.loads(j.read_text(encoding='utf-8')), _rel(ctx, j)
        if s.exists():
            text = s.read_text(encoding='utf-8')
            m = re.search(r'=\s*(\{.*\})\s*;?\s*$', text, re.S)
            return (json.loads(m.group(1)) if m else {}), _rel(ctx, s)
    except (ValueError, OSError) as e:
        return {'_error': str(e)}, _rel(ctx, folder)
    return {}, None


def check(ctx, opts, outputs):
    problems = []
    man, where = _manifest(ctx, opts)
    if man is None:
        return problems
    uses = {}
    for rel, html in outputs.items():
        if 'sv-chip' not in html and 'sv-ref' not in html:
            continue
        pm = PAGE_RX.search(html)
        # {page} is the body's page id or a data-sv-page value; accept the chip if any candidate is listed
        pages = [pm.group(1) if pm else ''] + SVPAGE_RX.findall(html)
        for tag in CHIP_RX.findall(html):
            dm = DECK_RX.search(tag)
            if dm:
                uses[(dm.group(1), rel)] = pages
    if where is None:
        problems.append(f'source-viewer: no manifest at {opts.get("base")}index.js or index.json in the built site '
                        '(put it under static/; see packages/source-viewer/README.md)')
        return problems
    if '_error' in man:
        problems.append(f'source-viewer: cannot read {where}: {man["_error"]}')
        return problems
    decks = man.get('decks') or {}
    for (deck, rel), pages in sorted(uses.items()):
        if not any(deck.replace('{page}', p) in decks for p in pages):
            problems.append(f'source-viewer: {rel} cites deck "{deck.replace("{page}", pages[0])}", '
                            f'which {where} does not list')
    return problems
