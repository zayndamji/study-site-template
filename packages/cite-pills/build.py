"""cite-pills build hooks: optionally report citations that have no page."""
import re

TAG = re.compile(r'<(span|td|a)\b([^>]*\bclass="[^"]*\bcite\b[^"]*"[^>]*)>', re.I)
PAGE_CHILD = re.compile(r'class="[^"]*\b(?:pg|cp-pg)\b')


def check(ctx, opts, outputs):
    if not opts.get('requirePage'):
        return []
    problems = []
    for rel, html in sorted(outputs.items()):
        if not rel.endswith('.html'):
            continue
        for m in TAG.finditer(html):
            if 'data-page=' in m.group(2):
                continue
            end = html.find(f'</{m.group(1)}', m.end())
            inner = html[m.end():end if end >= 0 else m.end()]
            if PAGE_CHILD.search(inner):
                continue
            line = html.count('\n', 0, m.start()) + 1
            text = re.sub(r'<[^>]+>', '', inner).strip()[:40]
            problems.append(f'{rel}: line {line}: citation "{text}" has no page (cite-pills requirePage)')
    return problems
