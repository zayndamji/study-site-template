"""one-minute: build the opener from the page's front matter ("overview": [..bullets..])."""


def content(ctx, opts, page, html):
    meta = page.get('meta') or {}
    bullets = meta.get('overview')
    if not bullets or (opts['kinds'] and page['kind'] not in opts['kinds']):
        return html
    if isinstance(bullets, str):
        bullets = [bullets]
    if opts['maxBullets'] and len(bullets) > opts['maxBullets']:
        ctx.warn(f'one-minute: {page["kind"]} {page["id"]} has {len(bullets)} bullets (max {opts["maxBullets"]})')
    vals = ctx.page_vals(page)
    vals['noun_lower'] = vals['noun'].lower()
    title = ctx.fmt(meta.get('overviewTitle', opts['title']), **vals)
    num = f'<span class="n">{ctx.esc(opts["number"])}</span> ' if opts['number'] else ''
    review = '' if opts['reviewable'] else ' data-no-review'
    items = ''.join(f'<li>{b}</li>' for b in bullets)
    section = (f'<section class="note one-minute" id="{ctx.esc(opts["id"])}"{review}>\n'
               f'<h2>{num}{ctx.esc(title)}</h2>\n<ul class="om-list">{items}</ul>\n</section>\n')
    return section + html
