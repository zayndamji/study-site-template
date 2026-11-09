# Agent instructions for this study site

This site is built with **study-site-template** (path in `site.json` → `"template"`).
Read this file first, then `memory/MEMORY.md`.

## Commands
Run from this folder. `$T` is the template path from `site.json`.

```bash
python3 $T/tools/study.py build .      # writes dist/ (never edit dist/ by hand)
python3 $T/tools/study.py check .      # verify a fresh temporary build (dist/ is untouched); must print OK
python3 $T/tools/study.py packages     # list features you can switch on
python3 $T/tools/study.py info <name>  # one package's options
python3 $T/tools/study.py serve .      # preview at http://localhost:8000/
```

## Where things live
| Path | What |
|---|---|
| `site.json` | Title, theme, page kinds, groups, **the page list**, enabled packages + options |
| `content/units/<id>.html` | One page's body (sections), with optional front matter |
| `content/<other>/` | Other kinds' pages and package content (e.g. `summaries/`) |
| `custom/site.css`, `custom/site.js` | Site-wide styles/scripts (bundled after packages) |
| `packages/<name>/` | This site's own packages (same format as the template's) |
| `static/` | Files copied as-is into the built site (images, PDFs, data) |
| `memory/` | Project notes for agents: decisions, preferences, progress |
| `dist/` | Build output — generated |

## Adding a page
1. Add an entry to `site.json` → `pages`: `{"id": "04", "title": "…", "label": "short title", "description": "one line", "group": "…"}`.
   Order in the list is reading order; Prev/Next, the page switcher, the home page and footers are generated from it.
2. Create `content/units/04.html` (copy an existing page). Front matter is optional:
   `<!--page {"lede": "…", "eyebrow": "…"} -->`.
3. Write sections as `<section class="note" id="…"><h2><span class="n">01</span> Title</h2>…</section>`.
   Every section needs a unique `id` and an `h2`; the rail and "reviewed" buttons are built from them.
4. Put page-only CSS in a `<style>` block (moved into `<head>`) and widget code in `<script>` blocks
   **after** the markup they use. `Study.*` and package APIs are available immediately.
5. `check` must pass. Then look at the page in a browser at desktop width and at 375 px.

## Components
See the template's `docs/components.md` and the demo site (`study.py new <dir> --demo`) for every
component and package with working markup.

## Rules
- Keep facts faithful to the sources; mark your own additions if the `fidelity` package is on.
- Don't invent page numbers, citations or quotes. If unsure, leave a visible TODO and say so.
- Quiz `data-id`s must be unique across the site (answers are saved by id).
- Don't rename section ids or page ids casually: saved progress is keyed on them.
