# summaries — summary sheets

## What it does
Each page can have a **summary sheet**: a short HTML fragment kept in its own file
(`content/summaries/<id>.html`). The build

1. inserts the sheet into its page as a section (at a `<!-- summary -->` marker, or at the end), with a link to
2. an **all-sheets page** (`summaries.html`) that gathers every sheet, grouped like the home page, with a section rail, group filter buttons and a Print button.

Write each sheet once; both places always match.

## Enable
```json
"packages": { "summaries": {} }
```

## Options
| Option | Default | Meaning |
|---|---|---|
| `dir` | `"summaries"` | Folder under `content/` that holds sheets |
| `source` | `"{id}.html"` | Sheet file for pages of the main (first) kind |
| `otherSource` | `"{kind}-{id}.html"` | Sheet file for pages of other kinds |
| `kinds` | `null` | Kinds that get sheets; `null` = all |
| `require` | `false` | Warn when a ready page has no sheet |
| `sectionTitle` / `sectionNumber` / `sectionId` | `"Summary sheet"` / `"∗"` / `"summary"` | The inserted section's heading, rail number and anchor |
| `reviewable` | `true` | Inserted section gets a "Mark as reviewed" button |
| `marker` | `"<!-- summary -->"` | Where to insert the sheet |
| `page` | `true` | Build the all-sheets page |
| `file`, `title`, `eyebrow`, `intro`, `railTitle` | … | All-sheets page file name and text |
| `anchor` / `otherAnchor` | `"s-{kind}-{id}"` | Each sheet's anchor on the all-sheets page |
| `backLink` | `"All summary sheets →"` | Link under each inserted sheet; `""` to omit |
| `notesLink`, `extraLinks` | `"Full notes"`, `[]` | Links from each sheet on the all-sheets page back to its page, e.g. `[{"label":"Self-test","anchor":"selftest"}]` |
| `filters`, `allLabel` | `true`, `"All"` | Group filter buttons |
| `printLabel` | `"Print"` | Print button; `""` to omit |
| `homeLink` | `"Summary sheets ↗"` | Link on the home intro line; `""` to omit |
| `topbarLink` | `""` | Link in every top bar; `""` to omit |

## Markup
Page (`content/units/03.html`):
```html
<section class="note" id="ideas">…</section>
<!-- summary -->
<section class="note" id="selftest">…</section>
```
Sheet (`content/summaries/03.html`): any HTML fragment, no `<section>` wrapper needed.

Styles a sheet needs must be in a package or `custom/site.css`, not in one page's `<style>`,
because the sheet also appears on the all-sheets page.

## JavaScript API
None. The all-sheets page remembers its filter in `Study.store` key `summaries:filter`.

## Notes for migrating existing notes
- Move an inline summary section's inner HTML into `content/summaries/<id>.html` and replace the section with the marker.
- If the old combined page used its own anchors (e.g. `#x03`), set `anchor` (e.g. `"x{id}"`) so old links still land.
- `study.py check` reports sheet files that match no page.
