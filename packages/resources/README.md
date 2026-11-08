# resources — a second kind of page

## What it does
Registers extra **page kinds** for material that is not part of the main numbered sequence: guides,
handouts, checklists, reference pages. Each kind has its own noun, file names, content folder, eyebrow,
rail title, and switches for review buttons, Prev/Next and numbering. With `homeFilter`, the home page
filters by kind ("Everything / Units / Guides & resources").

## Enable
```json
"packages": { "resources": {} },
"pages": [
  { "id": "01", "title": "First unit" },
  { "id": "style", "kind": "guide", "title": "Style guide", "group": "help" }
]
```
Content goes in `content/guides/style.html`; the page is built as `guide-style.html`.

## Options
| Option | Default | Meaning |
|---|---|---|
| `kinds` | one kind, `guide` | Kind definitions to add (see `docs/configuration.md` → kinds). Define several for several resource types |
| `homeFilter` | `true` | With `home.filters: "auto"`, filter by kind |
| `titleFormat` | `"{title} — {site}"` | Browser title for these pages |
| `footer` | `"{site} · {plural}"` | Footer of these pages |

To rename, e.g. to "Handout": `"resources": {"kinds": {"handout": {"noun": "Handout", "plural": "Handouts", "file": "handout-{id}.html", "source": "handouts/{id}.html", "review": false, "prevNext": false, "numbered": false}}}`.

## Markup
Same as any page. Leave out `<span class="n">` in headings when sections are not numbered.

## Notes for migrating existing notes
Keep old file names by setting the kind's `file` (e.g. `"guide-{id}.html"`) and using the old slug as `id`.
