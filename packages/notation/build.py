"""notation build hooks: turn the `tags` option into colour classes (light, dark and print)."""
import re

_NAME = re.compile(r'^[A-Za-z_][\w-]*$')
_SAFE = re.compile(r'^[\w\s.%#(),+\-/]*$')
_FONTS = ('body', 'display', 'math', 'mono')


def _core_tokens():
    from studylib.common import CORE_DIR
    return set(re.findall(r'--([a-z][a-z0-9-]*)\s*:', (CORE_DIR / 'core.css').read_text(encoding='utf-8')))


def _colour(v, tokens):
    """A token name → var(--token); a plain CSS colour as written; anything else → None."""
    if not isinstance(v, str) or not v.strip():
        return None
    v = v.strip()
    if v in tokens:
        return f'var(--{v})'
    return v if _SAFE.match(v) else None


def configure(ctx, opts):
    raw = opts.get('tags') or {}
    if not isinstance(raw, dict):
        ctx.warn('notation: option "tags" must be an object like {"noun": {"light": "#1f45c4", "dark": "#93acff"}}')
        raw = {}
    tokens = _core_tokens()
    out = {}
    for name, spec in raw.items():
        if not _NAME.match(str(name)):
            ctx.warn(f'notation: tag name {name!r} is not a CSS class name; ignored')
            continue
        if isinstance(spec, str):
            spec = {'light': spec}
        if not isinstance(spec, dict):
            ctx.warn(f'notation: tags[{name!r}] must be a colour or {{"light": …, "dark": …}}; ignored')
            continue
        light = _colour(spec.get('light'), tokens)
        dark = _colour(spec.get('dark'), tokens) or light
        if not light:
            ctx.warn(f'notation: tags[{name!r}] has no usable "light" colour; ignored')
            continue
        var = spec.get('var') or f'nt-{name}'
        if not _NAME.match(str(var)):
            ctx.warn(f'notation: tags[{name!r}].var {var!r} is not a CSS variable name; using nt-{name}')
            var = f'nt-{name}'
        font = spec.get('font')
        if font is not None and font not in _FONTS:
            ctx.warn(f'notation: tags[{name!r}].font must be one of {", ".join(_FONTS)}; ignored')
            font = None
        style = spec.get('style')
        if style is not None and style not in ('normal', 'italic'):
            ctx.warn(f'notation: tags[{name!r}].style must be "normal" or "italic"; ignored')
            style = None
        out[name] = {'light': light, 'dark': dark, 'var': var, 'weight': spec.get('weight'), 'font': font, 'style': style}
    opts['tags'] = out


def head(ctx, opts, page):
    tags = opts.get('tags') or {}
    if not tags:
        return ''
    light = '; '.join(f'--{t["var"]}: {t["light"]}' for t in tags.values())
    dark = '; '.join(f'--{t["var"]}: {t["dark"]}' for t in tags.values())
    css = [f':root {{ {light}; }}',
           f'@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ {dark}; }} }}',
           f':root[data-theme="dark"] {{ {dark}; }}',
           '@media print { :root, :root[data-theme="dark"] { ' + ' '.join(f'--{t["var"]}: {t["light"]} !important;' for t in tags.values()) + ' } }']
    for name, t in tags.items():
        w = f' font-weight: {t["weight"]};' if isinstance(t.get('weight'), (int, str)) and str(t['weight']).isdigit() else ''
        if t.get('font'):
            w += f' font-family: var(--f-{t["font"]});'
        if t.get('style'):
            w += f' font-style: {t["style"]};'
        # the table variants match the specificity of table header rules (and come later, so they win)
        css.append(f'.{name}, table.t th.{name}, table.t td.{name} {{ color: var(--{t["var"]});{w} }}')
    return f'<style data-package="notation">{" ".join(css)}</style>'
