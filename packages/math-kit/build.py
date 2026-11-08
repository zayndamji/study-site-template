"""math-kit build hooks: publish the spacing options as CSS variables."""
import re

_SAFE = re.compile(r'^[\w\s.%#(),+\-*/]*$')

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
    if opts.get('bracket') not in ('square', 'round', 'bar'):
        ctx.warn(f'package "math-kit": option "bracket" must be "square", "round" or "bar"; using "square"')
        opts['bracket'] = 'square'


def head(ctx, opts, page):
    decls = '; '.join(f'{var}: {opts[key]}' for key, (var, dflt) in _VARS.items() if opts.get(key) != dflt)
    return f'<style data-package="math-kit">:root {{ {decls}; }}</style>' if decls else ''
