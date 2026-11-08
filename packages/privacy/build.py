"""privacy: forbidden-term scanning, noindex, no third-party fonts."""
import re
from pathlib import Path

from studylib.common import StudyError


def _terms(ctx, opts):
    terms = [t for t in (opts['forbid'] or []) if str(t).strip()]
    if opts['forbidFile']:
        p = ctx.site_dir / opts['forbidFile']
        if p.exists():
            terms += [ln.strip() for ln in p.read_text(encoding='utf-8').splitlines() if ln.strip() and not ln.startswith('#')]
        else:
            ctx.warn(f'privacy: forbidFile {opts["forbidFile"]} not found')
    return terms


def _scan(terms, items):
    if not terms:
        return []
    rx = re.compile('|'.join(re.escape(t) for t in terms), re.I)
    hits = []
    for name, text in items:
        for m in rx.finditer(text):
            line = text.count('\n', 0, m.start()) + 1
            hits.append(f'privacy: "{m.group(0)}" in {name}:{line}')
    return hits


def _sources(ctx, opts):
    if not opts['scanSources']:
        return []
    out = []
    pk = ctx.site_dir / ctx.config['build'].get('packagesDir', 'packages')
    for d in (ctx.content_dir, ctx.site_dir / 'custom', pk):
        if d.exists():
            for f in sorted(d.rglob('*')):
                if f.is_file() and f.suffix in ('.html', '.css', '.js', '.json', '.md', '.txt', '.py'):
                    out.append((str(f.relative_to(ctx.site_dir)), f.read_text(encoding='utf-8', errors='replace')))
    return out


def configure(ctx, opts):
    if opts['localFonts']:
        ctx.config['theme']['fonts']['css'] = [u for u in (ctx.config['theme']['fonts'].get('css') or [])
                                                if not re.match(r'https?://', u)]


def head(ctx, opts, page):
    bits = []
    if opts['noindex']:
        bits.append('<meta name="robots" content="noindex, nofollow">')
    if opts['noReferrer']:
        bits.append('<meta name="referrer" content="no-referrer">')
    return '\n'.join(bits)


def finalize(ctx, opts, outputs):
    if not opts['failBuild']:
        return
    terms = _terms(ctx, opts)
    items = list(outputs.items()) + [(k, v.decode('utf-8', 'replace')) for k, v in ctx.extra_assets.items()]
    hits = _scan(terms, items + _sources(ctx, opts))
    if hits:
        raise StudyError('forbidden terms found (privacy package):\n  ' + '\n  '.join(hits[:40]) +
                         (f'\n  … and {len(hits) - 40} more' if len(hits) > 40 else ''))


def check(ctx, opts, outputs):
    terms = _terms(ctx, opts)
    items = list(outputs.items()) + [(k, v.decode('utf-8', 'replace')) for k, v in ctx.extra_assets.items()]
    problems = _scan(terms, items + _sources(ctx, opts))
    return problems
