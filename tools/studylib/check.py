"""`study.py check`: build the site into a temporary folder, then verify the output and the sources.

The check build never touches the site's own output folder and does not copy static/ (static files
are looked up in the site), so several checks can run at once and a large static/ costs nothing.

Checks (each problem is printed as `file: message`; exit status 1 if any):
  - every HTML page parses with balanced block tags and has unique element ids
  - local links and #anchors resolve; local images/scripts/styles exist
  - inline scripts and the bundle pass `node --check` (skipped if node is missing)
  - quizzes have data-id (unique across the site) and every question's answer is an option
  - steppers contain an ol.steps with items; sections have an id and an h2
  - content files that no page uses
  - unfilled placeholders (%%name%% or {{name}}) left in page text
  - each package's own check() hook
"""
from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

from .build import Ctx, build
from .common import log

BLOCK = {'div', 'section', 'article', 'details', 'summary', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr',
         'td', 'th', 'nav', 'header', 'footer', 'main', 'figure', 'figcaption', 'blockquote', 'p', 'span',
         'button', 'label', 'select', 'template', 'svg', 'g', 'a', 'h1', 'h2', 'h3', 'h4', 'pre', 'code'}
PLACEHOLDER = re.compile(r'%%\w+%%|\{\{\s*\w+\s*\}\}')
_SCRIPTS = re.compile(r'<(script|style|template)\b.*?</\1>', re.S | re.I)


def _text_only(html):
    """The page without scripts, styles and templates (code may legitimately contain {{ }})."""
    return _SCRIPTS.sub('', html)


VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.problems = [], []
        self.ids, self.links, self.assets, self.scripts = [], [], [], []
        self.quizzes, self.steppers, self.sections = [], [], []
        self._script, self._in_script = None, False
        self._q = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get('id'):
            self.ids.append(a['id'])
        cls = (a.get('class') or '').split()
        if tag == 'a' and a.get('href'):
            self.links.append(a['href'])
        if tag in ('img', 'source') and a.get('src'):
            self.assets.append(a['src'])
        if tag == 'link' and a.get('href') and a.get('rel') in ('stylesheet', 'icon'):
            self.assets.append(a['href'])
        if tag == 'script':
            if a.get('src'):
                self.assets.append(a['src'])
            elif a.get('type') in (None, '', 'text/javascript', 'module'):
                self._in_script, self._script = True, []
        if 'quiz' in cls:
            self.quizzes.append({'id': a.get('data-id'), 'qs': [], 'line': self.getpos()[0]})
        if 'q' in cls and self.quizzes:
            self._q = {'answer': a.get('data-answer'), 'opts': []}
            self.quizzes[-1]['qs'].append(self._q)
        if tag == 'button' and self._q is not None and 'data-v' in a:
            self._q['opts'].append(a['data-v'])
        if 'stepper' in cls:
            self.steppers.append({'line': self.getpos()[0], 'steps': 0, 'depth': len(self.stack)})
        if tag == 'li' and self.steppers and 'steps' in self._parent_classes():
            self.steppers[-1]['steps'] += 1
        if tag == 'section' and 'note' in cls:
            self.sections.append({'id': a.get('id'), 'line': self.getpos()[0], 'h2': False})
        if tag == 'h2' and self.sections:
            self.sections[-1]['h2'] = True
        if tag in BLOCK and tag not in VOID:
            self.stack.append((tag, self.getpos()[0], cls))

    def _parent_classes(self):
        return self.stack[-1][2] if self.stack else []

    def handle_startendtag(self, tag, attrs):
        a = dict(attrs)
        if a.get('id'):
            self.ids.append(a['id'])
        if tag in ('img', 'source') and a.get('src'):
            self.assets.append(a['src'])
        if tag == 'link' and a.get('href') and a.get('rel') in ('stylesheet', 'icon'):
            self.assets.append(a['href'])

    def handle_endtag(self, tag):
        if tag == 'script' and self._in_script:
            self.scripts.append((''.join(self._script), self.getpos()[0]))
            self._in_script = False
        if tag not in BLOCK or tag in VOID:
            return
        if not self.stack:
            self.problems.append(f'line {self.getpos()[0]}: stray </{tag}>')
            return
        if self.stack[-1][0] == tag:
            self.stack.pop()
        elif any(t == tag for t, _, _ in self.stack):
            while self.stack and self.stack[-1][0] != tag:
                t, line, _ = self.stack.pop()
                if t not in ('p', 'li', 'td', 'th', 'tr', 'thead', 'tbody'):  # implicitly closed in HTML
                    self.problems.append(f'line {line}: <{t}> not closed before </{tag}> (line {self.getpos()[0]})')
            self.stack.pop()
        else:
            self.problems.append(f'line {self.getpos()[0]}: </{tag}> without a matching open tag')

    def handle_data(self, data):
        if self._in_script:
            self._script.append(data)


def _node_check(code: str, label: str):
    node = shutil.which('node')
    if not node:
        return None
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
        f.write(code)
        name = f.name
    try:
        r = subprocess.run([node, '--check', name], capture_output=True, text=True, timeout=60)
    finally:
        Path(name).unlink(missing_ok=True)
    if r.returncode:
        msg = (r.stderr or r.stdout).strip().splitlines()
        detail = next((ln for ln in msg if 'Error' in ln), msg[-1] if msg else 'syntax error')
        return f'{label}: script syntax error: {detail}'
    return None


def run_checks(site_dir: Path, rebuild=True, page=None) -> int:
    """page: only report problems in the output file(s) of this page id (the whole site is still
    built, so links into other pages are checked)."""
    tmp = None
    try:
        if rebuild:
            tmp = tempfile.mkdtemp(prefix='study-check-')
        return _run(site_dir, tmp, page)
    finally:
        if tmp:
            shutil.rmtree(tmp, ignore_errors=True)


def _run(site_dir: Path, tmp, page) -> int:
    if tmp:
        ctx = build(site_dir, quiet=True, out_dir=tmp, copy_static=False)
    else:
        ctx = Ctx(site_dir)
        for f in ctx.out_dir.rglob('*.html'):
            ctx.outputs[str(f.relative_to(ctx.out_dir))] = f.read_text(encoding='utf-8')
    out = ctx.out_dir
    problems: list[str] = []
    parsed: dict[str, Page] = {}
    for rel, text in sorted(ctx.outputs.items()):
        if not rel.endswith('.html'):
            continue
        p = Page()
        try:
            p.feed(text)
            p.close()
        except Exception as e:  # parser errors are rare but should not crash the checker
            problems.append(f'{rel}: could not parse ({e})')
            continue
        parsed[rel] = p
        problems += [f'{rel}: {m}' for m in p.problems]
        for t, line, _ in p.stack:
            if t not in ('p', 'li', 'td', 'th', 'tr', 'thead', 'tbody'):
                problems.append(f'{rel}: line {line}: <{t}> never closed')
        seen = set()
        for i in p.ids:
            if i in seen:
                problems.append(f'{rel}: duplicate id "{i}"')
            seen.add(i)
        for s in p.sections:
            if not s['id']:
                problems.append(f'{rel}: line {s["line"]}: section.note without an id (the rail and review need one)')
            if not s['h2']:
                problems.append(f'{rel}: line {s["line"]}: section.note without an h2')
        for m in PLACEHOLDER.finditer(_text_only(text)):
            problems.append(f'{rel}: unfilled placeholder "{m.group(0)}"')
        for st in p.steppers:
            if not st['steps']:
                problems.append(f'{rel}: line {st["line"]}: .stepper has no ol.steps > li items')
        for i, (code, line) in enumerate(p.scripts):
            if code.strip():
                r = _node_check(code, f'{rel}: inline script ending line {line}')
                if r:
                    problems.append(r)
    # quizzes: ids unique across the site (answers are stored by id)
    quiz_ids: dict[str, str] = {}
    for rel, p in parsed.items():
        for q in p.quizzes:
            if not q['id']:
                problems.append(f'{rel}: line {q["line"]}: .quiz without data-id (answers cannot be saved)')
                continue
            if q['id'] in quiz_ids:
                problems.append(f'{rel}: quiz id "{q["id"]}" also used in {quiz_ids[q["id"]]}')
            quiz_ids[q['id']] = rel
            for j, qq in enumerate(q['qs']):
                if qq['answer'] is None:
                    problems.append(f'{rel}: quiz "{q["id"]}" question {j + 1} has no data-answer')
                elif qq['opts'] and qq['answer'] not in qq['opts']:
                    problems.append(f'{rel}: quiz "{q["id"]}" question {j + 1}: answer "{qq["answer"]}" is not one of its options')
    # links, anchors, assets
    ids_by_page = {rel: set(p.ids) for rel, p in parsed.items()}
    for rel, p in parsed.items():
        base = Path(rel).parent
        for href in p.links + p.assets:
            u = urlsplit(href)
            if u.scheme or href.startswith('//') or href.startswith('mailto:') or href.startswith('javascript:'):
                continue
            target = str((base / unquote(u.path)).as_posix()) if u.path else rel
            target = re.sub(r'(^|/)\./', r'\1', target)
            exists = target in ctx.outputs or (out / target).exists() or (ctx.static_dir / target).exists()
            if u.path and not exists:
                problems.append(f'{rel}: broken link/asset "{href}"')
                continue
            if u.fragment and target in ids_by_page and unquote(u.fragment) not in ids_by_page[target]:
                problems.append(f'{rel}: link "{href}" points to a missing #{u.fragment}')
    # the bundle
    bundle = out / 'assets' / 'study.js'
    if bundle.exists():
        r = _node_check(bundle.read_text(encoding='utf-8'), 'assets/study.js')
        if r:
            problems.append(r)
    # unused content files
    used = {ctx.content_dir / p['source'] for p in ctx.pages}
    pk_dirs = {ctx.content_dir / (p.options.get('dir') or '') for p in ctx.packages if p.options.get('dir')}
    for kd in {(ctx.content_dir / p['source']).parent for p in ctx.pages}:
        if kd.exists() and kd not in pk_dirs:
            for f in kd.glob('*.html'):
                if f not in used:
                    problems.append(f'{f.relative_to(ctx.site_dir)}: not listed in site.json "pages"')
    for found in ctx.call('check', ctx.outputs):
        problems += list(found)
    if page is not None:
        files = {p['file'] for p in ctx.pages if p['id'] == str(page)}
        sources = {str(Path(ctx.config['build']['contentDir']) / p['source']) for p in ctx.pages if p['id'] == str(page)}
        if not files:
            print(f'error: no page with id "{page}"')
            return 2
        problems = [pr for pr in problems if pr.split(':', 1)[0] in files | sources]
        parsed = {rel: p for rel, p in parsed.items() if rel in files}
    if shutil.which('node') is None:
        log('note: node not found; script syntax checks skipped')
    for pr in problems:
        print(pr)
    n = len(parsed)
    if problems:
        print(f'\n{len(problems)} problem(s) in {n} page(s).')
        return 1
    print(f'OK: {n} page(s), {len(quiz_ids)} quiz(zes), {len(ctx.packages)} package(s), no problems.')
    return 0
