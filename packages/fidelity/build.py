"""fidelity build hooks: fill empty marker labels in the HTML (so they also show without JS and in
print) and add the optional legend line at the top of unit pages."""
import re

_CLS = r'<(?P<tag>{tags})\b[^>]*\bclass="[^"]*(?<![\w-]){name}(?![\w-])[^"]*"[^>]*>'
BEYOND_RX = re.compile(_CLS.format(tags='span', name='beyond') + r'(?P<body>\s*)</span>', re.I)
BOX_RX = {name: re.compile(_CLS.format(tags='div|aside|section', name=name), re.I) for name in ('erratum', 'beyond-block')}
EMPTY_LBL_RX = re.compile(r'\s*<(span|div|p)\b[^>]*\bclass="lbl"[^>]*>\s*</\1>', re.I)
ANY_LBL_RX = re.compile(r'\s*<(span|div|p)\b[^>]*\bclass="lbl"', re.I)


def fill_labels(html, opts, esc):
    beyond = esc(opts.get('beyondLabel') or '')
    if beyond:
        html = BEYOND_RX.sub(lambda m: m.group(0)[:m.start('body') - m.start()] + beyond + '</span>', html)
    for name, key in (('erratum', 'erratumLabel'), ('beyond-block', 'beyondBlockLabel')):
        label = esc(opts.get(key) or '')
        if not label:
            continue
        out, pos = [], 0
        for m in BOX_RX[name].finditer(html):
            out.append(html[pos:m.end()])
            pos = m.end()
            e = EMPTY_LBL_RX.match(html, pos)
            if e:
                tag = e.group(1)
                out.append(f'<{tag} class="lbl">{label}</{tag}>')
                pos = e.end()
            elif not ANY_LBL_RX.match(html, pos):
                out.append(f'<span class="lbl">{label}</span>')
        out.append(html[pos:])
        html = ''.join(out)
    return html


def legend_html(ctx, opts):
    esc = ctx.esc
    samples = {
        'beyond': f'<span class="beyond">{esc(opts.get("beyondLabel") or "")}</span>',
        'erratum': f'<span class="fid-erratum-tag">{esc(opts.get("erratumLabel") or "")}</span>',
    }
    text = ctx.fmt(opts.get('legendText') or '', **samples)
    label = opts.get('legendLabel') or ''
    shown = f'<span class="fid-legend-lbl">{esc(label)}</span> ' if label and opts.get('legendShowLabel') else ''
    aria = f' aria-label="{esc(label)}"' if label else ''
    return f'<p class="fid-legend" role="note"{aria}>{shown}{text}</p>\n'


def content(ctx, opts, page, html):
    html = fill_labels(html, opts, ctx.esc)
    kinds = opts.get('legendKinds')
    if (opts.get('legend') and (page.get('meta') or {}).get('fidelityLegend', True) is not False
            and (kinds is None or page.get('kind') in kinds)):
        html = legend_html(ctx, opts) + html
    return html
