# Core components

Markup for everything the core styles and scripts handle. `core/example.html` has all of it on one
page; `study.py new <dir> --demo` builds it, plus one page per package.

## Page structure

The build writes the document shell (head, top bar, rail, footer, title block). A content file holds only
sections:

```html
<section class="note" id="unique-id">
  <h2><span class="n">01</span> Section title</h2>
  <p class="src">Source line (optional)</p>
  …
</section>
```

- `id` is required (rail link, scrollspy, review state). `<span class="n">` is the number in the rail.
- `data-toc-group="Label"` on a section starts a labelled group in the rail.
- `data-toc-title="Short"` overrides the rail text.
- `data-no-review` leaves the section out of review progress.

## Text

| Markup | Use |
|---|---|
| `<span class="term">word</span>` | a term at its definition |
| `<mark>…</mark>` | highlight |
| `<span class="m">…</span>` | inline math (Unicode, `<i>` for variables) |
| `<div class="mblock"><span class="row">…</span></div>` | display math, one `.row` per line |
| `<div class="eq">…</div>` | a centred equation line |
| `<p class="aside">` | quieter side remark |
| `<span class="ref">…</span>` | small reference label (packages may turn these into chips) |

Math is plain Unicode in a math font (STIX Two by default): `x²`, `∑`, `≤`, `ℝ`, `⇒`. There is no TeX
engine, which keeps pages light and searchable.

## Boxes

```html
<div class="key"><span class="lbl">The idea</span><p>One sentence to remember.</p></div>
<div class="box def"><span class="lbl">Definition · Name</span><p>…</p></div>
<div class="box thm"><span class="lbl">Theorem 1.2</span><p>…</p></div>
<div class="box"><span class="lbl">Anything</span><p>…</p></div>
<div class="pitfall"><span class="lbl">Pitfall</span><p>…</p></div>
<details class="reveal"><summary>Proof</summary><div class="body">…</div></details>
```

## Tables and diagrams

```html
<div class="tablewrap"><table class="t"><thead>…</thead><tbody>…</tbody></table></div>
<svg class="diagram" viewBox="…">…</svg>   <!-- classes: .stroke .accent .muted; text uses the math font -->
<figure>…<figcaption>…</figcaption></figure>
```

Wide content must scroll inside its own container (`.tablewrap`, `.diagram-wrap`, `.mblock`), never the page.

## Widgets

```html
<div class="widget" id="w1">
  <div class="lbl">Try it · Name</div>
  <p class="how">One line on how to use it.</p>
  <div class="controls"><label class="field">x<input id="w1x"></label><button class="btn">Go</button></div>
  <div class="out"><span class="k">result</span><span id="w1out"></span></div>
</div>
<script>/* after the markup; vanilla JS; Study.* is available */</script>
```

`.btn`, `.btn.primary`, `aria-pressed="true"` (toggled look), `.controls`, `.field`, `.out`.

## Stepper

```html
<div class="widget stepper">
  <div class="lbl">Step by step · Title</div>
  <ol class="steps"><li>…</li><li>…</li></ol>
</div>
```
Shows one step at a time with Back / Next step / Show all.

## Quiz

```html
<div class="widget quiz" data-id="site-unique-id">
  <div class="quiz-head"><div class="lbl">Self-check</div></div>
  <div class="q" data-answer="b">
    <div class="q-prompt">Question?</div>
    <div class="q-opts"><button data-v="a">A</button><button data-v="b">B</button></div>
    <div class="q-feedback" hidden></div>
    <template class="q-explain">Why B is right.</template>
  </div>
</div>
```
Answers persist per `data-id` (unique across the whole site; `check` enforces it). Score and Reset are added.

## Content added later

Widgets that build markup after load (e.g. a stepper inside generated output) call
`Study.enhance(element)` so core and packages process it.

## JavaScript API (core)

See the header comment of `core/core.js`: `Study.store`, `Study.define`, `Study.options`,
`Study.enhance`, `Study.on/emit` (`ready`, `review:change`, `quiz:answer`, `theme:change`, `home:filter`),
`Study.h`, `Study.ready`, `Study.page`, `Study.pages`.
