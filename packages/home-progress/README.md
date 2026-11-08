# home-progress — review meters on the home page

## What it does
Every page whose kind has `"review": true` gets "Mark section as reviewed" buttons (core). This package shows
that progress on the page's home-page row: "3 / 7 reviewed" plus a thin bar, or "✓ Reviewed" when complete.

## Enable
```json
"packages": { "home-progress": {} }
```

## Options
| Option | Default | Meaning |
|---|---|---|
| `label` | `"{done} / {total} reviewed"` | Fields `{done}`, `{total}`, `{percent}` |
| `doneLabel` | `"✓ Reviewed"` | Text when complete; `""` keeps `label` |
| `meter` | `true` | Thin bar under the text |
| `hideUnstarted` | `true` | Nothing for pages with no reviewed sections |

## Markup
None: rows already carry `data-unit` (the page's `storageKey`).

## JavaScript API
None. Reads `Study.store` keys `reviewed:<unit>` and `total:<unit>` written by core.
A page's total is recorded the first time the page is opened.

## Notes for migrating existing notes
Progress survives a migration when the site keeps the old `site.storagePrefix` and each page's old storage id
(`kinds.<kind>.storageKey`, e.g. `"ch{id}"`), and section ids stay the same.
