"""plot-2d build hooks: turn the colour options into CSS variables."""
import re

_SAFE = re.compile(r'^[\w\s.%#(),+\-/]*$')


def _clean(ctx, key, vals):
    if not isinstance(vals, list):
        ctx.warn(f'package "plot-2d": option "{key}" must be a list of CSS colours')
        return []
    out = []
    for i, v in enumerate(vals[:4]):
        s = str(v).strip()
        if s and _SAFE.match(s):
            out.append(s)
        else:
            ctx.warn(f'package "plot-2d": {key}[{i}] is not a plain CSS colour ({v!r}); ignored')
            out.append(None)
    if len(vals) > 4:
        ctx.warn(f'package "plot-2d": option "{key}" has more than four colours; only c1…c4 exist')
    return out


def configure(ctx, opts):
    opts['colors'] = _clean(ctx, 'colors', opts.get('colors') or [])
    opts['darkColors'] = _clean(ctx, 'darkColors', opts.get('darkColors') or [])


def _decls(vals):
    return '; '.join(f'--plot-c{i + 1}: {v}' for i, v in enumerate(vals) if v)


def head(ctx, opts, page):
    light, dark = _decls(opts.get('colors') or []), _decls(opts.get('darkColors') or [])
    css = []
    if light:
        css.append(f':root {{ {light}; }}')
    if dark:
        css.append(f'@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ {dark}; }} }}')
        css.append(f':root[data-theme="dark"] {{ {dark}; }}')
    return f'<style data-package="plot-2d">{" ".join(css)}</style>' if css else ''
