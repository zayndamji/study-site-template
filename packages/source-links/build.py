"""source-links: "§ Heading" references in source lines become links to that heading of the
page's online source (with a text fragment, so the browser scrolls to and highlights it).

Done at build time: the page HTML already holds the links, no script needed.
"""
from __future__ import annotations

import re
from urllib.parse import quote

_ELEM = re.compile(r'<(?P<tag>[a-zA-Z][\w-]*)\b(?P<attrs>[^>]*)>(?P<text>[^<]*)</(?P=tag)>')
_CLASS = re.compile(r'\bclass="([^"]*)"')


def _simple(sel):
    m = re.match(r'^([a-zA-Z][\w-]*)?((?:\.[\w-]+)*)$', str(sel).strip())
    if not m or not str(sel).strip():
        return None
    return (m.group(1) or None), set(c for c in m.group(2).split('.') if c)


def configure(ctx, opts):
    sels = []
    for s in opts.get('selectors') or []:
        p = _simple(s)
        if p is None:
            ctx.warn(f'source-links: selector {s!r} is not a simple selector (tag, .class or tag.class); ignored')
        else:
            sels.append(p)
    opts['_selectors'] = sels
    if not opts.get('marker'):
        ctx.warn('source-links: option "marker" is empty; nothing will be linked')


def _fragment(heading, opts):
    """Text fragment for a heading: quotes and (parenthetical asides) dropped; "start … end"
    becomes a range (text=start,end)."""
    h = re.sub(r'[“”"]', '', heading)
    h = re.sub(r'\(.*?\)', '', h).strip()
    parts = [x.strip() for x in re.split(r'\s*…\s*|\s*\.\.\.\s*', h) if x.strip()]
    # "-" has a meaning inside text fragments, so it is escaped as well
    return ','.join(quote(x, safe='').replace('-', '%2D') for x in parts)


def _url(ctx, opts, page):
    u = page.get(opts['urlField'])
    if not u:
        return None
    u = str(u)
    if not re.match(r'^[a-z][\w+.-]*:', u, re.I) and opts.get('baseUrl'):
        u = str(opts['baseUrl']) + u
    return u


def head(ctx, opts, page):
    """The page's source address, for the script that links references page scripts add later."""
    url = _url(ctx, opts, page) if page else None
    return f'<meta name="source-links-url" content="{ctx.esc(url)}">' if url else ''


_SECTION = re.compile(r'<section\b(?P<attrs>[^>]*)>.*?</section>', re.S)
_ATTR = re.compile(r'\b(data-sv-page|data-sheet-kind)="([^"]*)"')


def finalize(ctx, opts, outputs):
    """Link finished pages, so content other packages insert (summary sheets) is covered too.
    A page that gathers other pages' content (the all-sheets page) marks each block with
    data-sv-page (and data-sheet-kind); such a block links to its own page's source."""
    files = {p['file']: p for p in ctx.ready_pages()}
    by_id = {}
    for p in ctx.ready_pages():
        by_id.setdefault(p['id'], []).append(p)
    for rel in list(outputs):
        if not rel.endswith('.html'):
            continue
        page = files.get(rel)
        if page:
            outputs[rel] = _apply(ctx, opts, _url(ctx, opts, page), outputs[rel])
            continue

        def block(m):
            a = dict(_ATTR.findall(m.group('attrs')))
            cands = by_id.get(a.get('data-sv-page'), [])
            if a.get('data-sheet-kind'):
                cands = [p for p in cands if p['kind'] == a['data-sheet-kind']]
            return _apply(ctx, opts, _url(ctx, opts, cands[0]), m.group(0)) if len(cands) == 1 else m.group(0)
        if 'data-sv-page=' in outputs[rel]:
            outputs[rel] = _SECTION.sub(block, outputs[rel])


def _apply(ctx, opts, url, html):
    marker = opts.get('marker') or ''
    if not url or not marker or marker not in html:
        return html
    seps = opts.get('separators') or ''
    split_rx = re.compile('(\\s*[' + re.escape(seps) + ']\\s*)') if seps else None
    target = ' target="_blank" rel="noopener"' if opts.get('newTab', True) else ''
    title = ctx.esc(opts.get('linkTitle') or '')

    def link(part):
        heading = part.split(marker, 1)[1]
        frag = _fragment(heading, opts) if opts.get('textFragments', True) else ''
        href = url + ('#:~:text=' + frag if frag else '')
        t = f' title="{title}"' if title else ''
        return f'<a class="src-link" href="{ctx.esc(href)}"{target}{t}>{part.strip()}</a>'

    def fix(m):
        cm = _CLASS.search(m.group('attrs'))
        classes = set(cm.group(1).split()) if cm else set()
        tag = m.group('tag').lower()
        if not any((t is None or t == tag) and c <= classes for t, c in opts['_selectors']):
            return m.group(0)
        text = m.group('text')
        if marker not in text:
            return m.group(0)
        parts = split_rx.split(text) if split_rx else [text]
        out = []
        for part in parts:
            if marker in part and not (split_rx and split_rx.fullmatch(part)):
                lead = part[:len(part) - len(part.lstrip())]
                out.append(lead + link(part))
            else:
                out.append(part)
        return f'<{m.group("tag")}{m.group("attrs")}>{"".join(out)}</{m.group("tag")}>'

    return _ELEM.sub(fix, html)


def check(ctx, opts, outputs):
    problems = []
    marker = opts.get('marker') or ''
    if not marker or not opts.get('requireUrl'):
        return problems
    for page in ctx.ready_pages():
        if _url(ctx, opts, page):
            continue
        html = outputs.get(page['file']) or ''
        if re.search(r'class="[^"]*\bsrc-link\b', html):
            continue
        for m in _ELEM.finditer(html):
            cm = _CLASS.search(m.group('attrs'))
            classes = set(cm.group(1).split()) if cm else set()
            tag = m.group('tag').lower()
            if marker in m.group('text') and any((t is None or t == tag) and c <= classes for t, c in opts['_selectors']):
                problems.append(f'{page["file"]}: "{m.group("text").strip()[:50]}" has a {marker} reference '
                                f'but the page has no "{opts["urlField"]}" in site.json')
                break
    return problems
