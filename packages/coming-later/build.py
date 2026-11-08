"""coming-later: render rows for pages that are not ready yet."""
from studylib.build import default_row


def configure(ctx, opts):
    if opts['inPicker']:
        ctx.config['nav']['showPlanned'] = True


def home_row(ctx, opts, page, row):
    if page['status'] not in opts['statuses']:
        return None
    label = page.get('statusLabel') or opts['label']
    html = default_row(ctx, page, extra_class='planned', state=f'<span class="later">{ctx.esc(label)}</span>')
    if not opts['searchable']:
        html = html.replace('<li data-search-row ', '<li data-search-row data-never-match ', 1)
    return html
