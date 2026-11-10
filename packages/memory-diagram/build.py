"""memory-diagram build hooks: check JSON scenes (valid JSON, pointers name known heap objects)."""
import json
import re

_SPEC = r'<div\b[^>]*\bclass="[^"]*\b{p}(?:figure|trace)\b[^"]*"[^>]*>\s*<script type="application/json">(.*?)</script>'


def configure(ctx, opts):
    p = str(opts.get('classPrefix') if opts.get('classPrefix') is not None else 'md-')
    if not re.match(r'^[A-Za-z_][\w-]*$', p):
        ctx.warn(f'memory-diagram: classPrefix {p!r} is not a valid start of a class name; using "md-"')
        p = 'md-'
    opts['classPrefix'] = p


def _pointers(scene):
    """Yield every pointer target in a scene's stack and heap."""
    def cells(v):
        if isinstance(v, dict):
            yield v
            for c in v.get('cells') or []:
                if isinstance(c, dict):
                    yield c
    for f in scene.get('stack') or []:
        for v in f.get('vars') or []:
            yield from cells(v)
    for o in scene.get('heap') or []:
        for c in (o.get('cells') or []) + (o.get('fields') or []):
            if isinstance(c, dict):
                yield c
    arr = scene.get('array')
    for c in (arr.get('cells') if isinstance(arr, dict) else arr) or []:
        if isinstance(c, dict):
            yield c


def check(ctx, opts, outputs):
    rx = re.compile(_SPEC.replace('{p}', re.escape(opts['classPrefix'])), re.S)
    problems = []
    for rel, html in sorted(outputs.items()):
        if not rel.endswith('.html'):
            continue
        for m in rx.finditer(html):
            line = html.count('\n', 0, m.start()) + 1
            where = f'{rel}: line {line}: memory-diagram spec'
            try:
                cfg = json.loads(m.group(1))
            except ValueError as e:
                problems.append(f'{where} is not valid JSON ({e})')
                continue
            scenes, heap = [], None
            if 'steps' in cfg:
                if not cfg['steps']:
                    problems.append(f'{where}: "steps" is empty')
                parts = ('stack', 'heap', 'tree', 'array', 'grid', 'layout')
                base = {k: cfg[k] for k in parts if k in cfg}
                for s in cfg['steps']:
                    base = dict(base, **{k: s[k] for k in parts if k in s})
                    scenes.append(dict(base))
            else:
                scenes = [cfg]
            for k, sc in enumerate(scenes):
                ids = {o.get('id') for o in sc.get('heap') or [] if isinstance(o, dict)}
                if None in ids:
                    problems.append(f'{where}: a heap object has no "id"')
                for c in _pointers(sc):
                    to = c.get('ptr')
                    if to and str(to).split('#')[0].split('.')[0] not in ids:
                        problems.append(f'{where}' + (f' (step {k + 1})' if len(scenes) > 1 else '') + f': pointer to unknown heap object {to!r}')
                if sc.get('layout') != 'memory' and not any(sc.get(p) for p in ('stack', 'heap', 'tree', 'array', 'grid')):
                    problems.append(f'{where}' + (f' (step {k + 1})' if len(scenes) > 1 else '') + ': nothing to draw (no stack, heap, tree, array or grid)')
    return problems
