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


_NAME = re.compile(r'^[A-Za-z_][\w-]*$')
def _core_tokens():
    from studylib.common import CORE_DIR
    return set(re.findall(r'--([a-z][a-z0-9-]*)\s*:', (CORE_DIR / 'core.css').read_text(encoding='utf-8')))


def _color_names(ctx, raw):
    if not isinstance(raw, dict):
        ctx.warn('package "plot-2d": option "colorNames" must be an object like {"blue": 1}')
        return {}
    out, tokens = {}, _core_tokens()
    for name, v in raw.items():
        if not _NAME.match(str(name)):
            ctx.warn(f'package "plot-2d": colorNames key {name!r} is not a CSS class name; ignored')
            continue
        if isinstance(v, int) and 1 <= v <= 4:
            out[name] = f'var(--plot-c{v})'
        elif isinstance(v, str) and v in tokens:
            out[name] = f'var(--{v})'
        elif isinstance(v, str) and _SAFE.match(v):
            out[name] = v.strip()
        else:
            ctx.warn(f'package "plot-2d": colorNames[{name!r}] must be 1–4, a token name or a CSS colour; ignored')
    return out


def configure(ctx, opts):
    opts['colors'] = _clean(ctx, 'colors', opts.get('colors') or [])
    opts['colorNames'] = _color_names(ctx, opts.get('colorNames') or {})
    opts['darkColors'] = _clean(ctx, 'darkColors', opts.get('darkColors') or [])


def _decls(vals):
    return '; '.join(f'--plot-c{i + 1}: {v}' for i, v in enumerate(vals) if v)


def head(ctx, opts, page):
    light, dark = _decls(opts.get('colors') or []), _decls(opts.get('darkColors') or [])
    css = [f'svg.plane .{n} {{ --pc: {v}; }}' for n, v in (opts.get('colorNames') or {}).items()]
    if light:
        css.append(f':root {{ {light}; }}')
    if dark:
        css.append(f'@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ {dark}; }} }}')
        css.append(f':root[data-theme="dark"] {{ {dark}; }}')
    return f'<style data-package="plot-2d">{" ".join(css)}</style>' if css else ''
