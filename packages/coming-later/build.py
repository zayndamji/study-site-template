"""coming-later: render rows for pages that are not ready yet."""
from studylib.build import default_row


def configure(ctx, opts):
    if opts['inPicker']:
        ctx.config['nav']['showPlanned'] = True
    if opts['placement'] not in ('group', 'after'):
        ctx.warn('coming-later: option "placement" must be "group" or "after"; using "group"')
        opts['placement'] = 'group'


def _row(ctx, opts, page):
    label = page.get('statusLabel') or opts['label']
    html = default_row(ctx, page, extra_class='planned', state=f'<span class="later">{ctx.esc(label)}</span>')
    if not opts['searchable']:
        html = html.replace('<li data-search-row ', '<li data-search-row data-never-match ', 1)
    return html


def home_row(ctx, opts, page, row):
    if page['status'] not in opts['statuses']:
        return None
    if opts['placement'] == 'after':
        return ''  # drawn once, below the catalog (home_after)
    return _row(ctx, opts, page)


def home_after(ctx, opts):
    if opts['placement'] != 'after':
        return ''
    rows = [_row(ctx, opts, p) for p in ctx.pages if p['status'] in opts['statuses']]
    if not rows:
        return ''
    head = f'<h2 class="later-title">{ctx.esc(opts["afterTitle"])}</h2>' if opts['afterTitle'] else ''
    # a catalog group of its own, so search and filters hide it like any other group
    return (f'<section class="catalog-later" data-catalog-group="_later" aria-label="{ctx.esc(opts["label"])}">{head}'
            '<ol class="entries">' + ''.join(rows) + '</ol></section>')
