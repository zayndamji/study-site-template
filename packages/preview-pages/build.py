"""preview-pages: flag ready pages that carry a "statusLabel" (drafts, pages written from early sources)."""
from studylib.build import default_row


def _flagged(page):
    return bool(page) and page.get('status') == 'ready' and bool(page.get('statusLabel'))


def home_row(ctx, opts, page, row):
    if not opts['flag'] or not _flagged(page):
        return None
    label = ctx.esc(page['statusLabel'])
    html = default_row(ctx, page, extra_class='provisional', flag=f' <span class="flag">{label}</span>')
    return html.replace(' data-search="', f' data-search="{label} ', 1)


def page_head(ctx, opts, page):
    if not _flagged(page):
        return ''
    msg = page.get('statusNote', opts['banner'])
    if not msg:
        return ''
    vals = {k: ctx.esc(str(v)) for k, v in ctx.page_vals(page).items() if v is not None}
    msg = ctx.fmt(msg, **dict(vals, label=ctx.esc(page['statusLabel'])))
    return f'<p class="preview-banner" role="note">{msg}</p>'
