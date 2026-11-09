# widget-kit — layout helpers for widgets

## What it does
CSS for the pieces most interactive widgets are built from, so pages need no copies of the same
rules. Nothing runs; every class is opt-in. Everything works at 375 px: grids stack below 760 px.

## Enable
```json
"packages": { "widget-kit": {} }
```

## Options
None.

## Markup
| Class | Use |
|---|---|
| `.two` (`.two.even`) | Two columns, e.g. a plot beside its controls (wider left; `.even` = equal) |
| `.panels` (`.panels.three`) | A row of 4 (or 3) small `figure`s with `figcaption`s; 2 per row on phones |
| `.methods` > `.method` (`h4` + `ol.calc`) | Two ways of working the same problem, side by side |
| `ol.calc` | Numbered calculation steps; `.dots` for a muted "…" line |
| `.sliders` | A grid of `.field`s holding `input[type=range]` (plus a last `auto` column, e.g. a button) |
| `.seg` | A group of toggle buttons (`.btn` with `aria-pressed`) |
| `.controls .status` | A muted status line inside a controls row |
| `.field.sm` | A narrow field (5rem input) inside `.controls` |
| `.grid-in` | Small inputs in a grid (3 columns; set `grid-template-columns` for others); `.bar` before an augmented column |
| `.vecin` > `.vrow` (`.vl` + inputs) | Rows of vector components with a label |
| `.readout` (`.row`, `.k`) | Results in maths type, with small caps keys |
| `.legend` | A line explaining the colours of a picture; colour words with `.c1`…`.c4` |
| `.vl.c1`…`.c4`, `.wk-c1`…`.wk-c4` | Text in the plot palette colours |
| `.tag` (`.ok` `.no` `.warn`) | A small status tag |
| `.callout` | A short note inside or under a widget |
| `table.t.iter` (`tr.cur`) | A compact table of iterations, current row highlighted |

```html
<div class="widget" id="w">
  <div class="lbl">Try it · …</div>
  <div class="two">
    <svg class="plane"></svg>
    <div>
      <div class="sliders"><label class="field">a <input type="range"></label>…</div>
      <div class="readout"><div class="row"><span class="k">result</span>…</div></div>
      <p class="legend"><span class="c1">■ first</span> <span class="c2">■ second</span></p>
    </div>
  </div>
  <p class="callout">One sentence on what to notice.</p>
</div>
```

The colour classes read `--plot-c1`…`--plot-c4` from `plot-2d` when it is on (so a legend matches the
plot), and the core tokens otherwise.

## JavaScript API
None.

## Notes for migrating existing notes
Pages that each carry the same widget CSS (two-column layouts, readouts, tags, sliders, …) can drop
those rules once this package is on. Rename one-off class names to these where they mean the same
thing, e.g. a page's own note box → `.callout`, legend colour classes → `.c1`…`.c4`.
