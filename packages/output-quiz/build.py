"""output-quiz build hooks: check that every widget has a site-unique data-id, a listing and an expected answer."""
from html.parser import HTMLParser


def _classes(attrs):
    return (dict(attrs).get('class') or '').split()


class _Scan(HTMLParser):
    """Collect .oq widgets (id, line, has a <pre>, expected text) and core .quiz ids."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.widgets = []
        self.quiz_ids = []
        self._open = []          # stack of [widget, div depth inside it]
        self._template = 0       # depth inside <template> (its content is not part of the widget)
        self._expected = None    # widget whose expected <script> is being read

    def handle_starttag(self, tag, attrs):
        cls = _classes(attrs)
        a = dict(attrs)
        if tag == 'template':
            self._template += 1
            return
        if self._template:
            return
        if tag == 'div':
            if 'quiz' in cls and 'widget' in cls and a.get('data-id'):
                self.quiz_ids.append(a.get('data-id'))
            if 'oq' in cls:
                w = {'id': a.get('data-id'), 'line': self.getpos()[0], 'pre': False,
                     'expected': a.get('data-expected'), 'value': a.get('data-mode') == 'value'}
                self.widgets.append(w)
                self._open.append([w, 0])
            elif self._open:
                self._open[-1][1] += 1
            return
        if not self._open:
            return
        w = self._open[-1][0]
        if tag == 'pre':
            w['pre'] = True
        elif tag == 'script' and 'oq-expected' in cls:
            w['expected'] = (w['expected'] or '')
            self._expected = w

    def handle_endtag(self, tag):
        if tag == 'template':
            self._template = max(0, self._template - 1)
            return
        if self._template:
            return
        if tag == 'script':
            self._expected = None
        if tag == 'div' and self._open:
            if self._open[-1][1] == 0:
                self._open.pop()
            else:
                self._open[-1][1] -= 1

    def handle_data(self, data):
        if self._expected is not None:
            self._expected['expected'] += data


def check(ctx, opts, outputs):
    problems = []
    seen = {}
    scans = {}
    for rel, html in sorted(outputs.items()):
        if rel.endswith('.html') and ('oq' in html or 'quiz' in html):
            p = _Scan()
            p.feed(html)
            p.close()
            scans[rel] = p
    quiz_ids = {}
    for rel, p in scans.items():
        for q in p.quiz_ids:
            quiz_ids.setdefault(q, rel)
    for rel, p in scans.items():
        for w in p.widgets:
            where = f'{rel}: line {w["line"]}: output-quiz'
            name = f'"{w["id"]}"' if w['id'] else '(no data-id)'
            if not w['id']:
                problems.append(f'{where} without data-id (answers cannot be saved)')
            elif w['id'] in seen:
                problems.append(f'{where} id "{w["id"]}" also used in {seen[w["id"]]}')
            else:
                seen[w['id']] = rel
                if w['id'] in quiz_ids:
                    problems.append(f'{where} id "{w["id"]}" is also a quiz id in {quiz_ids[w["id"]]} (both report quiz:answer)')
            if not w['pre']:
                problems.append(f'{where} {name} has no code listing (<pre>)')
            if w['expected'] is None:
                problems.append(f'{where} {name} has no expected answer (<script type="text/plain" class="oq-expected"> or data-expected)')
            elif w['value'] and not w['expected'].strip():
                problems.append(f'{where} {name} (value mode) has an empty expected value')
    return problems
