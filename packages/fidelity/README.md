# fidelity — keep the source's words apart from yours

## What it does
Conventions, with styles, for notes that must stay faithful to a source (lecture slides, a textbook,
a handout):

- **Verbatim quotes**: a block quote (`blockquote.quote`, with a `cite`) or an inline quote
  (`q.quote`) holds the source's exact wording — definitions, theorem statements, key phrases.
- **Source notes**: a box (`div.source-note`) quotes a note the source attaches to its own content,
  such as a speech bubble on a slide, a margin note or a sidenote, word for word.
- **Beyond the source**: a small tag (`span.beyond`) or a dashed block (`div.beyond-block`) marks
  material the notes add: intuitions, extra examples, connections.
- **Erratum**: a red-edged box (`div.erratum`) quotes the source's wording and gives the correction.
- Optionally a one-line **legend** at the top of each page explains the markers.

Labels are filled in by the build (so they appear without JavaScript and in print) and by the
script for content added later.

## Enable
```json
"packages": { "fidelity": {} }
```
With the legend: `"fidelity": { "legend": true }`.

## Options
| Option | Default | Meaning |
|---|---|---|
| `beyondLabel` | `"Beyond the source"` | Text of an empty `span.beyond` |
| `beyondBlockLabel` | `"Beyond the source"` | Label added to a `div.beyond-block` without its own `.lbl` |
| `erratumLabel` | `"Erratum"` | Label of a `div.erratum` whose `.lbl` is empty or missing |
| `sourceNoteLabel` | `"Source note"` | Label of a `div.source-note` whose `.lbl` is empty or missing |
| `legend` | `false` | Add the legend line at the top of every unit page (front matter `"fidelityLegend": false` opts a page out) |
| `legendText` | `"Indented quotes are … {beyond} marks … {erratum} boxes …"` | Legend text, HTML allowed; `{beyond}` / `{erratum}` become small samples of the markers |
| `legendLabel` | `"How to read these notes"` | Accessible name of the legend |
| `legendShowLabel` | `false` | Also show `legendLabel` at the start of the line |
| `legendKinds` | `null` | Page kinds that get the legend; `null` = all |
| `quoteAliases` | `[]` | Other class names for verbatim quotes, e.g. `["slide"]`: `blockquote.slide` and `q.slide` look and count as quotes without renaming |

## Markup
```html
<blockquote class="quote">
  <p>The source's exact words.</p>
  <cite>Deck A, frame 3</cite>
</blockquote>

<p>… what the source calls <q class="quote">the exact phrase</q> …</p>

<p>An intuition the source does not give. <span class="beyond"></span></p>
<p>Or with its own text: <span class="beyond">Not examined</span></p>

<div class="beyond-block"><p>A longer addition.</p></div>
<div class="beyond-block"><span class="lbl">Extra example</span><p>…</p></div>

<div class="source-note"><span class="lbl"></span>The note's exact words. <cite>Deck A, frame 4</cite></div>
<div class="source-note"><span class="lbl">Margin note <span class="ref">p12</span></span>A label of its own, with a chip.</div>

<div class="erratum"><span class="lbl"></span>
  <p>The source says:</p>
  <blockquote class="quote"><p>The wording as printed.</p><cite>Deck A, frame 5</cite></blockquote>
  <p>It should read …, because ….</p>
</div>
```
Put the `.lbl` first in a box (or leave it out and one is added; class `bare` keeps a box
unlabelled, e.g. a source note captioning a figure); it reads as a run-in lead. A
source note's text may follow the label directly or sit in paragraphs and lists. Citations inside `cite` become
clickable chips when the `source-viewer` package is on (`cite` is in its default `selectors`).

Suggested house rules (not enforced): quote definitions and theorem statements verbatim; paraphrase
only explanations; tag every addition; never silently fix the source — quote it in an erratum.

A `span.beyond` that already contains text keeps it; only empty ones get `beyondLabel`. An
erratum's quote should copy the source's wording exactly, so a reader can find it.

## JavaScript API
None. `Study.enhance(el)` fills labels in content added later.
