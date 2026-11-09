# coming-later — planned pages on the home page

## What it does
Without this package, pages whose `status` is not `"ready"` are left out of the site entirely.
With it, `"planned"` pages appear as greyed, unclickable home rows with a **Coming later** badge,
and as disabled options in the page switcher. Prev/Next always skips them.

## Enable
```json
"packages": { "coming-later": {} }
```
and in `site.json` → `pages`: `{ "id": "12", "title": "…", "status": "planned" }`.

## Options
| Option | Default | Meaning |
|---|---|---|
| `statuses` | `["planned"]` | Which statuses count as coming later (e.g. add `"draft"`) |
| `label` | `"Coming later"` | Badge text; a page can set `"statusLabel"` to override |
| `inPicker` | `true` | Show them disabled in the page switcher |
| `searchable` | `true` | Search finds them |
| `placement` | `"group"` | `"group"`: in their group, greyed out. `"after"`: together in one block below the catalog, hidden while a filter is on (and while searching unless `searchable`) |
| `afterTitle` | `""` | Small heading above the `"after"` block |

A group's range (`01–09`) covers the rows drawn in it, so planned pages count only with
`placement: "group"`; set the group's `"range"` to override it.

## Markup
None.
