# Migrating an existing notes site

Use this when you already have a hand-built multi-page notes site (one HTML file per lecture,
chapter or week, shared CSS/JS, an index page) and want to move it onto the template without
losing URLs or readers' saved progress.

## 1. Inventory

List, for the old site:

- every page file, its title, short label, one-line description and group on the index;
- the shared CSS/JS and what each part does (layout, theme, quizzes, subject-specific widgets);
- **localStorage keys** (prefix, and how page/section/quiz ids form keys);
- anything generated (catalogs, combined pages) and the scripts that generate them.

## 2. Create the site and map the structure

```bash
python3 <template>/tools/study.py new <new-site> --title "…" --noun Lecture
```

In `site.json`:

| Old site | `site.json` |
|---|---|
| file names (`lecture-03.html`) | `kinds.<kind>.file` = `"lecture-{id}.html"` (keeps URLs) |
| storage prefix (`abc:`) | `site.storagePrefix` = `"abc:"` |
| per-page storage id (`ch3`, `03`) | `kinds.<kind>.storageKey` = `"ch{id}"` or per page `"storageKey"` |
| index groups / columns | `groups` |
| index rows | `pages` (title, label, description, group, status) |
| "coming soon" rows | `"status": "planned"` + `coming-later` |
| handouts, guides | a second kind via the `resources` package |

Progress carries over when the prefix, the storage key and the **section ids** match the old ones
(core keys: `reviewed:<unit>`, `total:<unit>`, `quiz:<id>`, `theme`, `last-page`).

## 3. Move the content

For each old page, copy the inside of its `<article>` (or main column) into
`content/<kind folder>/<id>.html`:

- drop the old top bar, rail, footer, `<head>` and script tags for shared files — the build writes those;
- keep page-specific `<style>` and `<script>` blocks (styles are hoisted into `<head>`);
- move the old eyebrow / title / lede into front matter (`"eyebrow"`, `"lede"`) or rely on the defaults;
- delete hand-written Prev/Next links and "N of M" footers — they are generated.

A small script is the safest way to do this for many pages; check one page by eye before running it on all.

## 4. Replace shared code with packages

Match old features to packages (`study.py packages`), enable them, and rename markup where a package
uses different class names. Typical mappings:

| Old feature | Package | Markup change |
|---|---|---|
| summary section at the end of each page + a combined page | `summaries` | move the section's inner HTML to `content/summaries/<id>.html`, leave `<!-- summary -->` |
| citation chips that open source images | `source-viewer` | build a manifest; keep text refs and configure `patterns`, or switch to `sv-chip` buttons |
| page-number citation pills | `cite-pills` | `class="cite" data-page="N"` |
| verbatim quotes, "beyond the source" tags, errata | `fidelity` | `blockquote.quote`, `.beyond`, `.erratum` |
| opener bullets | `one-minute` | `section.one-minute` or front matter `overview` |
| collapsed derivations / quick checks | `focus-layout` | `details.reveal.more`, `details.reveal.check` |
| shared math helpers, plots, 3D views | `math-kit`, `plot-2d`, `view-3d` | old global helper name via `math-kit` option `globalAlias` while scripts are ported |
| preset buttons | `widget-presets` | |
| worked-example cards | `worked-examples` | card CSS comes from the package; delete per-page copies |
| home progress, continue link, description toggle | `home-progress`, `resume-link`, `topic-details` | none |
| "don't mention X" rules | `privacy` | list terms in `forbidFile` |

Code that only one subject needs (a special simulator, colour coding for one notation) becomes a
**site package** in `<new-site>/packages/<name>/`, not part of the template.

## 5. Verify

```bash
python3 <template>/tools/study.py check <new-site>
```

Then, in a browser: compare old and new pages side by side at desktop width and 375 px, click every
widget's presets, and confirm that progress from the old site shows up (same origin required — serve
the new build where the old one was served).
