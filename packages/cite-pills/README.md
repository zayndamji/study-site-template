# cite-pills — textbook-style citation pills

## What it does
Shows citations of a book or PDF as small pills: an icon, the citation, and the page —
"Ex 1.2 · p. 42". Optionally each pill links to that page of the PDF (opening in a new tab).
The section source line under each heading (`p.src`) gets the same pill look. In tables a
`td.cite` keeps the plain cell look and just gains the page.

## Enable
```json
"packages": { "cite-pills": {} }
```
Linking to a PDF whose page 1 is the 20th page of the file:
```json
"cite-pills": { "href": "source.pdf#page={pdfPage}", "offset": 19 }
```
Put the PDF in `static/` (or use any URL you are allowed to link to).

## Options
| Option | Default | Meaning |
|---|---|---|
| `icon` | `"book"` | `"book"`, `"page"` or `"none"` |
| `pageLabel` | `"p. {page}"` | Text after the citation; empty = none |
| `title` | `"Source, page {page}"` | Tooltip (`{page}`, `{pdfPage}`); empty = none |
| `offset` | `0` | Added to a numeric `data-page` to get `{pdfPage}` |
| `href` | `null` | Link template, e.g. `"source.pdf#page={pdfPage}"`; pills with a page become links |
| `newTab` | `true` | Open those links in a new tab |
| `sourcePill` | `true` | Style `p.src` as a pill with the same icon |
| `sources` | `{}` | Per-source overrides for elements with `data-source` (below) |
| `requirePage` | `false` | `study.py check` reports every `.cite` without `data-page` (or a `.pg` child) |

Several sources (a textbook and a reader with different page offsets):
```json
"cite-pills": {
  "href": "book.pdf#page={pdfPage}", "offset": 14,
  "sources": { "reader": { "icon": "page", "href": "reader.pdf#page={pdfPage}", "offset": 0, "title": "Reader, page {page}" } }
}
```
```html
<span class="cite" data-source="reader" data-page="7">Handout 3</span>
```

## Markup
```html
<span class="cite" data-page="42">Ex 1.2</span>          <!-- pill: icon · Ex 1.2 · p. 42 -->
<span class="cite">Table 2.2</span>                       <!-- no page: label only -->
<span class="cite" data-page="xii">Preface</span>         <!-- non-numeric pages are used as they are -->
<span class="cite" data-page="12" data-pdf-page="40">…</span>   <!-- exact PDF page, ignores offset -->
<td class="cite" data-page="45">Thm 2.1</td>              <!-- table cell: no pill chrome -->
<p class="src">Source: Chapter 2, sections 2.1–2.3</p>   <!-- core source line, shown as a pill -->
```
The page text, tooltip and link are added by the script; the pill look itself is plain CSS.
Icons are CSS masks in the text colour; override `--cp-book` / `--cp-page` with your own SVG data URL.

A pill that already contains its page text as `<span class="pg">p. 49</span>` keeps it; the
script does not add a second label.

## JavaScript API
None. `Study.enhance(el)` processes citations in content added later. Processed elements carry
`data-cp`; pills are `span.cite.cp-pill` (or `a.cite.cp-pill` when linked), the page text is `.cp-pg`.
