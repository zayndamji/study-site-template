"""summaries: insert each page's sheet into the page and build the all-sheets page."""
from __future__ import annotations

import re


def _kinds(ctx, opts):
    return opts['kinds'] or list(ctx.kinds)


def _sheet_path(ctx, opts, page):
    first = next(iter(ctx.kinds))
    tmpl = opts['source'] if page['kind'] == first else opts['otherSource']
    return ctx.content_dir / opts['dir'] / ctx.fmt(tmpl, id=page['id'], kind=page['kind'])


def _sheet(ctx, opts, page):
    """(source, body) of a page's sheet, or None. source is the text of an optional first-line
    comment `<!-- <sourceComment>: … -->` (HTML allowed), '' when there is none."""
    if page['kind'] not in _kinds(ctx, opts):
        return None
    p = _sheet_path(ctx, opts, page)
    if not p.exists():
        return None
    text = p.read_text(encoding='utf-8').strip()
    key = opts.get('sourceComment')
    if key:
        m = re.match(r'<!--\s*' + re.escape(key) + r'\s*:\s*(.*?)\s*-->\s*', text, re.S)
        if m:
            return m.group(1), text[m.end():].strip()
    return '', text


def _vals(ctx, opts, page, source):
    v = ctx.page_vals(page)
    v['nounLower'] = v['noun'].lower()
    v['source'] = source
    v['sourceSep'] = (opts.get('sourceSeparator') or '') + source if source else ''
    return v


_N_RX = re.compile(r'<span class="n">\s*([^<]*?)\s*</span>')


def _auto_number(html, marker):
    """The number after the last numbered section heading before the marker (or in the page)."""
    head = html.split(marker, 1)[0] if marker and marker in html else html
    nums = [n for n in _N_RX.findall(head) if n.isdigit()]
    if not nums:
        return '∗'
    last = nums[-1]
    return str(int(last) + 1).zfill(len(last))


def _anchor(ctx, opts, page):
    first = next(iter(ctx.kinds))
    tmpl = opts['anchor'] if page['kind'] == first else opts['otherAnchor']
    return ctx.fmt(tmpl, id=page['id'], kind=page['kind'])


def configure(ctx, opts):
    ctx._summaries = {}


def _sheet_class(opts):
    return 'sheet' if opts.get('boxed', True) else 'sheet plain'


def content(ctx, opts, page, html):
    found = _sheet(ctx, opts, page)
    if found is None:
        if opts['require'] and page['kind'] in _kinds(ctx, opts):
            ctx.warn(f'summaries: no sheet for {page["kind"]} {page["id"]} ({_sheet_path(ctx, opts, page).relative_to(ctx.site_dir)})')
        return html
    source, sheet = found
    ctx._summaries[(page['kind'], page['id'])] = (source, sheet)
    vals = _vals(ctx, opts, page, source)
    back_link = ''
    if opts['page'] and opts['backLink']:
        back_link = f'<a href="{ctx.esc(opts["file"])}#{_anchor(ctx, opts, page)}">{ctx.esc(opts["backLink"])}</a>'
    src = ctx.fmt(opts.get('sectionSource') or '', **vals)
    back = ''
    if back_link and opts.get('backLinkPlacement') == 'source':
        src = f'{src}{opts.get("sourceSeparator") or ""}{back_link}' if src else back_link
    elif back_link:
        back = f'<p class="sheet-back">{back_link}</p>'
    src_line = f'<p class="src sheet-source">{src}</p>\n' if src else ''
    review = '' if opts['reviewable'] else ' data-no-review'
    meta = page.get('meta') or {}
    number = meta.get('summaryNumber') or opts['sectionNumber']
    if number == 'auto':
        number = _auto_number(html, opts['marker'])
    section = (f'<section class="note sheet-section" id="{ctx.esc(opts["sectionId"])}"{review}>\n'
               f'<h2><span class="n">{ctx.esc(number)}</span> {ctx.esc(opts["sectionTitle"])}</h2>\n'
               f'{src_line}<div class="{_sheet_class(opts)}">\n{sheet}\n</div>\n{back}\n</section>\n')
    if opts['marker'] and opts['marker'] in html:
        return html.replace(opts['marker'], section, 1)
    return html + section


def home_intro(ctx, opts):
    if opts['page'] and opts['homeLink']:
        return f'<a class="home-extra sheet-home-link" href="{ctx.esc(opts["file"])}">{ctx.esc(opts["homeLink"])}</a>'
    return ''


def topbar(ctx, opts, page):
    if opts['page'] and opts['topbarLink']:
        return f'<a class="btn sheet-topbar-link" href="{ctx.esc(opts["file"])}">{ctx.esc(opts["topbarLink"])}</a>'
    return ''


def _range(badges):
    return badges[0] if len(badges) == 1 else f'{badges[0]}–{badges[-1]}' if badges else ''


def extra_pages(ctx, opts):
    if not opts['page']:
        return []
    sheets = getattr(ctx, '_summaries', {})
    blocks, used_groups = [], []
    for g in ctx.groups:
        members = [p for p in ctx.ready_pages() if p['group'] == g['id'] and (p['kind'], p['id']) in sheets]
        if not members:
            continue
        g = dict(g, _range=g.get('range') or _range([p['badge'] for p in members]))
        used_groups.append(g)
        gid = ctx.esc(g['id'])
        if opts.get('groupHeadings'):
            note = g.get('sheetNote', g.get('note'))
            blocks.append(f'<div class="sheet-group-head" data-sheet-group="{gid}"><h2>{ctx.esc(g.get("title", g["id"]))}</h2>'
                          + (f'<span class="note">{note}</span>' if note else '') + '</div>')
        for p in members:
            source, body = sheets[(p['kind'], p['id'])]
            vals = _vals(ctx, opts, p, source)
            k = ctx.kinds[p['kind']]
            links = [f'<a href="{ctx.esc(p["href"])}">{ctx.esc(opts["notesLink"])}</a>']
            for extra in opts['extraLinks']:
                links.append(f'<a href="{ctx.esc(p["href"])}#{ctx.esc(extra.get("anchor", ""))}">{ctx.esc(extra.get("label", ""))}</a>')
            num = ctx.esc(p['badge']) if k.get('numbered', True) else '·'
            src = ctx.fmt(opts.get('entrySource') or '', **vals)
            sep = opts.get('sourceSeparator') or ''
            src_line = sep.join(x for x in [src, sep.join(links)] if x)
            blocks.append(
                f'<section class="note sheet-page-entry" id="{_anchor(ctx, opts, p)}" data-toc-group="{ctx.esc(g.get("title", g["id"]))}" '
                f'data-sheet-group="{gid}" data-sheet-kind="{ctx.esc(p["kind"])}" data-sv-page="{ctx.esc(p["id"])}" data-no-review>\n'
                f'<h2><span class="n">{num}</span> {ctx.esc(p["title"])}</h2>\n'
                f'<p class="src sheet-links">{src_line}</p>\n'
                f'<div class="{_sheet_class(opts)}">\n{body}\n</div>\n</section>')
    tools = []
    sets = []
    for fs in opts.get('filterSets') or []:
        members = [g['id'] for g in used_groups if g['id'] in (fs.get('groups') or [])]
        if fs.get('id') and members:
            sets.append((fs, members))
    if opts['filters'] and (len(used_groups) > 1 or sets):
        b = [f'<button type="button" class="btn" data-sheet-filter="all" aria-pressed="true">{ctx.esc(opts["allLabel"])}</button>']
        b += [f'<button type="button" class="btn sheet-set" data-sheet-filter="set:{ctx.esc(fs["id"])}" '
              f'data-sheet-groups="{ctx.esc(" ".join(m))}" aria-pressed="false">{ctx.esc(fs.get("label") or fs["id"])}</button>'
              for fs, m in sets]
        if len(used_groups) > 1:
            b += [f'<button type="button" class="btn" data-sheet-filter="{ctx.esc(g["id"])}" aria-pressed="false">'
                  f'{ctx.esc(ctx.fmt(g.get("filterLabel") or opts.get("groupFilterLabel") or "{title}", title=g.get("title", g["id"]), range=g["_range"]))}</button>'
                  for g in used_groups]
        tools.append(f'<div class="controls sheet-filters" role="group" aria-label="{ctx.esc(opts.get("filterAria") or "Filter sheets")}">' + ''.join(b) + '</div>')
    main = (f'<header class="page-head"><p class="eyebrow">{ctx.esc(opts["eyebrow"])}</p><h1>{ctx.esc(opts["title"])}</h1>'
            + (f'<p class="lede">{opts["intro"]}</p>' if opts['intro'] else '') + '</header>\n'
            + ''.join(tools) + '\n' + '\n'.join(blocks))
    if not blocks:
        main += '<p class="aside">No summary sheets yet.</p>'
    extra = (f'<button class="btn" type="button" data-print>{ctx.esc(opts["printLabel"])}</button>' if opts['printLabel'] else '')
    doc = ctx.render_document(title=f'{opts["title"]} — {ctx.config["site"]["title"]}', main=main,
                              kind='summaries', page_id='summaries', rail=True, rail_title=opts['railTitle'],
                              topbar_extra=extra, body_class='sheets-page')
    return [(opts['file'], doc)]


def check(ctx, opts, outputs):
    problems = []
    d = ctx.content_dir / opts['dir']
    if d.exists():
        known = {_sheet_path(ctx, opts, p).name for p in ctx.pages}
        for f in sorted(d.glob('*.html')):
            if f.name not in known:
                problems.append(f'summaries: {f.relative_to(ctx.site_dir)} does not match any page')
    return problems
