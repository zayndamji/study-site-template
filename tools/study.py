#!/usr/bin/env python3
"""study — build, check and scaffold study sites made from this template.

  python3 tools/study.py new <dir> [--title T] [--noun Chapter] [--demo]   scaffold a new site
  python3 tools/study.py build [site_dir] [--force]                       build site_dir/dist
  python3 tools/study.py check [site_dir] [--no-build]                     build, then run every check
  python3 tools/study.py packages [--json|--check]                         list (or validate) packages
  python3 tools/study.py info <package>                                    show one package's options
  python3 tools/study.py serve [site_dir] [--port 8000]                    serve the built site locally

Only the Python 3.9+ standard library is required (node is optional, used by `check` to
syntax-check scripts).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from studylib.common import PACKAGES_DIR, StudyError, read_package_meta  # noqa: E402


def cmd_build(a):
    from studylib.build import build
    ctx = build(Path(a.site), force=a.force, out_dir=a.out)
    return 1 if (a.strict and ctx.warnings) else 0


def cmd_check(a):
    from studylib.check import run_checks
    return run_checks(Path(a.site), rebuild=not a.no_build, page=a.page)


def cmd_new(a):
    from studylib.scaffold import new_site
    new_site(Path(a.dir), title=a.title, noun=a.noun, demo=a.demo, template_rel=a.template_path)
    return 0


def validate_package(path):
    """Return a list of contract problems for one package folder (see docs/packages.md)."""
    probs = []
    try:
        m = read_package_meta(path)
    except Exception as e:  # malformed JSON etc.
        return [f'{path.name}: package.json unreadable ({e})']
    if m['name'] != path.name:
        probs.append(f'{path.name}: package.json name "{m["name"]}" differs from folder name')
    for f in ('README.md', 'example.html'):
        if not (path / f).exists():
            probs.append(f'{path.name}: missing {f}')
    for f in m['css'] + m['js']:
        if not (path / f).exists():
            probs.append(f'{path.name}: listed asset {f} does not exist')
    for k, v in m['options'].items():
        if not isinstance(v, dict) or 'default' not in v or not v.get('description'):
            probs.append(f'{path.name}: option "{k}" needs a "default" and a "description"')
    for key in ('title', 'description', 'category'):
        if not m.get(key):
            probs.append(f'{path.name}: package.json has no "{key}"')
    return probs


def cmd_packages(a):
    if a.check:
        probs = []
        for p in sorted(PACKAGES_DIR.iterdir()):
            if p.is_dir():
                probs += validate_package(p)
        print('\n'.join(probs) if probs else 'OK: every package follows the contract.')
        return 1 if probs else 0
    rows = []
    for p in sorted(PACKAGES_DIR.iterdir()):
        if (p / 'package.json').exists():
            m = read_package_meta(p)
            rows.append({'name': m['name'], 'title': m.get('title', ''), 'description': m.get('description', ''),
                         'requires': m['requires'], 'category': m.get('category', '')})
    if a.json:
        print(json.dumps(rows, indent=2, ensure_ascii=False))
    else:
        w = max(len(r['name']) for r in rows)
        for r in rows:
            req = f"  (requires {', '.join(r['requires'])})" if r['requires'] else ''
            print(f"{r['name']:<{w}}  {r['description']}{req}")
    return 0


def cmd_info(a):
    from studylib.common import find_package, load_config
    site = Path(a.site).resolve() if a.site else None
    p = find_package(a.package, site, load_config(site) if site else None) or PACKAGES_DIR / a.package
    if not (p / 'package.json').exists():
        raise StudyError(f'no package "{a.package}"; run `study.py packages` to list them')
    m = read_package_meta(p)
    print(f"{m['name']} — {m.get('title', '')}\n{m.get('description', '')}\n")
    if m['requires']:
        print('requires: ' + ', '.join(m['requires']) + '\n')
    print('options (site.json → "packages": {"' + m['name'] + '": {…}}):')
    for k, v in m['options'].items():
        d = v.get('default') if isinstance(v, dict) else v
        desc = v.get('description', '') if isinstance(v, dict) else ''
        print(f'  {k} = {json.dumps(d, ensure_ascii=False)}\n      {desc}')
    readme = p / 'README.md'
    if readme.exists():
        print(f'\nFull docs: {readme}')
    return 0


def cmd_serve(a):
    import functools
    import http.server
    from studylib.common import load_config
    site = Path(a.site).resolve()
    out = site / load_config(site)['build']['outDir']
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(out))
    print(f'serving {out} at http://localhost:{a.port}/  (Ctrl-C to stop)')
    http.server.ThreadingHTTPServer(('127.0.0.1', a.port), handler).serve_forever()


def main(argv=None):
    ap = argparse.ArgumentParser(prog='study', description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    b = sub.add_parser('build', help='build a site')
    b.add_argument('site', nargs='?', default='.')
    b.add_argument('--force', action='store_true', help='overwrite an output folder this tool did not create')
    b.add_argument('--strict', action='store_true', help='exit non-zero on warnings')
    b.add_argument('--out', default=None, help='output folder (default: build.outDir in site.json)')
    b.set_defaults(fn=cmd_build)
    c = sub.add_parser('check', help='build and verify a site')
    c.add_argument('site', nargs='?', default='.')
    c.add_argument('--no-build', action='store_true', help="check the existing output folder instead of a fresh temporary build")
    c.add_argument('--page', default=None, help='only report problems in this page (by id)')
    c.set_defaults(fn=cmd_check)
    n = sub.add_parser('new', help='scaffold a new site')
    n.add_argument('dir')
    n.add_argument('--title', default='Study Notebook')
    n.add_argument('--noun', default='Unit', help='what one page of notes is called: Unit, Chapter, Lecture, Week…')
    n.add_argument('--demo', action='store_true', help='include demo pages that exercise every package')
    n.add_argument('--template-path', default=None, help='path to this template as written into site.json (default: relative)')
    n.set_defaults(fn=cmd_new)
    p = sub.add_parser('packages', help='list available packages')
    p.add_argument('--json', action='store_true')
    p.add_argument('--check', action='store_true', help='validate every package against docs/packages.md')
    p.set_defaults(fn=cmd_packages)
    i = sub.add_parser('info', help="show a package's options")
    i.add_argument('package')
    i.add_argument('--site', default=None, help="also look in this site's packages/ folder")
    i.set_defaults(fn=cmd_info)
    s = sub.add_parser('serve', help='serve the built site')
    s.add_argument('site', nargs='?', default='.')
    s.add_argument('--port', type=int, default=8000)
    s.set_defaults(fn=cmd_serve)
    a = ap.parse_args(argv)
    try:
        return a.fn(a) or 0
    except StudyError as e:
        print(f'error: {e}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
