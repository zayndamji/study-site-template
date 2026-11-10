"""privacy: forbidden-term scanning, noindex, no third-party fonts."""
import re
from pathlib import Path

from studylib.common import StudyError


def _terms(ctx, opts):
    terms = [t for t in (opts['forbid'] or []) if str(t).strip()]
    files = opts['forbidFile'] or []
    for rel in [files] if isinstance(files, str) else files:
        p = ctx.site_dir / rel
        if p.exists():
            terms += [ln.strip() for ln in p.read_text(encoding='utf-8').splitlines() if ln.strip() and not ln.startswith('#')]
        else:
            ctx.warn(f'privacy: forbidFile {rel} not found')
    return terms


# personal details that should never ship: home-folder paths and e-mail addresses
PERSONAL = [
    r"""(?:/Users|/home|\b[A-Za-z]:\\Users)[/\\][^/\\\s"'<>]+""",
    # an e-mail address, but not a retina file name such as icon@2x.png
    r'\b[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.(?!(?:png|jpe?g|gif|webp|avif|svg|ico|css|js|json|html?)\b)[A-Za-z]{2,}\b',
]


def _patterns(ctx, opts):
    """One regex for everything forbidden: terms (escaped; whole words if wholeWords), forbidPatterns
    (regular expressions as written) and, with forbidPersonal, paths and e-mail addresses."""
    parts = []
    for t in _terms(ctx, opts):
        e = re.escape(t)
        parts.append(rf'(?<!\w){e}(?!\w)' if opts.get('wholeWords') else e)
    for i, pat in enumerate(opts.get('forbidPatterns') or []):
        try:
            re.compile(pat)
        except re.error as err:
            ctx.warn(f'privacy: forbidPatterns[{i}] is not a valid regular expression ({err}); ignored')
            continue
        parts.append(f'(?:{pat})')
    if opts.get('forbidPersonal'):
        parts += PERSONAL
    return re.compile('|'.join(parts), re.I) if parts else None


def _scan(rx, items):
    if rx is None:
        return []
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
    rx = _patterns(ctx, opts)
    items = list(outputs.items()) + [(k, v.decode('utf-8', 'replace')) for k, v in ctx.extra_assets.items()]
    hits = _scan(rx, items + _sources(ctx, opts))
    if hits:
        raise StudyError('forbidden terms found (privacy package):\n  ' + '\n  '.join(hits[:40]) +
                         (f'\n  … and {len(hits) - 40} more' if len(hits) > 40 else ''))


def check(ctx, opts, outputs):
    rx = _patterns(ctx, opts)
    items = list(outputs.items()) + [(k, v.decode('utf-8', 'replace')) for k, v in ctx.extra_assets.items()]
    return _scan(rx, items + _sources(ctx, opts))
