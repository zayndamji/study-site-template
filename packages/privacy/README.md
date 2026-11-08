# privacy — keep identifying information out

## What it does
- **Forbidden terms:** the build fails (and `study.py check` reports) if any listed word or phrase appears in the
  built pages, the bundled CSS/JS, or (by default) the site's own sources — with file and line.
- **No indexing:** adds `robots: noindex, nofollow` and `referrer: no-referrer` meta tags.
- **No third-party requests (optional):** `localFonts` drops remote font stylesheets.

Use it when notes are built from material you may not republish, or when the site must not name its
course, school or author. Also pick a neutral `site.title`, `site.storagePrefix` and file names.

## Enable
```json
"packages": { "privacy": { "forbidFile": "private/forbidden.txt" } }
```
Keep `private/` out of version control if the terms themselves are sensitive.

## Options
| Option | Default | Meaning |
|---|---|---|
| `forbid` | `[]` | Terms, case-insensitive |
| `forbidFile` | `""` | Text file, one term per line, `#` comments |
| `scanSources` | `true` | Also scan `content/`, `custom/`, site `packages/` |
| `failBuild` | `true` | Fail the build on a hit |
| `noindex`, `noReferrer` | `true` | Meta tags |
| `localFonts` | `false` | Remove remote font stylesheets |

## Notes for migrating existing notes
Run `study.py check` after migrating: it lists every remaining hit so you can rename storage keys, ids and
comments as well as visible text.
