# topic-details — show descriptions on the home page

## What it does
Adds a **Topic details** checkbox to the home toolbar. When ticked, every row shows the page's
`description` (from `site.json`) under its title. Descriptions are always searchable either way.

## Enable
```json
"packages": { "topic-details": {} }
```

## Options
| Option | Default | Meaning |
|---|---|---|
| `label` | `"Topic details"` | Checkbox label |
| `defaultOn` | `false` | Start with descriptions shown |
| `remember` | `true` | Remember the choice (`Study.store` key `topic-details:on`) |

## Markup
None. Write good one-line `description`s in `site.json`.

## JavaScript API
None.
