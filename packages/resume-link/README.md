# resume-link — "Continue reading" on the home page

## What it does
Remembers the last page you opened and puts a **Continue: <page> →** link on the home page.

## Enable
```json
"packages": { "resume-link": {} }
```

## Options
| Option | Default | Meaning |
|---|---|---|
| `label` | `"Continue: {label} →"` | Fields `{title}`, `{label}`, `{id}`, `{badge}`, `{num}`, `{noun}` |
| `where` | `"intro"` | `"intro"` line or `"tools"` row |
| `kinds` | `null` | Only remember these kinds, e.g. `["unit"]` |

## Markup
None.

## JavaScript API
None. Uses `Study.store` key `resume-link:last` (falls back to core's `last-page`).
