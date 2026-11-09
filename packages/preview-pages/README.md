# preview-pages — provisional pages, flagged

## What it does
Some pages are worth publishing before they are final: a draft, or a page written from early or
incomplete sources. Give such a page a `"statusLabel"` and it is built like any ready page
(page switcher, Prev/Next, summaries, progress) with two additions:
- **On the home page**, the label sits beside the page's title as a status flag (a coloured dot and
  the text). Search finds it, so searching for the label lists every provisional page. The flag is
  next to the title rather than on the progress line, so `home-progress` never hides it.
- **On the page**, a banner under the title says the page is provisional.

Remove the label once the page is final and both go away.

## Enable
```json
"packages": { "preview-pages": {} }
```
and in `site.json` → `pages`:
```json
{ "id": "07", "title": "…", "statusLabel": "Draft" }
```
The page's `status` stays `"ready"` (the default). For pages that are not written yet, see
`coming-later`, which uses `statusLabel` as its badge text in the same way.

## Options
| Option | Default | Meaning |
|---|---|---|
| `banner` | `"<strong>{label}.</strong> This page is provisional and will be revised."` | Banner HTML. Fields: `{label}` and the page fields (`{id}` `{badge}` `{title}` `{noun}` …). `""` turns banners off |
| `flag` | `true` | Show the label beside the title on the home page |

A page can set `"statusNote"` to replace the banner text for that page only (same fields).

## Markup
None. The banner is `p.preview-banner`; the home flag is `.entry .flag`.
