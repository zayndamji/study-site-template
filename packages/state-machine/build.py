"""state-machine build hooks: validate options, publish the edge-label colour, check JSON specs."""
import json
import re

_SAFE = re.compile(r'^[\w\s.%#(),+\-/]*$')
_SPEC = re.compile(r'<div\b[^>]*\bclass="[^"]*\b{p}(?:sim|figure)\b[^"]*"[^>]*>\s*<script type="application/json">(.*?)</script>', re.S)


def _core_tokens():
    from studylib.common import CORE_DIR
    return set(re.findall(r'--([a-z][a-z0-9-]*)\s*:', (CORE_DIR / 'core.css').read_text(encoding='utf-8')))


def configure(ctx, opts):
    p = str(opts.get('classPrefix') if opts.get('classPrefix') is not None else 'sm-')
    if not re.match(r'^[A-Za-z_][\w-]*$', p):
        ctx.warn(f'state-machine: classPrefix {p!r} is not a valid start of a class name; using "sm-"')
        p = 'sm-'
    opts['classPrefix'] = p
    c = str(opts.get('labelColor') or '').strip()
    if c:
        if c in _core_tokens():
            c = f'var(--{c})'
        elif not _SAFE.match(c):
            ctx.warn(f'state-machine: labelColor {c!r} is not a plain CSS colour or token; ignored')
            c = ''
    opts['labelColor'] = c


_ROLE = re.compile(r'\[data-sm~?="([\w-]+)"\]')


def _class_css(prefix):
    """The package CSS with every data-sm role selector rewritten to the prefixed class, so
    elements a page script builds with those classes alone look the same."""
    from pathlib import Path
    css = (Path(__file__).with_name('state-machine.css')).read_text(encoding='utf-8')
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    return _ROLE.sub(lambda m: '.' + prefix + m.group(1), css).strip()


def head(ctx, opts, page):
    bits = []
    c = opts.get('labelColor')
    if c:
        bits.append(f':root {{ --sm-label: {c}; }}')
    if opts.get('classStyles'):
        if not hasattr(ctx, '_sm_class_css'):
            ctx._sm_class_css = ' '.join(_class_css(opts['classPrefix']).split())
        bits.append(ctx._sm_class_css)
    return f'<style data-package="state-machine">{" ".join(bits)}</style>' if bits else ''


def check(ctx, opts, outputs):
    """Every spec must be valid JSON with states, and its edges must name known states."""
    rx = re.compile(_SPEC.pattern.replace('{p}', re.escape(opts['classPrefix'])), re.S)
    problems = []
    for rel, html in sorted(outputs.items()):
        if not rel.endswith('.html'):
            continue
        for m in rx.finditer(html):
            line = html.count('\n', 0, m.start()) + 1
            try:
                cfg = json.loads(m.group(1))
            except ValueError as e:
                problems.append(f'{rel}: line {line}: state-machine spec is not valid JSON ({e})')
                continue
            for j, spec in enumerate(cfg.get('machines') or [cfg]):
                where = f'{rel}: line {line}: state-machine spec' + (f' (machine {j + 1})' if 'machines' in cfg else '')
                states = spec.get('states')
                if not isinstance(states, list) or not states:
                    problems.append(f'{where}: no "states"')
                    continue
                ids = {s.get('id') for s in states if isinstance(s, dict)}
                if spec.get('start') not in ids:
                    problems.append(f'{where}: start state {spec.get("start")!r} is not one of its states')
                for e in spec.get('edges') or []:
                    for end in ('from', 'to'):
                        if e.get(end) not in ids:
                            problems.append(f'{where}: an edge goes {end} unknown state {e.get(end)!r}')
                for s in states:
                    if not isinstance(s.get('x'), (int, float)) or not isinstance(s.get('y'), (int, float)):
                        problems.append(f'{where}: state {s.get("id")!r} needs numeric "x" and "y"')
    return problems
