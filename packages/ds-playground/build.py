"""ds-playground build hooks: validate the class prefix, check playground JSON specs."""
import json
import re

# operation → number of arguments, per kind (keep in step with KINDS in ds-playground.js)
KINDS = {
    'vector': {'add': 1, 'insert': 2, 'remove': 1, 'get': 1, 'set': 2, 'size': 0, 'clear': 0},
    'stack': {'push': 1, 'pop': 0, 'peek': 0, 'isEmpty': 0, 'size': 0},
    'queue': {'enqueue': 1, 'dequeue': 0, 'peek': 0, 'isEmpty': 0, 'size': 0},
    'set': {'add': 1, 'remove': 1, 'contains': 1, 'size': 0},
    'map': {'put': 2, 'get': 1, 'remove': 1, 'containsKey': 1, 'size': 0},
    'pq-heap': {'enqueue': 1, 'dequeue': 0, 'peek': 0, 'isEmpty': 0, 'size': 0},
    'linked-list': {'add': 1, 'addFront': 1, 'insert': 2, 'remove': 1, 'get': 1, 'size': 0},
    'bst': {'put': 1, 'contains': 1, 'remove': 1, 'size': 0},
}
_CHOICES = {'valueType': ('any', 'number', 'text'), 'orientation': ('vertical', 'horizontal'),
            'order': ('min', 'max'), 'base': (0, 1)}
_HOST = r'<div\b[^>]*\bclass="[^"]*\b{p}playground\b[^"]*"[^>]*>'
_JSON = re.compile(r'<script type="application/json">(.*?)</script>', re.S)


def configure(ctx, opts):
    p = str(opts.get('classPrefix') if opts.get('classPrefix') is not None else 'dsp-')
    if not re.match(r'^[A-Za-z_][\w-]*$', p):
        ctx.warn(f'ds-playground: classPrefix {p!r} is not a valid start of a class name; using "dsp-"')
        p = 'dsp-'
    opts['classPrefix'] = p


def _scalar(v):
    return isinstance(v, (str, int, float)) and not isinstance(v, bool)


def _initial_problems(kind, init, pairs):
    """Problems with the shape of an "initial" (or a preset's "initial") list."""
    if kind == 'map':
        if isinstance(init, dict):
            bad = [k for k, v in init.items() if not _scalar(v)]
            return [f'map value of {k!r} must be a number or a string' for k in bad]
        if not isinstance(init, list) or not all(isinstance(x, list) and len(x) == 2 and all(map(_scalar, x)) for x in init):
            return ['map "initial" must be an object {key: value} or a list of [key, value] pairs']
        return []
    if not isinstance(init, list):
        return ['"initial" must be a list']
    if kind == 'pq-heap':
        def entry(x):
            if _scalar(x) and not isinstance(x, str):
                return not pairs
            if isinstance(x, list) and len(x) == 2:
                return pairs and _scalar(x[0]) and isinstance(x[1], (int, float)) and not isinstance(x[1], bool)
            if isinstance(x, dict):
                return pairs and _scalar(x.get('value')) and isinstance(x.get('priority'), (int, float))
            return False
        if not all(entry(x) for x in init):
            return ['pq-heap "initial" must hold ' + ('[value, priority] pairs or {"value", "priority"} objects'
                                                      if pairs else 'numbers (priorities); set "pairs": true for [value, priority]')]
        return []
    if not all(_scalar(x) for x in init):
        return ['"initial" must hold only numbers or short strings']
    return []


def _spec_problems(spec):
    if not isinstance(spec, dict):
        return ['spec must be a JSON object']
    kind = spec.get('kind')
    if kind not in KINDS:
        return [f'unknown "kind" {kind!r} (one of {", ".join(KINDS)})']
    probs = []
    pairs = kind == 'pq-heap' and bool(spec.get('pairs'))
    arity = dict(KINDS[kind], **({'enqueue': 2} if pairs else {}))
    ops = spec.get('ops')
    if ops is not None:
        if not isinstance(ops, list):
            probs.append('"ops" must be a list of operation names')
        else:
            for o in ops:
                if o not in arity:
                    probs.append(f'{kind} has no operation {o!r} (it has {", ".join(arity)})')
    for k, allowed in _CHOICES.items():
        if k in spec and spec[k] not in allowed:
            probs.append(f'"{k}" must be one of {", ".join(map(json.dumps, allowed))}')
    for k in ('max', 'maxLength', 'capacity', 'perRow'):
        if k in spec and not (isinstance(spec[k], int) and not isinstance(spec[k], bool) and spec[k] > 0):
            probs.append(f'"{k}" must be a positive whole number')
    if 'growth' in spec and not (isinstance(spec['growth'], (int, float)) and spec['growth'] > 1):
        probs.append('"growth" must be a number above 1')
    if 'suggest' in spec and spec['suggest'] != 'random' and not (isinstance(spec['suggest'], list) and all(map(_scalar, spec['suggest']))):
        probs.append('"suggest" must be "random" or a list of values')
    if 'fields' in spec and not (isinstance(spec['fields'], dict) and set(spec['fields']) <= {'index', 'value', 'key', 'priority'}):
        probs.append('"fields" must be an object with keys among index, value, key, priority')
    if 'labels' in spec and not isinstance(spec['labels'], dict):
        probs.append('"labels" must be an object')

    def initial(init, where):
        out = [f'{where}{p}' for p in _initial_problems(kind, init, pairs)]
        size = len(init) if isinstance(init, (list, dict)) else 0
        if isinstance(spec.get('max'), int) and size > spec['max']:
            out.append(f'{where}"initial" has {size} elements but "max" is {spec["max"]}')
        return out
    if 'initial' in spec:
        probs += initial(spec['initial'], '')
    presets = spec.get('presets', [])
    if not isinstance(presets, list):
        return probs + ['"presets" must be a list']
    for j, p in enumerate(presets):
        where = f'preset {j + 1}'
        if not isinstance(p, dict) or not p.get('name'):
            probs.append(f'{where} needs a "name"')
            continue
        where = f'preset {p["name"]!r}: '
        if 'initial' in p:
            probs += initial(p['initial'], where)
        if p.get('watch', 'last') not in ('last', 'all'):
            probs.append(where + '"watch" must be "last" or "all"')
        steps = p.get('ops', [])
        if not isinstance(steps, list):
            probs.append(where + '"ops" must be a list of [operation, arguments…]')
            continue
        for s in steps:
            if not isinstance(s, list) or not s or s[0] not in arity:
                probs.append(where + f'{json.dumps(s)} is not [operation, arguments…] with an operation of {kind}')
            elif len(s) - 1 != arity[s[0]]:
                probs.append(where + f'{s[0]} takes {arity[s[0]]} argument(s), got {len(s) - 1}')
    return probs


def check(ctx, opts, outputs):
    host = re.compile(_HOST.replace('{p}', re.escape(opts['classPrefix'])))
    problems = []
    for rel, html in sorted(outputs.items()):
        if not rel.endswith('.html'):
            continue
        starts = [m.start() for m in host.finditer(html)]
        for j, at in enumerate(starts):
            line = html.count('\n', 0, at) + 1
            where = f'{rel}: line {line}: ds-playground spec'
            end = starts[j + 1] if j + 1 < len(starts) else len(html)
            m = _JSON.search(html, at, end)
            if not m:
                problems.append(f'{where}: no <script type="application/json"> spec')
                continue
            try:
                spec = json.loads(m.group(1))
            except ValueError as e:
                problems.append(f'{where} is not valid JSON ({e})')
                continue
            problems += [f'{where}: {p}' for p in _spec_problems(spec)]
    return problems
