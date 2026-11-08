# Writing and using packages

A **package** is one optional feature. The core (layout, theme, section rail,
review progress, boxes, steppers, quizzes, home catalog) is always on; every
other feature lives in `packages/<name>/` and is switched on per site in
`site.json`:

```json
"packages": {
  "summaries": { "title": "Review sheets" },
  "cite-pills": {}
}
```

A value of `{}` (or `true`) enables a package with its default options. Order
matters only for CSS/JS cascade; dependencies listed in `requires` are added
automatically, before the package that needs them.

The build looks for a package first in the site's own `packages/` folder (set by
`build.packagesDir`), then in this template's `packages/`. A site can therefore
**add** its own packages, or **override** a template package by giving its copy
the same name.

Run `python3 tools/study.py packages` to list packages and
`python3 tools/study.py info <name>` to see one package's options.

## Folder layout

```
packages/<name>/
  package.json    required: metadata, assets, options (with defaults)
  README.md       required: what it does, how to enable, options, markup, JS API
  example.html    required: a content fragment that demonstrates the package
                  (used by `study.py new --demo` and by the checker)
  <name>.css      optional browser styles   (listed in package.json "css")
  <name>.js       optional browser script   (listed in package.json "js")
  build.py        optional build hooks      (see below)
```

### package.json

```json
{
  "name": "cite-pills",
  "title": "Citation pills",
  "description": "One line: what the reader sees.",
  "category": "sources",            // content | sources | navigation | home | widgets | site
  "version": "1.0.0",
  "requires": [],                    // other package names
  "css": ["cite-pills.css"],
  "js": ["cite-pills.js"],
  "build": "build.py",              // omit if there are no hooks
  "options": {
    "label": { "default": "p. {page}", "description": "Pill text after the citation; {page} is replaced." }
  }
}
```

Every option **must** have a `default` and a `description`. Mark an option `"private": true` to keep it out of the browser bundle (packages without JS never ship options to the browser). Users override any
subset; unknown keys produce a build warning. The merged options reach the
browser as `Study.options('<name>')` and the build hooks as `opts`.

## Browser side

All packages' CSS and JS are bundled, in order, into `assets/study.css` and
`assets/study.js`, after the core and before the site's `custom/site.css|js`.
`study.js` loads in `<head>`, so inline page scripts can call package APIs as
soon as they run.

```js
(function () {
  'use strict';
  const opts = Study.options('my-package');
  // optional public API for page scripts:
  Study.myPackage = { doThing() { … } };
  Study.define('my-package', {
    init(S) { /* once, after DOMContentLoaded and after core init */ },
    enhance(root, S) { /* on the document at start, and on any content
                          passed to Study.enhance(el) later. Must be idempotent:
                          mark processed nodes (e.g. data-enhanced) and skip them. */ },
  });
})();
```

Rules:

- **No hard-coded reader-facing text.** Every label comes from an option.
- **Prefix CSS classes and storage keys** with something owned by the package
  (e.g. `.sv-` for source-viewer, `Study.store.set('summaries:filter', …)`). The
  core already prefixes all keys with the site's `storagePrefix`.
- **Use the core tokens** (`var(--term)`, `var(--rule)`, …) so themes and dark
  mode work. Provide print rules where it matters.
- **No external network requests** and no libraries from CDNs. Vanilla JS only.
- **Work at 375 px wide** with no horizontal page scroll.
- Respect `prefers-reduced-motion`.

## Build side (`build.py`)

Every hook is optional. Each receives `ctx` (the build context) and `opts` (the
package's merged options) first.

| Hook | Called | Return |
|---|---|---|
| `configure(ctx, opts)` | once, before pages are read; may edit `ctx.config` (e.g. add a page kind to `ctx.config['kinds']`, set `ctx.config['nav']['showPlanned']`) | — |
| `head(ctx, opts, page)` | per document; `page` is `None` for home and package pages | HTML for `<head>` |
| `topbar(ctx, opts, page)` | per document | HTML inserted before Prev/Next |
| `content(ctx, opts, page, html)` | per unit page, before layout | the new body HTML |
| `home_intro(ctx, opts)` | home page intro line | HTML |
| `home_tools(ctx, opts)` | home page toolbar (after search and filters) | HTML |
| `home_row(ctx, opts, page, row)` | every catalog entry; `row` is the default `<li>` or `None` for pages that are not `ready` | replacement HTML, or `None` to keep `row` |
| `home_after(ctx, opts)` | after the catalog | HTML |
| `extra_pages(ctx, opts)` | once | list of `(relative_path, html)` |
| `finalize(ctx, opts, outputs)` | once; `outputs` maps path → HTML and may be edited in place | — |
| `check(ctx, opts, outputs)` | by `study.py check` | list of problem strings |

Useful `ctx` members:

- `ctx.config` (merged site.json), `ctx.kinds`, `ctx.groups`, `ctx.pages`,
  `ctx.ready_pages(kind=None)`, `ctx.page_vals(page)` (template variables
  `{id} {title} {label} {noun} {short} {plural} {group} {site} {position} {count}`).
- `ctx.site_dir`, `ctx.content_dir`, `ctx.out_dir`, `ctx.packages`, `ctx.has('name')`,
  `ctx.option('pkg', 'key')`.
- `ctx.read_content(rel)` → `(front_matter, body_html, style_blocks)` for a file under `content/`.
- `ctx.render_document(title=…, main=…, kind=…, page_id=…, rail=True, rail_title=…, head=…, …)`
  wraps HTML in the standard shell (head, top bar, rail, footer) for package-made pages.
- `ctx.esc(s)`, `ctx.fmt(template, **vals)` (missing fields stay as `{field}`),
  `ctx.warn(msg)`, `ctx.extra_assets[path] = bytes` (extra files to write).
- Raise `StudyError` (from `studylib.common`) for problems the author must fix.

Each page dict has: `id kind title label description group status file href source
storageKey num keywords`, any extra keys from site.json, and `meta` (the page's
front matter) once it has been read.

## Checklist for a new package

1. `package.json` with every option documented and defaulted.
2. `README.md` sections: *What it does*, *Enable*, *Options*, *Markup*, *JavaScript API*
   (if any), *Notes for migrating existing notes* (if any).
3. `example.html` that exercises every option-free feature, using only generic
   placeholder content.
4. `python3 tools/study.py new /tmp/x --demo && python3 tools/study.py check /tmp/x` passes.
