"""resources: register extra page kinds."""


def configure(ctx, opts):
    kinds = ctx.config.setdefault('kinds', {})
    for name, k in (opts['kinds'] or {}).items():
        if name not in kinds:
            kinds[name] = dict(k)
    if opts['homeFilter'] and ctx.config['home'].get('filters') == 'auto':
        ctx.config['home']['filters'] = 'kinds'
    ctx._resource_kinds = set((opts['kinds'] or {}).keys())


def content(ctx, opts, page, html):
    if page['kind'] in getattr(ctx, '_resource_kinds', ()) and 'docTitle' not in page.get('meta', {}):
        page['meta']['docTitle'] = ctx.fmt(opts['titleFormat'], **ctx.page_vals(page))
    return html
