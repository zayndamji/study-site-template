"""growth-chart build hooks: check that every chart spec is valid JSON and names known curves."""
import json
import re

_SPEC = re.compile(r'<div\b[^>]*\bclass="[^"]*\bgc-chart\b[^"]*"[^>]*>((?:(?!\bgc-chart\b).)*?)<script type="application/json">(.*?)</script>', re.S)
_SUP = str.maketrans('⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ', '0123456789n')
_N = r'(\d+(?:\.\d+)?)'
_RULES = [r'^1$', r'^logn$', r'^nlogn$', rf'^n\^{_N}logn$', rf'^log\^{_N}n$', r'^n$', r'^sqrtn$',
          rf'^n\^{_N}$', r'^n\^n$', rf'^{_N}\^n$', r'^c\^n$', r'^n!$']


def _num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and v == v and abs(v) != float('inf')


def _norm(fn):
    """The same normalisation as growth-chart.js normName()."""
    s = re.sub(r'\s+', '', str(fn).lower()).replace('**', '^')
    s = re.sub('[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ]+', lambda m: '^' + m.group(0).translate(_SUP), s)
    s = re.sub(r'[·*×()]', '', s).replace('√', 'sqrt').replace('lg', 'log')
    return re.sub(r'log_?2(?=n|\^)', 'log', s)


def known_curve(fn, base=None):
    """True if growth-chart.js can draw the curve name fn (c^n needs a positive base)."""
    if not isinstance(fn, str) or not fn.strip():
        return False
    s = _norm(fn)
    for rx in _RULES:
        m = re.match(rx, s)
        if not m:
            continue
        if rx == r'^c\^n$':
            return _num(base) and base > 0
        if rx == rf'^{_N}\^n$':
            return float(m.group(1)) > 0
        return True
    return False


def _range(v):
    if isinstance(v, list) and len(v) == 2 and all(_num(x) for x in v):
        return v
    if isinstance(v, dict) and _num(v.get('min')) and _num(v.get('max')):
        return [v['min'], v['max']]
    return None


def check_spec(spec):
    """Problems with one chart spec (a dict), as strings."""
    if not isinstance(spec, dict):
        return ['the spec is not a JSON object']
    out = []
    for key in ('xScale', 'yScale'):
        if key in spec and spec[key] not in ('linear', 'log'):
            out.append(f'"{key}" must be "linear" or "log", not {spec[key]!r}')
    x = _range(spec.get('x')) if 'x' in spec else [1, 32]
    if x is None or x[0] >= x[1]:
        out.append('"x" must be [min, max] (or {"min", "max"}) with min < max')
    elif spec.get('xScale') == 'log' and x[0] <= 0:
        out.append('a log x axis needs "x" to start above 0')
    for key in ('y', 'maxN'):
        if key in spec and not (key == 'maxN' and spec[key] is False):
            r = _range(spec[key])
            if r is None or r[0] >= r[1]:
                out.append(f'"{key}" must be [min, max] with min < max' + (' (or false)' if key == 'maxN' else ''))
            elif key == 'y' and spec.get('yScale') == 'log' and r[0] <= 0:
                out.append('a log y axis needs "y" to start above 0')
    curves, series = spec.get('curves', []), spec.get('series', [])
    if not isinstance(curves, list) or not isinstance(series, list):
        return out + ['"curves" and "series" must be lists']
    if not curves and not series:
        out.append('no "curves" and no "series"')
    for i, c in enumerate(curves):
        if not isinstance(c, dict) or not known_curve(c.get('fn'), c.get('base')):
            fn = c.get('fn') if isinstance(c, dict) else c
            hint = ' ("c^n" needs a positive "base")' if isinstance(fn, str) and _norm(fn) == 'c^n' else ''
            out.append(f'curve {i + 1}: unknown curve name {fn!r}{hint}')
            continue
        if 'scale' in c and not (_num(c['scale']) and c['scale'] > 0):
            out.append(f'curve {i + 1}: "scale" must be a positive number')
    fits = [spec.get('fit')] + [s.get('fit') for s in series if isinstance(s, dict)]
    for f in fits:
        if isinstance(f, list):
            for fn in f:
                if not known_curve(fn):
                    out.append(f'fit: unknown curve name {fn!r}')
    for i, s in enumerate(series):
        pts = s.get('points') if isinstance(s, dict) else None
        if not isinstance(pts, list) or not pts:
            out.append(f'series {i + 1}: "points" must be a non-empty list of [n, value] pairs')
            continue
        bad = [p for p in pts if not (isinstance(p, list) and len(p) == 2 and _num(p[0]) and _num(p[1]))]
        if bad:
            out.append(f'series {i + 1}: {len(bad)} point(s) are not [n, value] number pairs')
        if not s.get('label'):
            out.append(f'series {i + 1}: no "label" (the legend needs one)')
    return out


def check(ctx, opts, outputs):
    problems = []
    for fn in opts.get('fitCandidates') or []:
        if not known_curve(fn):
            problems.append(f'site.json: growth-chart fitCandidates: unknown curve name {fn!r}')
    for rel, html in sorted(outputs.items()):
        if not rel.endswith('.html') or 'gc-chart' not in html:
            continue
        for m in _SPEC.finditer(html):
            line = html.count('\n', 0, m.start()) + 1
            try:
                spec = json.loads(m.group(2))
            except ValueError as e:
                problems.append(f'{rel}: line {line}: growth-chart spec is not valid JSON ({e})')
                continue
            problems += [f'{rel}: line {line}: growth-chart: {p}' for p in check_spec(spec)]
        n_hosts = len(re.findall(r'<div\b[^>]*\bclass="[^"]*\bgc-chart\b', html))
        n_specs = len(list(_SPEC.finditer(html)))
        if n_hosts > n_specs:
            problems.append(f'{rel}: {n_hosts - n_specs} .gc-chart without a <script type="application/json"> spec')
    return problems
