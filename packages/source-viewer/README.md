# source-viewer — show the cited source

## What it does
Turns citations into small chips. Clicking a chip opens a popover beside it (below or above it on
narrow screens) showing the actual source image: a slide, a scanned page, a figure. The popover has
a caption, a "cited" badge for ranges (highlighted while the shown frame is inside the cited range),
Prev/Next buttons, and keys: **←/→** step through the source, **Esc** closes (and returns focus to
the chip). Clicking outside closes it. Nothing is downloaded until a chip is opened; then the
neighbouring frames are preloaded.

Chips come from explicit markup or from plain text such as `s12` or `s12–14` inside citation
elements, so existing notes need no rewriting. In print, chips are plain text and the popover is hidden.

## Enable
```json
"packages": { "source-viewer": {} }
```
Put the images and the manifest in `static/assets/sources/` (the build copies `static/` to the site
root). `python3 tools/study.py new <dir> --demo` ships placeholder decks you can copy the layout from.

## Options
| Option | Default | Meaning |
|---|---|---|
| `base` | `"assets/sources/"` | Folder of the manifest and images, relative to the built pages |
| `manifestGlobal` | `"STUDY_SOURCES"` | Global variable that `index.js` sets |
| `selectors` | `".ref, .src, cite"` | Elements whose text is scanned for citations; `""` turns auto chips off |
| `skip` | `""` | Extra selector of elements never scanned (e.g. `".quiz .lbl"`) |
| `patterns` | `[{"prefix": "s", "deck": "{page}s"}]` | Citation texts that become chips (below) |
| `pageOverridePrefix` | `"P"` | `P03 s12` cites s12 of page 03's deck; `""` disables |
| `skipMissing` | `false` | Leave a citation as plain text when the manifest has no such deck |
| `caption` | `"{deckLabel} · {prefix}{n}"` | Popover caption. Fields: `{deck} {deckLabel} {prefix} {n} {total}` |
| `position` | `"{n} / {total}"` | Text between Prev and Next |
| `rangeLabel` | `"cited {prefix}{from}–{to}"` | Badge for chips citing a range |
| `singleLabel` | `""` | Badge for chips citing one frame; empty = none |
| `imageLabel` | `"{deckLabel}, {n} of {total}"` | Accessible name of the image |
| `chipTitle` | `"Show this in the source"` | Tooltip on chips |
| `dialogLabel` | `"Source viewer"` | Accessible name of the popover |
| `loading` / `error` / `missing` | `"Loading…"`, `"This image could not be loaded."`, `"Images for this source are not available."` | Messages in the image area |
| `prev` / `next` / `close` | `"← Prev"`, `"Next →"`, `"Close"` | Button labels |
| `maxWidth` | `600` | Largest popover width (px) |
| `minSideWidth` | `340` | Room needed beside the chip; with less on both sides it goes below |

### Patterns
Each pattern is `{"prefix": "...", "deck": "..."}`. Text made of the prefix and a number (`s12`), or
a range with an en dash or hyphen (`s12–14`, `s12-14`, `s12–s14`), becomes a chip for the deck named
by `deck`, where `{page}` is the page id and `{prefix}` the prefix. A match must stand alone: `items2`,
`s2x`, `s2(` and `a.s2` are left alone, as is text inside math (`.m`, `.mblock`, `.eq`), code, links,
buttons, scripts and anything marked `data-sv-skip`.

Several sources per page, e.g. a short and a long version of the same slides plus scanned handouts:
```json
"patterns": [
  { "prefix": "s", "deck": "{page}s" },
  { "prefix": "f", "deck": "{page}f" },
  { "prefix": "h", "deck": "handout-{page}" }
]
```
The page id is `body[data-page]`; a `data-sv-page="…"` attribute on any ancestor overrides it (handy
on review pages that gather several pages' material; the `summaries` package sets it on every sheet
of its all-sheets page). `P03 s12` overrides it for one citation.

A pattern may add `"label"` (same fields), the caption label used when the manifest gives the deck
none: `{ "prefix": "f", "deck": "{page}f", "label": "Part {page} · long version" }`.

With `skipMissing`, one pattern list can serve pages that have only some of the decks: on a page
without an `h` deck, `h3` stays plain text. Automatic chips then appear once the manifest has loaded.

Widgets that rewrite text containing citations call `Study.sources.chipify(element)` afterwards;
it scans the element again (text already inside a chip is left alone).

## Markup
Automatic (inside an element matched by `selectors`):
```html
<p class="src">Source: s12–14 · s20</p>
<p>… as the source puts it. <span class="ref">s12</span></p>
<blockquote class="quote"><p>…</p><cite>s13</cite></blockquote>
```
Explicit (anywhere):
```html
<button class="sv-chip" data-deck="A" data-from="12" data-to="14">s12–14</button>
<span class="sv-ref" data-deck="A" data-from="12">the first figure</span>   <!-- upgraded to a button -->
```
`data-to` defaults to `data-from`; `data-deck` may contain `{page}`; `data-prefix` sets the
`{prefix}` used in the caption (otherwise the deck's `prefix` from the manifest).

## The manifest and image layouts
`<base>index.js` sets `window.STUDY_SOURCES` (the `manifestGlobal` option renames it; a script, so it also works when pages are opened from
disk, where `fetch` is blocked); `<base>index.json` holds the same object and is used if the script is
missing.
```js
window.STUDY_SOURCES = { "decks": {
  "01s": { "n": 42, "w": 880, "h": 495, "cols": 5, "rows": 5, "label": "Deck A", "prefix": "s" },
  "scan": { "n": 12, "w": 1000, "h": 1414, "pattern": "{deck}/{n:03}.webp", "label": "Handout" }
}};
```
- `n` frames, each `w`×`h` (used for the popover's shape); `label` for captions (default: the deck id).
- **Sprite sheets** (no `pattern`): frames are packed `cols`×`rows` per image, row by row, in files
  `<deck>-00.webp`, `<deck>-01.webp`, … (`sheet` overrides the name, e.g. `"{deck}-{k:02}.png"`).
  Fewer, larger requests; good for long slide decks.
- **One file per frame**: `pattern` gives the file name relative to `base`; `{n}` is the 1-based
  frame number, `{n:03}` zero-pads it. Good for scans or figures of mixed shapes (letterboxed).

### Making the files: `tools/build_sources.py`
Render your PDF or deck to images with any tool you like (a PDF viewer's export, `pdftoppm`,
ImageMagick, …), one image per frame, then:
```sh
T=packages/source-viewer/tools/build_sources.py      # path inside the template
# a folder of deck folders (each subfolder = one deck id) -> one file per frame (standard library only)
python3 $T renders/ --out my-site/static/assets/sources
# sprite sheets, resized and compressed (needs Pillow)
python3 $T renders/ --out my-site/static/assets/sources --sprites --cols 5 --rows 5 --width 880 --quality 60
# one deck, with a caption label and prefix
python3 $T renders/03 --deck 03s --label "Deck A" --prefix s --out my-site/static/assets/sources
```
Frames are ordered by natural sort of their names (`p2` before `p10`). The manifest is merged, so
decks not named in a run are kept. `--format webp|png|jpeg` and `--width` convert per-frame images
(Pillow); `--labels labels.json` sets several labels; `--only A,B`, `--size WxH`, `--dry-run`.
If the frames already sit in `<out>/<deck>/` named `1.webp…` or `001.webp…`, the tool only writes the
manifest. `python3 tools/study.py check` reports a missing manifest and explicit chips naming unknown decks.

## JavaScript API
```js
Study.sources.open('A', 12, 14, anchorEl)   // anchorEl optional: without it the popover opens at the top
Study.sources.close()
Study.sources.chipify(rootEl)               // also run by Study.enhance(root), e.g. for quiz feedback
Study.sources.load()                        // Promise of the manifest
Study.sources.frame('A', 12)                // image URL of a frame, once the manifest is loaded
```
Theme hooks: `--sv-chip-icon` (glyph before chips), `--sv-frame-bg` / `--sv-frame-ink` (the image area,
light by default even in dark mode, since most sources are printed on white).

## Notes for migrating existing notes
- Keep your citation text; set `patterns` to the prefixes you already use and `selectors` to the
  elements they sit in. One prefix per kind of source.
- If your deck ids were per-page (e.g. `03c`), use `"deck": "{page}c"`; if page ids differ from the old
  deck ids, rename decks with `build_sources.py --deck` or the deck folder names.
- References inside quiz explanations become chips when the feedback is shown (core calls `Study.enhance`).
- Links to external pages are never turned into chips; keep them as links.
