"""summaries: insert each page's sheet into the page and build the all-sheets page."""
from __future__ import annotations


def _kinds(ctx, opts):
    return opts['kinds'] or list(ctx.kinds)


def _sheet_path(ctx, opts, page):
    first = next(iter(ctx.kinds))
    tmpl = opts['source'] if page['kind'] == first else opts['otherSource']
    return ctx.content_dir / opts['dir'] / ctx.fmt(tmpl, id=page['id'], kind=page['kind'])


def _sheet(ctx, opts, page):
    if page['kind'] not in _kinds(ctx, opts):
        return None
    p = _sheet_path(ctx, opts, page)
    if not p.exists():
        return None
    return p.read_text(encoding='utf-8').strip()


def _anchor(ctx, opts, page):
    first = next(iter(ctx.kinds))
    tmpl = opts['anchor'] if page['kind'] == first else opts['otherAnchor']
    return ctx.fmt(tmpl, id=page['id'], kind=page['kind'])


def configure(ctx, opts):
    ctx._summaries = {}


def content(ctx, opts, page, html):
    sheet = _sheet(ctx, opts, page)
    if sheet is None:
        if opts['require'] and page['kind'] in _kinds(ctx, opts):
            ctx.warn(f'summaries: no sheet for {page["kind"]} {page["id"]} ({_sheet_path(ctx, opts, page).relative_to(ctx.site_dir)})')
        return html
    ctx._summaries[(page['kind'], page['id'])] = sheet
    back = ''
    if opts['page'] and opts['backLink']:
        back = f'<p class="sheet-back"><a href="{ctx.esc(opts["file"])}#{_anchor(ctx, opts, page)}">{ctx.esc(opts["backLink"])}</a></p>'
    review = '' if opts['reviewable'] else ' data-no-review'
    section = (f'<section class="note sheet-section" id="{ctx.esc(opts["sectionId"])}"{review}>\n'
               f'<h2><span class="n">{ctx.esc(opts["sectionNumber"])}</span> {ctx.esc(opts["sectionTitle"])}</h2>\n'
               f'<div class="sheet">\n{sheet}\n</div>\n{back}\n</section>\n')
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


def extra_pages(ctx, opts):
    if not opts['page']:
        return []
    sheets = getattr(ctx, '_summaries', {})
    blocks, used_groups = [], []
    for g in ctx.groups:
        members = [p for p in ctx.ready_pages() if p['group'] == g['id'] and (p['kind'], p['id']) in sheets]
        if not members:
            continue
        used_groups.append(g)
        for p in members:
            k = ctx.kinds[p['kind']]
            links = [f'<a href="{ctx.esc(p["href"])}">{ctx.esc(opts["notesLink"])}</a>']
            for extra in opts['extraLinks']:
                links.append(f'<a href="{ctx.esc(p["href"])}#{ctx.esc(extra.get("anchor", ""))}">{ctx.esc(extra.get("label", ""))}</a>')
            num = ctx.esc(p['id']) if k.get('numbered', True) else '·'
            blocks.append(
                f'<section class="note sheet-page-entry" id="{_anchor(ctx, opts, p)}" data-toc-group="{ctx.esc(g.get("title", g["id"]))}" '
                f'data-sheet-group="{ctx.esc(g["id"])}" data-no-review>\n'
                f'<h2><span class="n">{num}</span> {ctx.esc(p["title"])}</h2>\n'
                f'<p class="src sheet-links">{ctx.esc(k["noun"])} {ctx.esc(p["id"])} · {" · ".join(links)}</p>\n'
                f'<div class="sheet">\n{sheets[(p["kind"], p["id"])]}\n</div>\n</section>')
    tools = []
    if opts['filters'] and len(used_groups) > 1:
        b = [f'<button type="button" class="btn" data-sheet-filter="all" aria-pressed="true">{ctx.esc(opts["allLabel"])}</button>']
        b += [f'<button type="button" class="btn" data-sheet-filter="{ctx.esc(g["id"])}" aria-pressed="false">'
              f'{ctx.esc(g.get("filterLabel") or g.get("title", g["id"]))}</button>' for g in used_groups]
        tools.append('<div class="controls sheet-filters" role="group" aria-label="Filter sheets">' + ''.join(b) + '</div>')
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
