"""Build a site: site.json + content/ + packages -> a static folder (default dist/)."""
from __future__ import annotations

import hashlib
import json
import re
import shutil
from pathlib import Path

from .common import (CORE_DIR, StudyError, esc, fmt, load_config, log, normalize_kinds,
                     normalize_pages, parse_content, resolve_packages)

MARKER = '.study-build'
SEARCH_ICON = ('<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">'
               '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>')


class Ctx:
    """Everything a build hook can see. Passed as the first argument to every hook."""

    def __init__(self, site_dir: Path, strict=False):
        self.site_dir = site_dir.resolve()
        self.warnings, self.strict = [], strict
        self.config = load_config(self.site_dir)
        self.kinds = normalize_kinds(self.config)
        self.packages = resolve_packages(self.config, self.site_dir, self.warn)
        for p in self.packages:
            fn = p.hook('configure')
            if fn:
                fn(self, p.options)
        self.kinds = normalize_kinds(self.config)  # configure hooks may add kinds
        self.pages = normalize_pages(self.config, self.warn)
        self.groups = self._groups()
        b = self.config['build']
        self.out_dir = (self.site_dir / b['outDir']).resolve()
        self.content_dir = self.site_dir / b['contentDir']
        self.static_dir = self.site_dir / b['staticDir']
        self.outputs: dict[str, str] = {}
        self.asset_version = ''
        self.extra_assets: dict[str, bytes] = {}

    # ---- helpers for hooks ----
    esc = staticmethod(esc)
    fmt = staticmethod(fmt)

    def warn(self, msg):
        self.warnings.append(msg)
        log('warning: ' + msg)

    def option(self, pkg, key, default=None):
        for p in self.packages:
            if p.name == pkg:
                return p.options.get(key, default)
        return default

    def label(self, key):
        """A core reader-facing string from site.json "labels"."""
        return self.config.get('labels', {}).get(key, '')

    def has(self, pkg):
        return any(p.name == pkg for p in self.packages)

    def ready_pages(self, kind=None):
        return [p for p in self.pages if p['status'] == 'ready' and (kind is None or p['kind'] == kind)]

    def page_vals(self, page):
        k = self.kinds.get(page.get('kind'), {})
        same = self.ready_pages(page.get('kind'))
        pos = next((i + 1 for i, p in enumerate(same) if p is page), 0)
        last = same[-1]['id'] if same else ''
        pid = page.get('id', '')
        num = page.get('num')
        return dict(id=pid, badge=page.get('badge') or pid, num=pid if num is None else str(num),
                    title=page.get('title', ''), label=page.get('label', ''),
                    noun=page.get('noun') or k.get('noun', ''),
                    short=page.get('short') or page.get('noun') or k.get('short', ''),
                    plural=k.get('plural', ''),
                    kind=page.get('kind', ''), group=self.group_title(page.get('group')),
                    site=self.config['site']['title'], position=pos, count=len(same), last=last)

    def site_vals(self):
        """Fields every footer and the home intro may use: {site} {pages}, and per kind
        {<kind>Count} {<kind>First} {<kind>Last} (badges of the first and last ready page)."""
        v = {'site': self.config['site']['title'], 'pages': len(self.ready_pages())}
        for name in self.kinds:
            same = self.ready_pages(name)
            v[f'{name}Count'] = len(same)
            v[f'{name}First'] = same[0]['badge'] if same else ''
            v[f'{name}Last'] = same[-1]['badge'] if same else ''
        return v

    def group_title(self, gid):
        for g in self.groups:
            if g['id'] == gid:
                return g.get('title', gid)
        return gid or ''

    def read_content(self, rel):
        p = self.content_dir / rel
        if not p.exists():
            raise StudyError(f'missing content file {p.relative_to(self.site_dir)}')
        return parse_content(p.read_text(encoding='utf-8'), str(p.relative_to(self.site_dir)))

    def built_file(self, rel):
        """Path of a file in the built site: the output folder, or static/ when the build did not
        copy it (as during `study.py check`). The path may not exist."""
        p = self.out_dir / rel
        return p if p.exists() else self.static_dir / rel

    def asset(self, path):
        """URL for a bundled asset with the cache-busting stamp."""
        return path + ('?v=' + self.asset_version if self.asset_version else '')

    def call(self, hook, *args):
        out = []
        for p in self.packages:
            fn = p.hook(hook)
            if fn:
                r = fn(self, p.options, *args)
                if r:
                    out.append(r)
        return out

    def _groups(self):
        groups = [dict(g) for g in (self.config.get('groups') or [])]
        known = {g['id'] for g in groups}
        for p in self.pages:
            if not p['group']:
                p['group'] = '_' + p['kind']
            if p['group'] not in known:
                k = self.kinds[p['kind']]
                groups.append({'id': p['group'], 'title': k['plural'] if p['group'].startswith('_') else p['group']})
                known.add(p['group'])
        return groups

    # ---- the document shell, used for unit pages and for package-made pages ----
    def render_document(self, *, title, main, page=None, kind='', page_id='', unit='', review=False,
                        rail=True, rail_title='Sections', head='', body_class='', topbar_extra=None,
                        footer=None, description=None):
        site = self.config['site']
        head_bits = [
            '<meta charset="utf-8">',
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
            f'<title>{esc(title)}</title>',
        ]
        desc = description if description is not None else site.get('description')
        if desc:
            head_bits.append(f'<meta name="description" content="{esc(desc)}">')
        fav = site.get('favicon')
        if fav:
            href = 'assets/favicon.svg' if fav == 'auto' else fav
            head_bits.append(f'<link rel="icon" href="{esc(href)}">')
        fonts = self.config['theme']['fonts'].get('css') or []
        if isinstance(fonts, str):
            fonts = [fonts]
        if any('fonts.googleapis.com' in f for f in fonts):
            head_bits.append('<link rel="preconnect" href="https://fonts.googleapis.com">')
            head_bits.append('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>')
        head_bits += [f'<link rel="stylesheet" href="{esc(f)}">' for f in fonts]
        head_bits.append(f'<link rel="stylesheet" href="{self.asset("assets/study.css")}">')
        head_bits += self.call('head', page)
        if head:
            head_bits.append(head)
        head_bits.append(f'<script src="{self.asset("assets/study.js")}"></script>')

        attrs = [f'data-kind="{esc(kind)}"', f'data-page="{esc(page_id)}"']
        if unit:
            attrs.append(f'data-unit="{esc(unit)}"')
        if review:
            attrs.append('data-review')
        cls = ' '.join(c for c in [body_class, f'kind-{kind}' if kind else ''] if c)
        if cls:
            attrs.append(f'class="{esc(cls)}"')

        topbar = self.render_topbar(page, topbar_extra)
        if rail:
            body = (f'<div class="layout">\n<nav class="rail" aria-label="{esc(rail_title)}"><details>'
                    f'<summary>{esc(rail_title)}</summary><ol class="toc"></ol>'
                    '<div class="progress"><span class="txt"></span><div class="meter"><span></span></div></div>'
                    f'</details></nav>\n<article id="main">\n{main}\n</article>\n</div>')
        else:
            body = f'<div class="layout no-rail">\n<article id="main">\n{main}\n</article>\n</div>'
        foot = footer if footer is not None else fmt(site.get('footer'), **{k: esc(v) for k, v in self.site_vals().items()})
        return ('<!doctype html>\n'
                f'<html lang="{esc(site.get("lang", "en"))}">\n<head>\n' + '\n'.join(head_bits) + '\n</head>\n'
                f'<body {" ".join(attrs)}>\n<a class="skip-link" href="#main">{esc(self.label("skipLink"))}</a>\n'
                f'{topbar}\n{body}\n<footer class="page">{foot}</footer>\n</body>\n</html>\n')

    def render_brand(self):
        b = self.config['site']['brand']
        o = f'<span class="brace">{esc(b["open"])}</span> ' if b.get('open') else ''
        c = f' <span class="brace">{esc(b["close"])}</span>' if b.get('close') else ''
        return f'<a class="brand" href="index.html">{o}{esc(b["text"])}{c}</a>'

    def render_picker(self, page):
        nav = self.config['nav']
        if not nav.get('picker'):
            return ''
        opts = [f'<option value="index.html">{esc(nav.get("home") or "Home")}</option>']
        group = None
        order = {g['id']: i for i, g in enumerate(self.groups)}
        # options follow the group order, so a group never appears twice even when the page
        # (Prev/Next) order moves between groups
        for p in sorted(self.pages, key=lambda p: (order.get(p['group'], len(order)), p['index'])):
            k = self.kinds[p['kind']]
            if not k.get('inPicker', True):
                continue
            planned = p['status'] != 'ready'
            if planned and not nav.get('showPlanned'):
                continue
            g = self.group_title(p['group'])
            if g != group:
                if group is not None:
                    opts.append('</optgroup>')
                opts.append(f'<optgroup label="{esc(g)}">')
                group = g
            vals = self.page_vals(p)
            sel = ' selected' if page is p else ''
            dis = ' disabled' if planned else ''
            opts.append(f'<option value="{esc(p["href"])}"{sel}{dis}>{esc(fmt(nav["pickerOption"], **vals))}</option>')
        if group is not None:
            opts.append('</optgroup>')
        sw = esc(self.label('switchPage'))
        return (f'<label class="page-picker"><span class="sr-only">{sw}</span>'
                f'<select aria-label="{sw}">{"".join(opts)}</select></label>')

    def render_prevnext(self, page):
        nav = self.config['nav']
        if not page or not nav.get('prevNext') or not self.kinds[page['kind']].get('prevNext', True):
            return ''
        same = self.ready_pages(page['kind'])
        if page not in same:
            return ''
        i = same.index(page)
        out = []
        if i > 0:
            p = same[i - 1]
            v = self.page_vals(p)
            out.append(f'<a class="btn nav-btn nav-prev" rel="prev" href="{esc(p["href"])}" title="{esc(p["title"])}">'
                       f'<span class="short">{esc(fmt(nav["prevShort"], **v))}</span>'
                       f'<span class="long">{esc(fmt(nav["prevLong"], **v))}</span></a>')
        if i < len(same) - 1:
            p = same[i + 1]
            v = self.page_vals(p)
            out.append(f'<a class="btn nav-btn nav-next" rel="next" href="{esc(p["href"])}" title="{esc(p["title"])}">'
                       f'<span class="short">{esc(fmt(nav["nextShort"], **v))}</span>'
                       f'<span class="long">{esc(fmt(nav["nextLong"], **v))}</span></a>')
        return ''.join(out)

    def render_topbar(self, page, extra=None):
        bits = [self.render_brand(), self.render_picker(page), '<span class="spacer"></span>']
        bits += self.call('topbar', page)
        if extra:
            bits.append(extra)
        bits.append(self.render_prevnext(page))
        bits.append(f'<button class="btn theme-btn" type="button" data-theme-toggle>{esc(self.label("theme").strip(": ") or "Theme")}</button>')
        return '<header class="topbar">' + ''.join(b for b in bits if b) + '</header>'


# --------------------------------------------------------------------------- assets
def theme_css(cfg):
    t = cfg['theme']
    out = []
    f = t.get('fonts') or {}
    fonts = {k: f.get(k) for k in ('display', 'body', 'math', 'mono') if f.get(k)}
    tok = t.get('tokens') or {}
    root = dict(tok.get('all') or {})
    root.update({f'--f-{k}': v for k, v in fonts.items()})
    root.update(tok.get('light') or {})

    def decls(d):
        return '; '.join(f'{k if k.startswith("--") else "--" + k}: {v}' for k, v in d.items())

    if root:
        out.append(f':root {{ {decls(root)}; }}')
    dark = tok.get('dark') or {}
    if dark:
        out.append(f'@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ {decls(dark)}; }} }}')
        out.append(f':root[data-theme="dark"] {{ {decls(dark)}; }}')
    cols = cfg['home'].get('columns')
    if cols:
        out.append(f'.catalog {{ --home-columns: {int(cols)}; }}')
    widths = cfg['home'].get('columnWidths')
    if widths:
        if not re.match(r'^[\w\s.%()+,-]+$', str(widths)):
            raise StudyError(f'home.columnWidths is not a plain CSS grid value: {widths!r}')
        # wide screens only: narrower screens keep the responsive 2- and 1-column layouts
        out.append(f'@media (min-width: 761px) {{ .catalog {{ grid-template-columns: {widths}; }} }}')
    return '\n'.join(out)


def favicon_svg(cfg):
    b = cfg['site']['brand']
    light = (cfg['theme'].get('tokens') or {}).get('light', {})
    color = light.get('--term') or light.get('term') or '#2348c9'
    glyph = esc((b.get('open') or '') + (b.get('close') or '')) or esc((b.get('text') or 'S')[:1])
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
            f'<rect width="64" height="64" rx="14" fill="{esc(color)}"/>'
            '<text x="32" y="43" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="#fff">'
            f'{glyph}</text></svg>\n')


def browser_options(pkg):
    """Options shipped to the browser: everything except options marked "private": true."""
    declared = pkg.meta['options']
    hidden = {k for k, v in declared.items() if isinstance(v, dict) and v.get('private')}
    return {k: v for k, v in pkg.options.items() if k in declared and k not in hidden}


def bundle(ctx: Ctx):
    cfg = ctx.config
    css = [f'/* core */\n' + (CORE_DIR / 'core.css').read_text(encoding='utf-8')]
    tcss = theme_css(cfg)
    if tcss:
        css.append('/* theme (site.json) */\n' + tcss)
    data = {
        'config': {
            'siteTitle': cfg['site']['title'],
            'storagePrefix': cfg['site']['storagePrefix'],
            'defaultTheme': cfg['site'].get('defaultTheme', 'system'),
            'labels': cfg.get('labels', {}),
            'kinds': {n: {k: v for k, v in kd.items() if k in ('noun', 'plural', 'short', 'review')}
                      for n, kd in ctx.kinds.items()},
        },
        'pages': [{k: p.get(k) for k in ('id', 'kind', 'title', 'label', 'description', 'group', 'status',
                                          'href', 'storageKey', 'num', 'badge')} for p in ctx.pages],
        'groups': [{'id': g['id'], 'title': g.get('title', g['id'])} for g in ctx.groups],
        'packages': {p.name: browser_options(p) for p in ctx.packages if p.meta['js']},
    }
    js = ['/* site data (generated by the build) */\nwindow.STUDY_DATA = ' +
          json.dumps(data, ensure_ascii=False, indent=None, separators=(',', ':')) + ';\n',
          '/* core */\n' + (CORE_DIR / 'core.js').read_text(encoding='utf-8')]
    for p in ctx.packages:
        for f in p.meta['css']:
            css.append(f'/* package: {p.name} ({f}) */\n' + (p.path / f).read_text(encoding='utf-8'))
        for f in p.meta['js']:
            js.append(f'/* package: {p.name} ({f}) */\n' + (p.path / f).read_text(encoding='utf-8'))
    extra_css = list(cfg['build'].get('css') or [])
    extra_js = list(cfg['build'].get('js') or [])
    for default, lst in (('custom/site.css', extra_css), ('custom/site.js', extra_js)):
        if default not in lst and (ctx.site_dir / default).exists():
            lst.append(default)
    for f in extra_css:
        css.append(f'/* site: {f} */\n' + (ctx.site_dir / f).read_text(encoding='utf-8'))
    for f in extra_js:
        js.append(f'/* site: {f} */\n' + (ctx.site_dir / f).read_text(encoding='utf-8'))
    css_s, js_s = '\n'.join(css), '\n'.join(js)
    if cfg['build'].get('cacheBust', True):
        ctx.asset_version = hashlib.sha256((css_s + js_s).encode()).hexdigest()[:10]
    ctx.extra_assets['assets/study.css'] = css_s.encode()
    ctx.extra_assets['assets/study.js'] = js_s.encode()
    if cfg['site'].get('favicon') == 'auto':
        ctx.extra_assets['assets/favicon.svg'] = favicon_svg(cfg).encode()


# --------------------------------------------------------------------------- pages
def render_unit(ctx: Ctx, page):
    meta, body, styles = ctx.read_content(page['source'])
    page['meta'] = meta
    k = ctx.kinds[page['kind']]
    vals = ctx.page_vals(page)
    for p in ctx.packages:
        fn = p.hook('content')
        if fn:
            body = fn(ctx, p.options, page, body) or body
    eyebrow = meta.get('eyebrow', fmt(k.get('eyebrow'), **vals))
    title = meta.get('title', page['title'])
    lede = meta.get('lede', page.get('lede', ''))
    headbits = [f'<header class="page-head">']
    if eyebrow:
        headbits.append(f'<p class="eyebrow">{eyebrow}</p>')
    headbits.append(f'<h1>{title}</h1>')
    if lede:
        headbits.append(f'<p class="lede">{lede}</p>')
    headbits += ctx.call('page_head', page)
    headbits.append('</header>')
    head = '\n'.join(styles)
    for s in meta.get('styles', []):
        head += f'\n<link rel="stylesheet" href="{esc(s)}">'
    scripts = ''.join(f'\n<script src="{esc(s)}"></script>' for s in meta.get('scripts', []))
    main = '\n'.join(headbits) + '\n' + body + scripts
    doc_title = meta.get('docTitle') or fmt(ctx.config['site'].get('titleFormat'), **dict(vals, title=page['title']))
    footer = fmt(meta.get('footer', ctx.config['site'].get('pageFooter')),
                 **{k: esc(v) for k, v in dict(ctx.site_vals(), **vals).items()})
    return ctx.render_document(
        title=doc_title, main=main, page=page, kind=page['kind'], page_id=page['id'],
        unit=page['storageKey'], review=bool(k.get('review')) and meta.get('review', True),
        rail=meta.get('rail', True) is not False, rail_title=meta.get('railTitle', k.get('rail', 'Sections')),
        head=head, footer=footer, description=page.get('description') or None,
        body_class=meta.get('bodyClass', ''))


def render_home(ctx: Ctx):
    cfg, home = ctx.config, ctx.config['home']
    intro = home.get('intro') or {}
    intro_bits = []
    sv = ctx.site_vals()
    if intro.get('eyebrow'):
        intro_bits.append(f'<p class="eyebrow">{fmt(intro["eyebrow"], **sv)}</p>')
    if intro.get('tagline'):
        intro_bits.append(f'<p class="tagline">{fmt(intro["tagline"], **sv)}</p>')
    intro_bits += ctx.call('home_intro')
    tools = []
    if home.get('search', True):
        tools.append(f'<label class="search">{SEARCH_ICON}<input type="search" id="catalog-search" '
                     f'placeholder="{esc(home.get("searchPlaceholder"))}" aria-label="{esc(ctx.label("searchLabel"))}" autocomplete="off">'
                     f'<kbd aria-hidden="true" title="{esc(ctx.label("searchKeyHint"))}">/</kbd></label>')
    sections, rendered, rendered_kinds = [], set(), set()
    for gi, g in enumerate(ctx.groups):
        rows, shown = [], []
        members = [p for p in ctx.pages if p['group'] == g['id']]
        for p in members:
            row = None
            if p['status'] == 'ready':
                row = default_row(ctx, p)
            for pk in ctx.packages:
                fn = pk.hook('home_row')
                if fn:
                    r = fn(ctx, pk.options, p, row)
                    if r is not None:
                        row = r
            if row:
                rows.append(row)
                shown.append(p)
        if not rows:
            continue
        rendered.add(g['id'])
        rendered_kinds.update(p['kind'] for p in members)
        heading = []
        # the range covers the rows drawn in this group (ready pages, plus planned ones a package shows here)
        nums = [p['badge'] for p in shown if p['num'] is not None]
        if home.get('showRange') and len(nums) > 1 and g.get('range') is not False:
            heading.append(f'<span class="range">{esc(g.get("range") or nums[0] + "–" + nums[-1])}</span>')
        elif g.get('range'):
            heading.append(f'<span class="range">{esc(g["range"])}</span>')
        if g.get('note'):
            heading.append(f'<span class="note">{g["note"]}</span>')
        heading.append(f'<h2 id="group-{gi}">{esc(g.get("title", g["id"]))}</h2>')
        sections.append(f'<section class="catalog-group" data-catalog-group="{esc(g["id"])}" aria-labelledby="group-{gi}">'
                        f'<div class="group-heading">{"".join(heading)}</div>\n<ol class="entries">\n' +
                        '\n'.join(rows) + '\n</ol></section>')
    filters = home.get('filters', 'auto')
    buttons = []
    if filters == 'auto':
        filters = 'groups' if len(ctx.groups) > 1 else 'none'
    if filters == 'groups':
        buttons = [(g['id'], g.get('filterLabel') or g.get('title', g['id'])) for g in ctx.groups
                   if g['id'] in rendered]
    elif filters == 'kinds':
        buttons = [(n, k['plural']) for n, k in ctx.kinds.items() if n in rendered_kinds]
    if len(buttons) > 1:
        b = [f'<button type="button" data-filter="all" aria-pressed="true">{esc(home.get("allLabel"))}</button>']
        b += [f'<button type="button" data-filter="{esc(i)}" aria-pressed="false">{esc(t)}</button>' for i, t in buttons]
        tools.append(f'<nav class="group-filters" aria-label="{esc(ctx.label("filterLabel"))}">' + ''.join(b) + '</nav>')

    tools += ctx.call('home_tools')
    main = (f'<h1 class="sr-only">{esc(cfg["site"]["title"])}</h1>\n'
            f'<div class="home-intro">{"".join(intro_bits)}</div>\n'
            f'<div class="catalog-tools">{"".join(tools)}</div>\n'
            '<p class="sr-only" id="search-status" role="status" aria-live="polite"></p>\n'
            '<div class="catalog">\n' + '\n'.join(sections) + '\n</div>\n'
            f'<div id="empty-state" class="empty-state" hidden><p>{esc(home.get("emptyText"))}</p>'
            f'<button class="btn" type="button" id="clear-search">{esc(ctx.label("showEverything"))}</button></div>')
    main += ''.join(ctx.call('home_after'))
    after = home.get('after') or ''
    if home.get('afterFile'):
        _, after_html, after_styles = ctx.read_content(home['afterFile'])
        after = '\n'.join(after_styles) + after_html + after
    if after:
        main += f'\n<div class="home-after">{fmt(after, **sv)}</div>'
    doc = ctx.render_document(title=cfg['site']['title'], main=main, kind='home', rail=False, body_class='home')
    # the home page uses a full-width main instead of the reading column
    doc = doc.replace('<div class="layout no-rail">\n<article id="main">', '<main class="home-main" id="main">', 1)
    doc = doc.replace('</article>\n</div>\n<footer', '</main>\n<footer', 1)
    return doc


def default_row(ctx: Ctx, p, extra_class='', state='', flag=''):
    """A home catalog row. `state` fills the line under the title (home-progress replaces it once the
    page has been opened); `flag` is HTML placed right after the title and is never replaced."""
    k = ctx.kinds[p['kind']]
    search = ' '.join(str(x) for x in (p['id'], p['badge'] if p['badge'] != p['id'] else '', p['title'], p['label'], p['description'], p['keywords'],
                                        ctx.group_title(p['group']), p.get('noun') or k['noun']) if x)
    num = esc(p['badge']) if k.get('numbered', True) else ''
    title_attr = f' title="{esc((p.get("noun") or k["noun"]) + " " + p["badge"] + ": " + p["title"])}"' if p['label'] != p['title'] else ''
    href = f' href="{esc(p["href"])}"' if p['status'] == 'ready' else ''
    tag = 'a' if href else 'div'
    return (f'<li data-search-row data-kind="{esc(p["kind"])}" data-group="{esc(p["group"])}" '
            f'data-num="{"" if p["num"] is None else p["num"]}" data-unit="{esc(p["storageKey"])}" data-search="{esc(search)}">'
            f'<{tag} class="entry {extra_class}"{href}{title_attr}><span class="num">{num}</span>'
            f'<span class="ttl">{esc(p["label"])}{flag}</span><span class="arrow" aria-hidden="true">↗</span>'
            f'<span class="state">{state}</span><span class="sub">{esc(p["description"])}</span></{tag}></li>')


# --------------------------------------------------------------------------- driver
def _write_if_changed(path: Path, data: bytes):
    if path.exists() and path.stat().st_size == len(data) and path.read_bytes() == data:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def write_outputs(ctx: Ctx, force=False, copy_static=True):
    """Write the build into ctx.out_dir.

    The folder is synced, not wiped: static files are copied only when their size or
    modification time changed (so a large static/ folder costs nothing on a rebuild),
    generated files are rewritten only when their content changed, and files that no
    longer belong to the build are removed.
    """
    out = ctx.out_dir
    if out == ctx.site_dir or ctx.site_dir.is_relative_to(out):
        raise StudyError('build.outDir must be a subfolder of the site, not the site itself')
    if out.exists() and any(out.iterdir()) and not (out / MARKER).exists() and not force:
        raise StudyError(f'{out} exists and was not made by this tool; pass --force to overwrite it')
    out.mkdir(parents=True, exist_ok=True)
    keep = {MARKER}
    if copy_static and ctx.static_dir.exists():
        for src in ctx.static_dir.rglob('*'):
            if src.is_dir() or src.name == '.DS_Store':
                continue
            rel = src.relative_to(ctx.static_dir).as_posix()
            keep.add(rel)
            dst = out / rel
            st = src.stat()
            if dst.exists():
                dt = dst.stat()
                if dt.st_size == st.st_size and int(dt.st_mtime) == int(st.st_mtime):
                    continue
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
    for rel, data in ctx.extra_assets.items():
        keep.add(rel)
        _write_if_changed(out / rel, data)
    for rel, text in ctx.outputs.items():
        keep.add(rel)
        _write_if_changed(out / rel, text.encode('utf-8'))
    for f in sorted(out.rglob('*'), reverse=True):
        rel = f.relative_to(out).as_posix()
        if f.is_dir():
            if not any(f.iterdir()):
                f.rmdir()
        elif rel not in keep:
            f.unlink()
    (out / MARKER).write_text('Generated by study-site-template. Do not edit files here; edit the site sources and rebuild.\n')


def build(site_dir: Path, force=False, quiet=False, out_dir=None, copy_static=True) -> Ctx:
    """Build site_dir. out_dir overrides build.outDir; copy_static=False leaves static/ out
    (the checker uses that and looks static files up in the site instead)."""
    ctx = Ctx(site_dir)
    if out_dir is not None:
        ctx.out_dir = Path(out_dir).resolve()
    bundle(ctx)
    for p in ctx.ready_pages():
        ctx.outputs[p['file']] = render_unit(ctx, p)
    ctx.outputs['index.html'] = render_home(ctx)
    for pages in ctx.call('extra_pages'):
        for rel, text in pages:
            ctx.outputs[rel] = text
    for p in ctx.packages:
        fn = p.hook('finalize')
        if fn:
            fn(ctx, p.options, ctx.outputs)
    write_outputs(ctx, force=force, copy_static=copy_static)
    if not quiet:
        log(f'built {len(ctx.outputs)} pages with {len(ctx.packages)} packages -> {ctx.out_dir}')
    return ctx
