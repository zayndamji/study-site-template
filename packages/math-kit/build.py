"""math-kit build hooks: publish the spacing options as CSS variables."""
import re

_SAFE = re.compile(r'^[\w\s.%#(),+\-*/]*$')

# the rules of each mat-<style> class in math-kit.css, re-applied to bare .mat when that style is the default
_BRACKET_CSS = {
    'square': [],
    'round': [('::before, {bare}::after', 'width: 7px; border-top-color: transparent; border-bottom-color: transparent;'),
              ('::before', 'border-radius: 50% 0 0 50% / 14px 0 0 14px;'),
              ('::after', 'border-radius: 0 50% 50% 0 / 0 14px 14px 0;')],
    'bar': [('::before, {bare}::after', 'width: 0; border-top: 0; border-bottom: 0;')],
    'soft': [('', 'padding: 3px 8px;'),
             ('::before, {bare}::after', 'width: 5px; border-top: 0; border-bottom: 0; border-width: 1.6px;'),
             ('::before', 'border-radius: 5px 0 0 5px;'),
             ('::after', 'border-radius: 0 5px 5px 0;')],
    'none': [('::before, {bare}::after', 'display: none;')],
}

# option -> (CSS variable, default used by math-kit.css)
_VARS = {
    'letterSpacing': ('--mk-letter-spacing', '0.03em'),
    'wordSpacing': ('--mk-word-spacing', '0.14em'),
    'blockLineHeight': ('--mk-block-line-height', '2'),
    'matrixGap': ('--mk-matrix-gap', '3px 16px'),
}


def configure(ctx, opts):
    """Validate once, so a bad value warns once rather than once per page."""
    for key, (_, dflt) in _VARS.items():
        s = str(opts.get(key) if opts.get(key) is not None else dflt).strip()
        if not s or not _SAFE.match(s):
            ctx.warn(f'package "math-kit": option "{key}" is not a plain CSS value ({opts.get(key)!r}); using {dflt!r}')
            s = dflt
        opts[key] = s
    if opts.get('bracket') not in _BRACKET_CSS:
        ctx.warn(f'package "math-kit": option "bracket" must be one of {", ".join(_BRACKET_CSS)}; using "square"')
        opts['bracket'] = 'square'


def head(ctx, opts, page):
    decls = '; '.join(f'{var}: {opts[key]}' for key, (var, dflt) in _VARS.items() if opts.get(key) != dflt)
    css = [f':root {{ {decls}; }}'] if decls else []
    # a non-square default also applies to hand-written matrices without a mat-* class
    bare = '.mat' + ''.join(f':not(.mat-{b})' for b in _BRACKET_CSS)
    for sel, rule in _BRACKET_CSS.get(opts.get('bracket'), []):
        css.append(f'{bare}{sel.replace("{bare}", bare)} {{ {rule} }}')
    return f'<style data-package="math-kit">{" ".join(css)}</style>' if css else ''
