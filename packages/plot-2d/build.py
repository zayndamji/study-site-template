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
        # (stroke colour, text colour or None for "same as the stroke")
        if isinstance(v, int) and 1 <= v <= 4:
            out[name] = (f'var(--plot-c{v})', 'var(--plot-c4-ink)' if v == 4 else None)
        elif isinstance(v, str) and v in tokens:
            ink = v[:-5] + '-ink' if v.endswith('-edge') and v[:-5] + '-ink' in tokens else None
            out[name] = (f'var(--{v})', f'var(--{ink})' if ink else None)
        elif isinstance(v, str) and _SAFE.match(v):
            out[name] = (v.strip(), None)
        else:
            ctx.warn(f'package "plot-2d": colorNames[{name!r}] must be 1–4, a token name or a CSS colour; ignored')
    return out


# classes markNames may build on: each one's own rule in plot-2d.css ("svg.plane .<class> { … }")
_MARKS = ('fill', 'outline', 'thin', 'dash', 'faint', 'region', 'hollow', 'rod', 'pin')


def _mark_rules():
    from pathlib import Path
    css = re.sub(r'/\*.*?\*/', '', (Path(__file__).with_name('plot-2d.css')).read_text(encoding='utf-8'), flags=re.S)
    rules = {}
    for sel, body in re.findall(r'([^{}]+)\{([^{}]*)\}', css):
        for one in (x.strip() for x in sel.split(',')):
            m = re.fullmatch(r'svg\.plane \.([\w-]+)', one)
            if m and m.group(1) in _MARKS:
                rules[m.group(1)] = rules.get(m.group(1), '') + body.strip().rstrip(';') + '; '
    return rules


def _mark_names(ctx, raw):
    if not isinstance(raw, dict):
        ctx.warn('package "plot-2d": option "markNames" must be an object like {"swept": "region"}')
        return {}
    rules, out = _mark_rules(), {}
    for name, v in raw.items():
        if not _NAME.match(str(name)):
            ctx.warn(f'package "plot-2d": markNames key {name!r} is not a CSS class name; ignored')
            continue
        parts = str(v).split()
        bad = [x for x in parts if x not in rules]
        if bad or not parts:
            ctx.warn(f'package "plot-2d": markNames[{name!r}] may only list {", ".join(_MARKS)}; got {v!r}')
            parts = [x for x in parts if x in rules]
        if parts:
            out[name] = ''.join(rules[x] for x in parts).strip()
    return out


def configure(ctx, opts):
    opts['markNames'] = _mark_names(ctx, opts.get('markNames') or {})
    opts['colors'] = _clean(ctx, 'colors', opts.get('colors') or [])
    opts['colorNames'] = _color_names(ctx, opts.get('colorNames') or {})
    opts['darkColors'] = _clean(ctx, 'darkColors', opts.get('darkColors') or [])


def _decls(vals):
    # a site's own c4 is also its c4 text colour (the default amber has a darker --warn-ink)
    out = [f'--plot-c{i + 1}: {v}' for i, v in enumerate(vals) if v]
    if len(vals) > 3 and vals[3]:
        out.append(f'--plot-c4-ink: {vals[3]}')
    return '; '.join(out)


def head(ctx, opts, page):
    light, dark = _decls(opts.get('colors') or []), _decls(opts.get('darkColors') or [])
    # shapes first, colours after them, each in the order given (so a modifier listed later wins)
    css = [f'svg.plane .{n} {{ {d} }}' for n, d in (opts.get('markNames') or {}).items()]
    css += [f'svg.plane .{n} {{ --pc: {v}; --pt: {t or "initial"}; }}'
            for n, (v, t) in (opts.get('colorNames') or {}).items()]
    if light:
        css.append(f':root {{ {light}; }}')
    if dark:
        css.append(f'@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ {dark}; }} }}')
        css.append(f':root[data-theme="dark"] {{ {dark}; }}')
    return f'<style data-package="plot-2d">{" ".join(css)}</style>' if css else ''
