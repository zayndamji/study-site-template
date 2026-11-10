# study-site-template

A template for interactive, multi-page **study-notes sites**: one page per lecture, chapter or week,
with a section rail, review progress, quizzes, step-by-step derivations, interactive widgets and a
searchable home page. Static HTML/CSS/JS, no framework, no runtime dependencies; the build tool needs
only Python 3.9+.

**Live demo:** the [Probability Notebook](https://zayndamji.github.io/study-site-template/) — original notes on introductory
probability that use every package. Its source is in [`demo/`](demo/).

## Quick start

```bash
python3 tools/study.py new ../my-notebook --title "My Notebook" --noun Chapter
python3 tools/study.py build ../my-notebook
python3 tools/study.py serve ../my-notebook          # http://localhost:8000/
```

See every component and package on placeholder pages (handy for testing):

```bash
python3 tools/study.py new /tmp/demo --demo && python3 tools/study.py serve /tmp/demo
```

## How it fits together

```
study-site-template/            (this repo — shared by every site)
  core/                         always on: layout, theme, rail, progress, boxes, steppers, quizzes, home
  packages/<name>/              optional features, each self-contained and documented
  tools/study.py                new · build · check · packages · info · serve
  templates/                    starter files for new sites, an agent brief
  docs/                         configuration, components, packages, agent workflow

my-notebook/                    (one per course or subject — lives anywhere)
  site.json                     title, theme, page list, groups, packages + options
  content/units/01.html         page bodies (just the sections)
  custom/  packages/  static/   site-specific styles, packages and files
  dist/                         the built site (generated)
```

The build reads `site.json`, wraps each content file in the standard page shell (head, top bar with
page switcher and Prev/Next, section rail, footer), bundles the core plus the enabled packages into
`assets/study.css` and `assets/study.js`, generates the home page, and writes everything to `dist/`.
Nothing that can be generated is written by hand: navigation, the catalog, footers and cache-busting
all come from the page list.

## Packages

| Package | What it adds |
|---|---|
| `summaries` | A summary sheet per page, written once, shown in the page and on a printable all-sheets page |
| `one-minute` | An "in one minute" opener of a few bullets |
| `focus-layout` | Folded derivations and quick checks, expand/collapse all, open-on-link, print unfolded |
| `fidelity` | Verbatim quote blocks, the source's own notes, "beyond the source" tags, erratum boxes |
| `notation` | Colour-coded notation (one colour per kind of symbol, both themes) and truth-table styling |
| `source-viewer` | Citation chips that pop up the cited slide or page image |
| `cite-pills` | Page-number citation pills, optionally linking into a PDF |
| `source-links` | `§ Heading` references that open that heading of a page's online source |
| `worked-examples` | Example cards with folded solutions and "load into widget" buttons |
| `widget-presets` | Annotated preset buttons for any widget |
| `math-kit` | Exact fractions, vector/matrix helpers and matrix rendering |
| `widget-kit` | Layout helpers for widgets: two-column and panel grids, sliders, readouts, legends, tags, callouts |
| `plot-2d` | A coordinate-plane SVG widget with draggable handles |
| `view-3d` | A rotatable 3D SVG viewer |
| `state-machine` | State diagrams from a JSON spec and a step-by-step simulator |
| `code-blocks` | Highlighted code listings with marked lines, line numbers and file-name captions |
| `memory-diagram` | Stack/heap pictures with pointer arrows, trees and arrays, and a code tracer that steps through them |
| `home-progress` | Review meters on the home page |
| `resume-link` | "Continue: …" link to the last page read |
| `topic-details` | Show page descriptions on the home page |
| `coming-later` | Planned pages shown greyed out |
| `preview-pages` | Provisional pages flagged on the home page, with a banner under the title |
| `privacy` | Forbidden-term scanning, noindex, no third-party requests |
| `password-gate` | A copy of the built site behind a password, as a Next.js app ready to upload |
| `content-rules` | A site's own writing rules (forbidden tags and phrases, minimum sections), reported by `check` |

`python3 tools/study.py packages` lists them; `python3 tools/study.py info <name>` shows options.
Sites can add their own packages or override these (`docs/packages.md`).

## Documentation

- [AGENTS.md](AGENTS.md) — start here if you are an AI agent
- [docs/configuration.md](docs/configuration.md) — every `site.json` key
- [docs/components.md](docs/components.md) — core markup
- [docs/packages.md](docs/packages.md) — using and writing packages
- [docs/agent-workflow.md](docs/agent-workflow.md) — from source material to a finished site with agents

## Design principles

- **Content is plain HTML.** No custom syntax to learn; any section can be copied between sites.
- **One source of truth.** The page list in `site.json` drives every list, link and counter.
- **Core stays small.** Anything only some sites want is a package; anything only one site wants is a site package.
- **Readable at 375 px**, light and dark themes, print styles, reduced motion respected.
- **Progress stays with the reader**: reviewed sections and quiz answers live in `localStorage`.

## License

MIT — see [LICENSE](LICENSE).
