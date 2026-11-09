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
| `sectionTitle` / `sectionNumber` / `sectionId` | `"Summary sheet"` / `"∗"` / `"summary"` | The inserted section's heading, rail number and anchor. `sectionNumber: "auto"` = the number after the last numbered section before it (`04` → `05`); front matter `"summaryNumber"` overrides it per page |
| `sectionSource` | `""` | Optional source line under the inserted sheet's heading (fields below); `""` = none |
| `sourceComment` | `"source"` | A sheet may start with `<!-- source: … -->`; its text becomes `{source}`. Set the word (e.g. `"refs"`), or `""` to ignore such comments |
| `sourceSeparator` | `" · "` | Separator between the parts of source lines |
| `boxed` | `true` | Draw each sheet in a bordered box; `false` leaves it unboxed, and the all-sheets page separates sheets with a rule |
| `reviewable` | `true` | Inserted section gets a "Mark as reviewed" button |
| `marker` | `"<!-- summary -->"` | Where to insert the sheet |
| `page` | `true` | Build the all-sheets page |
| `file`, `title`, `eyebrow`, `intro`, `railTitle` | … | All-sheets page file name and text |
| `anchor` / `otherAnchor` | `"s-{kind}-{id}"` | Each sheet's anchor on the all-sheets page |
| `backLink` | `"All summary sheets →"` | Link under each inserted sheet; `""` to omit |
| `backLinkPlacement` | `"below"` | `"below"` the sheet, or `"source"`: at the end of the source line |
| `notesLink`, `extraLinks` | `"Full notes"`, `[]` | Links from each sheet on the all-sheets page back to its page, e.g. `[{"label":"Self-test","anchor":"selftest"}]` |
| `entrySource` | `"{noun} {badge}{sourceSep}"` | Start of each sheet's line on the all-sheets page, before those links |
| `filters`, `allLabel` | `true`, `"All"` | Group filter buttons |
| `filterSets` | `[]` | Extra buttons that each show several groups, e.g. `[{"id": "first-half", "label": "First half", "groups": ["part-1", "part-2"]}]` |
| `groupFilterLabel` | `"{title}"` | A group button's label unless the group has `filterLabel`; fields `{title}` `{range}` (e.g. `"{title} · {range}"` → "Part one · 01–04") |
| `groupHeadings` | `false` | A heading above each group's sheets: the group title and its `sheetNote` (or `note`) |
| `filterAria` | `"Filter sheets"` | Accessible name of the filter buttons |
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
Sheet (`content/summaries/03.html`): any HTML fragment, no `<section>` wrapper needed. It may start
with a source comment, shown in the source lines:
```html
<!-- source: pp. 12–15 -->
<p>…</p>
```

Fields for `sectionSource` and `entrySource`: the page fields (`{noun}` `{badge}` `{id}` `{num}`
`{title}` `{label}` …), `{nounLower}`, `{source}` (the comment's text) and `{sourceSep}` (separator +
source, or nothing when the sheet has no source). Example: `"Everything from this {nounLower} on one
screen{sourceSep}"`.

Styles a sheet needs must be in a package or `custom/site.css`, not in one page's `<style>`,
because the sheet also appears on the all-sheets page.

## JavaScript API
None. The all-sheets page remembers its filter in `Study.store` key `summaries:filter`.

## Notes for migrating existing notes
- Move an inline summary section's inner HTML into `content/summaries/<id>.html` and replace the section with the marker.
- If the old combined page used its own anchors (e.g. `#x03`), set `anchor` (e.g. `"x{id}"`) so old links still land.
- `study.py check` reports sheet files that match no page.
