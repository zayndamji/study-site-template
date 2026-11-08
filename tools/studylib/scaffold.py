"""`study.py new`: create a site folder from templates/site (optionally with a demo of every package)."""
from __future__ import annotations

import json
import os
import re
import shutil
from pathlib import Path

from .common import CORE_DIR, PACKAGES_DIR, TEMPLATE_DIR, StudyError, log, read_package_meta

STARTER = TEMPLATE_DIR / 'templates' / 'site'
CATEGORY_TITLES = {
    'content': 'Writing the page', 'sources': 'Sources and citations', 'widgets': 'Widgets',
    'home': 'Home page', 'navigation': 'Navigation and page kinds', 'site': 'Site-wide',
}


def _slug(s: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-') or 'study'


def _copy_tree(src: Path, dst: Path, page_id: str):
    for f in sorted(src.rglob('*')):
        if f.is_dir():
            continue
        rel = Path(*[part.replace('{id}', page_id) for part in f.relative_to(src).parts])
        (dst / rel).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(f, dst / rel)


def new_site(dest: Path, title='Study Notebook', noun='Unit', demo=False, template_rel=None):
    dest = dest.resolve()
    if dest.exists() and any(dest.iterdir()):
        raise StudyError(f'{dest} already exists and is not empty')
    dest.mkdir(parents=True, exist_ok=True)
    for f in STARTER.rglob('*'):
        if f.is_file():
            rel = f.relative_to(STARTER)
            name = '.gitignore' if rel.name == 'gitignore' else rel.name
            (dest / rel.parent).mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, dest / rel.parent / name)
    tpath = template_rel
    if not tpath:
        rel = os.path.relpath(TEMPLATE_DIR, dest)
        tpath = rel if rel.count('..') <= 2 else str(TEMPLATE_DIR)
    lower = noun.lower()
    cfg = {
        '$schema': str(Path(tpath) / 'schema' / 'site.schema.json'),
        'template': tpath,
        'site': {'title': title, 'brand': {'open': '[', 'close': ']'}, 'description': '',
                 'storagePrefix': _slug(title) + ':'},
        'kinds': {'unit': {'noun': noun, 'file': lower + '-{id}.html', 'source': 'units/{id}.html'}},
        'groups': [{'id': 'part-1', 'title': 'Part one'}],
        'pages': [{'id': '01', 'title': 'Getting started', 'label': 'Getting started',
                   'description': 'How this notebook is put together', 'group': 'part-1'}],
        'packages': {},
    }
    if demo:
        _add_demo(dest, cfg)
    (dest / 'site.json').write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    log(f'created {dest}\n  next: python3 {TEMPLATE_DIR / "tools" / "study.py"} build {dest}')
    return dest


def _add_demo(dest: Path, cfg: dict):
    """One page per package (its example.html), every package enabled with defaults."""
    cfg['site']['description'] = 'Demo of every component and package in the template.'
    cfg['home'] = {'intro': {'eyebrow': 'Template demo', 'tagline': 'Every component and package, one page each.'}}
    cfg['groups'] = [{'id': 'core', 'title': 'Core components'}]
    units = dest / 'content' / 'units'
    shutil.copy2(CORE_DIR / 'example.html', units / '01.html')
    cfg['pages'] = [{'id': '01', 'title': 'Core components', 'label': 'Core components',
                     'description': 'Boxes, math, tables, diagrams, widgets, steppers, quizzes', 'group': 'core'}]
    metas = []
    for p in sorted(PACKAGES_DIR.iterdir()):
        if (p / 'package.json').exists() and (p / 'example.html').exists():
            metas.append((p, read_package_meta(p)))
    order = list(CATEGORY_TITLES)
    metas.sort(key=lambda pm: (order.index(pm[1].get('category')) if pm[1].get('category') in order else 99, pm[1]['name']))
    seen_groups = {'core'}
    n = 1
    for path, meta in metas:
        cat = meta.get('category') or 'other'
        if cat not in seen_groups:
            cfg['groups'].append({'id': cat, 'title': CATEGORY_TITLES.get(cat, cat.title())})
            seen_groups.add(cat)
        n += 1
        pid = f'{n:02d}'
        body = (path / 'example.html').read_text(encoding='utf-8')
        if not body.lstrip().startswith('<!--page'):
            body = '<!--page ' + json.dumps({'lede': meta.get('description', '')}, ensure_ascii=False) + ' -->\n' + body
        (units / f'{pid}.html').write_text(body, encoding='utf-8')
        if (path / 'demo' / 'content').exists():
            _copy_tree(path / 'demo' / 'content', dest / 'content', pid)
        if (path / 'demo' / 'static').exists():
            _copy_tree(path / 'demo' / 'static', dest / 'static', pid)
        cfg['pages'].append({'id': pid, 'title': meta.get('title', meta['name']), 'label': meta.get('title', meta['name']),
                             'description': meta.get('description', ''), 'group': cat, 'keywords': meta['name']})
        cfg['packages'][meta['name']] = {}
    # extra pages that show off page-level packages
    if 'resources' in cfg['packages']:
        guides = dest / 'content' / 'guides'
        guides.mkdir(parents=True, exist_ok=True)
        shutil.copy2(PACKAGES_DIR / 'resources' / 'example.html', guides / 'style.html')
        cfg['groups'].append({'id': 'help', 'title': 'Guides'})
        cfg['pages'].append({'id': 'style', 'kind': 'guide', 'title': 'Example guide', 'group': 'help',
                             'description': 'A resource page: no numbering, no review buttons'})
    if 'coming-later' in cfg['packages']:
        cfg['pages'].append({'id': f'{n + 1:02d}', 'title': 'A page still to be written', 'status': 'planned',
                             'group': metas[-1][1].get('category') if metas else 'core'})
    if 'summaries' in cfg['packages']:
        sheet_dir = dest / 'content' / 'summaries'
        sheet_dir.mkdir(parents=True, exist_ok=True)
        if not (sheet_dir / '01.html').exists():
            (sheet_dir / '01.html').write_text('<ul><li>Core components: boxes, math, tables, diagrams, widgets, '
                                               'steppers and quizzes.</li></ul>\n', encoding='utf-8')
