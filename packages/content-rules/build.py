"""content-rules: site-specific writing rules checked by `study.py check`.

Everything is configured in site.json; with the defaults the package checks nothing.
Rules run on each built page's <article> (the page body, not the top bar, rail or footer).
"""
from __future__ import annotations

import re
from html.parser import HTMLParser

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}
ALWAYS_SKIP = ['script', 'style', 'svg', 'template', 'textarea']


def _parse_simple(sel):
    """'tag', '.cls', 'tag.cls', 'tag.a.b' → (tag or None, {classes})."""
    m = re.match(r'^([a-zA-Z][\w-]*)?((?:\.[\w-]+)*)$', sel.strip())
    if not m or not sel.strip():
        return None
    return (m.group(1) or None), set(c for c in m.group(2).split('.') if c)


def _matches(simple, tag, classes):
    t, cls = simple
    return (t is None or t == tag) and cls <= classes


class _Prose(HTMLParser):
    """Collects the readable text of the <article>, twice: once without the `exclude` elements and
    once also without the `quotes` elements. Also counts tags and quiz questions/explanations."""

    def __init__(self, exclude, quotes):
        super().__init__(convert_charrefs=True)
        self.exclude, self.quotes = exclude, quotes
        self.stack = []            # (tag, excluded, quoted)
        self.in_article = 0
        self.text_all, self.text_out = [], []
        self.tags = []             # (tag, line)
        self.sections = 0
        self.questions = self.explanations = 0

    def _flags(self):
        return (self.stack[-1][1], self.stack[-1][2]) if self.stack else (False, False)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        classes = set((a.get('class') or '').split())
        if tag == 'article':
            self.in_article += 1
        if self.in_article:
            self.tags.append((tag, self.getpos()[0]))
            if tag == 'section' and 'note' in classes:
                self.sections += 1
            if 'q' in classes and 'data-answer' in a:
                self.questions += 1
            if tag == 'template' and 'q-explain' in classes:
                self.explanations += 1
        if tag in VOID:
            return
        ex, qu = self._flags()
        ex = ex or tag in ALWAYS_SKIP or any(_matches(s, tag, classes) for s in self.exclude)
        qu = qu or any(_matches(s, tag, classes) for s in self.quotes)
        self.stack.append((tag, ex, qu))

    def handle_startendtag(self, tag, attrs):
        if self.in_article:
            self.tags.append((tag, self.getpos()[0]))

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break
        if tag == 'article' and self.in_article:
            self.in_article -= 1

    def handle_data(self, data):
        if not self.in_article:
            return
        ex, qu = self._flags()
        if ex:
            return
        self.text_all.append(data)
        if not qu:
            self.text_out.append(data)


def _selectors(ctx, opts, key):
    out = []
    for s in opts.get(key) or []:
        p = _parse_simple(str(s))
        if p is None:
            ctx.warn(f'content-rules: {key} entry {s!r} is not a simple selector (tag, .class or tag.class); ignored')
        else:
            out.append(p)
    return out


def configure(ctx, opts):
    rules = []
    for i, r in enumerate(opts.get('prose') or []):
        if not isinstance(r, dict) or not r.get('pattern'):
            ctx.warn(f'content-rules: prose[{i}] needs a "pattern"; ignored')
            continue
        try:
            rx = re.compile(r['pattern'], 0 if r.get('caseSensitive') else re.I)
        except re.error as e:
            ctx.warn(f'content-rules: prose[{i}] pattern is not a valid regular expression ({e}); ignored')
            continue
        rules.append({'rx': rx, 'message': r.get('message') or f'matches {r["pattern"]!r}',
                      'outsideQuotes': bool(r.get('outsideQuotes')), 'kinds': r.get('kinds'), 'pages': r.get('pages')})
    opts['_rules'] = rules


def _context(text, m, before=50, after=40):
    return text[max(0, m.start() - before):m.end() + after].strip()


def check(ctx, opts, outputs):
    exclude = _selectors(ctx, opts, 'proseExclude')
    quotes = _selectors(ctx, opts, 'quotes')
    forbid = {str(t).lower(): msg for t, msg in (opts.get('forbidTags') or {}).items()}
    kinds = opts.get('kinds')
    problems = []
    for page in ctx.ready_pages():
        if kinds is not None and page['kind'] not in kinds:
            continue
        rel = page['file']
        html = outputs.get(rel)
        if html is None:
            continue
        p = _Prose(exclude, quotes)
        p.feed(html)
        p.close()
        for tag, line in p.tags:
            if tag in forbid:
                problems.append(f'{rel}: line {line}: <{tag}>: {forbid[tag] or "not allowed (content-rules forbidTags)"}')
        if opts.get('minSections') and p.sections < int(opts['minSections']):
            problems.append(f'{rel}: only {p.sections} section.note element(s) (content-rules minSections {opts["minSections"]})')
        if opts.get('quizExplanations') and p.questions != p.explanations:
            problems.append(f'{rel}: {p.questions} quiz question(s) but {p.explanations} <template class="q-explain"> '
                            'explanation(s) (content-rules quizExplanations)')
        t_all = re.sub(r'\s+', ' ', ' '.join(p.text_all))
        t_out = re.sub(r'\s+', ' ', ' '.join(p.text_out))
        for r in opts.get('_rules') or []:
            if r['kinds'] is not None and page['kind'] not in r['kinds']:
                continue
            if r['pages'] is not None and page['id'] not in [str(x) for x in r['pages']]:
                continue
            text = t_out if r['outsideQuotes'] else t_all
            for m in r['rx'].finditer(text):
                problems.append(f'{rel}: {r["message"]}: …{_context(text, m)}…')
    return problems
