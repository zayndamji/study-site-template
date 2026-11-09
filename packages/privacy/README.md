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
| `forbidFile` | `""` | Text file, one term per line, `#` comments. Keep it outside `content/`, `custom/` and `packages/`, or it is scanned too |
| `wholeWords` | `false` | Match terms only as whole words, so a short code does not hit longer words |
| `forbidPatterns` | `[]` | Regular expressions (Python syntax, case-insensitive) for terms a list cannot express, e.g. `"\\bab ?12\\b"` |
| `forbidPersonal` | `true` | Also forbid home-folder paths (`/Users/…`, `/home/…`, `C:\Users\…`) and e-mail addresses |
| `scanSources` | `true` | Also scan `content/`, `custom/`, site `packages/` |
| `failBuild` | `true` | Fail the build on a hit |
| `noindex`, `noReferrer` | `true` | Meta tags |
| `localFonts` | `false` | Remove remote font stylesheets |
