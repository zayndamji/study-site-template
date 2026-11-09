"""Shared helpers: config loading, defaults, package resolution, content parsing."""
from __future__ import annotations

import copy
import html as _html
import importlib.util
import json
import re
import string
import sys
from pathlib import Path

TEMPLATE_DIR = Path(__file__).resolve().parents[2]
CORE_DIR = TEMPLATE_DIR / 'core'
PACKAGES_DIR = TEMPLATE_DIR / 'packages'


class StudyError(Exception):
    """A problem the user must fix (bad config, missing file)."""


# --------------------------------------------------------------------------- defaults
DEFAULTS = {
    'site': {
        'title': 'Study Notebook',
        'brand': {'text': None, 'open': '[', 'close': ']'},
        'description': '',
        'lang': 'en',
        'storagePrefix': 'study:',
        'defaultTheme': 'system',
        'favicon': 'auto',
        'footer': '{site}',
        'pageFooter': '{site} · {noun} {badge} · {position} of {count}',
        'titleFormat': '{short} {badge} · {title} — {site}',
    },
    'theme': {
        'fonts': {
            'css': ['https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..700'
                    '&family=JetBrains+Mono:wght@400;600;700'
                    '&family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..600'
                    '&family=STIX+Two+Text:ital@0;1&display=swap'],
            'display': None, 'body': None, 'math': None, 'mono': None,
        },
        'tokens': {'light': {}, 'dark': {}, 'all': {}},
    },
    'build': {
        'outDir': 'dist',
        'contentDir': 'content',
        'staticDir': 'static',
        'packagesDir': 'packages',
        'cacheBust': True,
        'css': [],
        'js': [],
    },
    'nav': {
        'picker': True,
        'prevNext': True,
        'home': 'Home',
        'prevShort': '← Prev',
        'nextShort': 'Next →',
        'prevLong': '← {short} {badge}',
        'nextLong': 'Next: {label} →',
        'pickerOption': '{badge} · {label}',
        'showPlanned': False,
    },
    'home': {
        'intro': {'eyebrow': '', 'tagline': ''},
        'search': True,
        'searchPlaceholder': 'Find a page or topic…',
        'filters': 'auto',
        'allLabel': 'Everything',
        'columns': 3,
        'showRange': True,
        'emptyText': 'No matching pages.',
    },
    'labels': {
        'theme': 'Theme: ', 'themeTitle': 'Colour theme: {mode}',
        'themeSystem': 'System', 'themeLight': 'Light', 'themeDark': 'Dark',
        'reviewMark': 'Mark section as reviewed', 'reviewDone': '\u2713 Reviewed',
        'progress': '{done} / {total} sections reviewed',
        'stepBack': 'Back', 'stepNext': 'Next step', 'stepAll': 'Show all', 'stepStatus': 'Step {k} of {n}',
        'quizReset': 'Reset', 'quizCorrect': 'Correct', 'quizWrong': 'Not quite',
        'quizScore': '{right} / {answered} correct \u00b7 {left} left', 'quizCount': '{n} questions',
        'quizCountOne': '1 question',
        'skipLink': 'Skip to content', 'switchPage': 'Switch page', 'searchLabel': 'Search pages',
        'filterLabel': 'Filter pages', 'showEverything': 'Show everything',
        'matches': '{n} matching pages', 'matchesOne': '1 matching page',
    },
    'kinds': {},
    'groups': [],
    'pages': [],
    'packages': {},
}

KIND_DEFAULTS = {
    'noun': 'Unit',
    'plural': None,
    'short': None,
    'file': '{kind}-{id}.html',
    'source': '{kind}s/{id}.html',
    'storageKey': '{id}',
    'eyebrow': '{noun} {badge}',
    'rail': 'Sections',
    'review': True,
    'prevNext': True,
    'numbered': True,
    'inPicker': True,
}


def deep_merge(base, over):
    """Recursively merge dict `over` into a copy of `base`. Lists and scalars replace."""
    out = copy.deepcopy(base)
    for k, v in (over or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = copy.deepcopy(v)
    return out


def esc(s) -> str:
    return _html.escape('' if s is None else str(s), quote=True)


class _SafeDict(dict):
    def __missing__(self, key):
        return '{' + key + '}'


def fmt(template, **vals) -> str:
    """str.format that leaves unknown {fields} alone instead of raising."""
    if template is None:
        return ''
    return string.Formatter().vformat(str(template), (), _SafeDict(vals))


# --------------------------------------------------------------------------- config
def load_config(site_dir: Path) -> dict:
    p = site_dir / 'site.json'
    if not p.exists():
        raise StudyError(f'No site.json in {site_dir}. Create one with: python3 tools/study.py new <dir>')
    try:
        raw = json.loads(p.read_text(encoding='utf-8'))
    except json.JSONDecodeError as e:
        raise StudyError(f'site.json is not valid JSON: {e}') from e
    raw.pop('$schema', None)
    raw.pop('$comment', None)
    cfg = deep_merge(DEFAULTS, raw)
    if not cfg['site']['brand'].get('text'):
        cfg['site']['brand']['text'] = cfg['site']['title']
    return cfg


def normalize_kinds(cfg: dict) -> dict:
    kinds = cfg.get('kinds') or {}
    if not kinds:
        kinds = {'unit': {}}
    out = {}
    for name, k in kinds.items():
        k = deep_merge(KIND_DEFAULTS, k)
        k['name'] = name
        if not k.get('plural'):
            k['plural'] = k['noun'] + 's'
        if not k.get('short'):
            k['short'] = k['noun']
        out[name] = k
    cfg['kinds'] = out
    return out


def normalize_pages(cfg: dict, warn) -> list:
    kinds = cfg['kinds']
    default_kind = next(iter(kinds))
    seen = set()
    pages = []
    for i, raw in enumerate(cfg.get('pages') or []):
        if 'id' not in raw:
            raise StudyError(f'pages[{i}] has no "id"')
        e = dict(raw)
        e['id'] = str(e['id'])
        e.setdefault('kind', default_kind)
        if e['kind'] not in kinds:
            raise StudyError(f'page {e["id"]}: unknown kind "{e["kind"]}" (define it under "kinds")')
        k = kinds[e['kind']]
        if (e['kind'], e['id']) in seen:
            raise StudyError(f'duplicate page id "{e["id"]}" in kind "{e["kind"]}"')
        seen.add((e['kind'], e['id']))
        e.setdefault('title', e['id'])
        e.setdefault('label', e['title'])
        e.setdefault('description', '')
        e.setdefault('group', None)
        e.setdefault('status', 'ready')
        e.setdefault('keywords', '')
        vals = dict(id=e['id'], kind=e['kind'], noun=k['noun'], short=k['short'])
        e.setdefault('file', fmt(k['file'], **vals))
        e.setdefault('source', fmt(k['source'], **vals))
        e.setdefault('storageKey', fmt(k['storageKey'], **vals))
        e['href'] = e['file']
        m = re.match(r'^\D*0*(\d+)$', e['id'])
        e['num'] = int(m.group(1)) if (m and k.get('numbered', True)) else None
        e['badge'] = str(e.get('badge') or e['id'])   # display number, e.g. "A2"; defaults to the id
        e['index'] = i
        pages.append(e)
    groups = {g['id'] for g in cfg.get('groups') or []}
    for e in pages:
        if e['group'] and groups and e['group'] not in groups:
            warn(f'page {e["id"]}: group "{e["group"]}" is not listed in "groups"')
    return pages


# --------------------------------------------------------------------------- packages
class Package:
    def __init__(self, name, path: Path, meta: dict, options: dict):
        self.name, self.path, self.meta, self.options = name, path, meta, options
        self.hooks = None

    def hook(self, fn):
        return getattr(self.hooks, fn, None) if self.hooks else None

    def __repr__(self):
        return f'<Package {self.name} @ {self.path}>'


def find_package(name: str, site_dir: Path | None, cfg: dict | None) -> Path | None:
    dirs = []
    if site_dir is not None:
        dirs.append(site_dir / ((cfg or DEFAULTS)['build'].get('packagesDir') or 'packages'))
    dirs.append(PACKAGES_DIR)
    for d in dirs:
        p = d / name
        if (p / 'package.json').exists():
            return p
    return None


def read_package_meta(path: Path) -> dict:
    meta = json.loads((path / 'package.json').read_text(encoding='utf-8'))
    meta.setdefault('name', path.name)
    meta.setdefault('css', [])
    meta.setdefault('js', [])
    meta.setdefault('requires', [])
    meta.setdefault('options', {})
    return meta


def resolve_packages(cfg: dict, site_dir: Path, warn) -> list:
    wanted = cfg.get('packages') or {}
    if isinstance(wanted, list):
        wanted = {n: {} for n in wanted}
    order, state = [], {}

    def visit(name, chain):
        if state.get(name) == 'done':
            return
        if state.get(name) == 'busy':
            raise StudyError('package dependency cycle: ' + ' -> '.join(chain + [name]))
        state[name] = 'busy'
        path = find_package(name, site_dir, cfg)
        if not path:
            raise StudyError(f'package "{name}" not found in {site_dir / cfg["build"]["packagesDir"]} or {PACKAGES_DIR}')
        meta = read_package_meta(path)
        for dep in meta['requires']:
            visit(dep, chain + [name])
        user = wanted.get(name, {})
        if user is True or user is None:
            user = {}
        if user is False:
            raise StudyError(f'package "{name}" is disabled but required by {chain[-1] if chain else "?"}')
        defaults = {k: (v.get('default') if isinstance(v, dict) else v) for k, v in meta['options'].items()}
        for k in user:
            if k not in defaults:
                warn(f'package "{name}": unknown option "{k}" (known: {", ".join(defaults) or "none"})')
        opts = deep_merge(defaults, user)
        pkg = Package(name, path, meta, opts)
        hp = path / meta.get('build', 'build.py')
        if meta.get('build') is not False and hp.exists():
            if str(path) not in sys.path:
                sys.path.insert(0, str(path))  # lets build.py import helper modules beside it
            spec = importlib.util.spec_from_file_location('study_pkg_' + re.sub(r'\W', '_', name), hp)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            pkg.hooks = mod
        order.append(pkg)
        state[name] = 'done'

    for name, user in wanted.items():
        if user is False:
            continue
        visit(name, [])
    return order


# --------------------------------------------------------------------------- content files
FRONT_RX = re.compile(r'^\s*<!--\s*page\s*(\{.*?\})\s*-->\s*', re.S)
STYLE_RX = re.compile(r'<style\b[^>]*>.*?</style>\s*', re.S | re.I)


def parse_content(text: str, where: str = '') -> tuple[dict, str, list]:
    """Split a content file into (front-matter dict, body html, [style blocks])."""
    meta = {}
    m = FRONT_RX.match(text)
    if m:
        try:
            meta = json.loads(m.group(1))
        except json.JSONDecodeError as e:
            raise StudyError(f'{where}: front matter is not valid JSON: {e}') from e
        text = text[m.end():]
    styles = STYLE_RX.findall(text)
    body = STYLE_RX.sub('', text)
    return meta, body.strip() + '\n', [s.strip() for s in styles]


def log(msg):
    print(msg, file=sys.stderr)
