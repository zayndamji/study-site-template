# source-links — links to a section of the online source

## What it does
For pages whose source is a web page (a handout, an article, documentation), a reference such as
`§ Getting started` in a source line becomes a link that opens the source at that heading. The
link uses a [text fragment](https://developer.mozilla.org/en-US/docs/Web/URI/Fragment/Text_fragments)
(`#:~:text=Getting%20started`), so supporting browsers scroll to the heading and highlight it.

The links are written by the build, so they work without JavaScript and in print.

## Enable
```json
"packages": { "source-links": { "baseUrl": "https://example.org/handouts/" } },
"pages": [
  { "id": "styles", "kind": "guide", "title": "A style guide", "sourceUrl": "style-guide.html" }
]
```

## Options
| Option | Default | Meaning |
|---|---|---|
| `urlField` | `"sourceUrl"` | Page field (in `site.json`) with the source's address |
| `baseUrl` | `""` | Prefix for relative addresses |
| `marker` | `"§"` | Starts a heading reference |
| `separators` | `"·;"` | Characters between several references in one line |
| `selectors` | `["p.src", "span.ref", "cite"]` | Elements scanned (simple selectors); only text-only elements are changed |
| `textFragments` | `true` | Add `#:~:text=…` for the heading |
| `linkTitle` | `"Open this section of the source"` | Tooltip; `""` = none |
| `newTab` | `true` | Open in a new tab |
| `requireUrl` | `false` | `check` reports pages that use the marker but have no address |

## Markup
```html
<p class="src">§ Getting started · § Common mistakes</p>
<span class="ref">§ “Defining terms” … Examples</span>   <!-- a range: from “Defining terms” to “Examples” -->
```
becomes, on a page with a `sourceUrl`:
```html
<p class="src"><a class="src-link" href="…style-guide.html#:~:text=Getting%20started" …>§ Getting started</a> · …</p>
```
Quotes and parenthetical asides in a reference are left out of the fragment; `start … end` becomes a
range. With `requireUrl`, `study.py check` reports pages that use the marker in a source line but
have no address.

Links are added to the finished page, so content that other packages insert (a summary sheet) is
linked too. On a page that gathers several pages' content, such as the `summaries` all-sheets page,
each `<section data-sv-page="…" data-sheet-kind="…">` links to the source of the page it came from.

## JavaScript API
References that a page script writes after load (`el.textContent = "§ Heading"`) are linked at
start-up and whenever `Study.enhance(el)` runs; `Study.sourceLinks.link(el)` does it directly. The
script reads the page's address from `<meta name="source-links-url">`, which the build adds.
