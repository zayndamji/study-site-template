# growth-chart — growth curves and operation counts

## What it does
Plots how a quantity grows with the input size *n*: the **standard growth curves** (1, log n, n,
n log n, n², n³, 2ⁿ, cⁿ, n! and a few more), each with an optional constant factor, and **data series**
(measured times or counted operations as `[n, value]` points), on a linear or log y axis and a linear
or log x axis. The reader can

- move across the chart (mouse, touch, or arrow keys once it has focus) to read every curve at one n;
- press a legend entry to hide or show that curve;
- drag a control to change the largest n, and switch the y axis between linear and log scale;
- see which standard curve best matches a data series ("fit"), with the matching curve drawn dashed.

The y range follows the curves that are shown, so hiding a fast-growing curve rescales the rest.
Values far beyond floating point (n! or 2ⁿ at large n) are computed as logarithms and written as
`m×10ᵉ`. Charts are drawn on a `plot-2d` plane (added automatically), at the page column's own width,
so text stays at its real size on phones.

## Enable
```json
"packages": { "growth-chart": {} }
```

## Options
| Option | Default | Meaning |
|---|---|---|
| `height` | `300` | Chart height in CSS pixels (spec `height` overrides) |
| `logBase` | `2` | Base of the log in `log n` and `n log n` |
| `integerN` | `true` | Snap the readout and the largest-n control to whole numbers (spec `integer`) |
| `slider` | `true` | Show the largest-n control when a spec has no `maxN` (range: a little above the smallest n to 4 × the largest) |
| `logToggle` | `true` | Show the linear/log switch for the y axis (spec `logToggle`) |
| `fitCandidates` | `["1", "log n", "n", "n log n", "n^2", "n^3", "2^n", "n!"]` | Curves a fit compares against |
| `fitCurve` | `true` | Draw the best-matching curve as a dashed line |
| `names` | `{}` | Display names by canonical curve name, e.g. `{"log n": "lg n"}` |
| `locale` | `""` | Number-formatting locale; `""` = the browser's |
| `xLabel`, `yLabel` | `"n"`, `""` | Axis names (spec `xLabel`, `yLabel` override) |
| `maxLabel`, `logLabel` | `"Largest {x}"`, `"Log scale"` | Controls |
| `legendLabel` | `"Curves shown (press to hide or show)"` | Accessible name of the legend |
| `atLabel`, `seriesAt` | `"At {x} = {n}"`, `"{v} at {x} = {n}"` | Readout heading; a series value read at its nearest point |
| `hiddenValue`, `noValue` | `"hidden"`, `"—"` | Readout of a hidden or undefined curve |
| `chartLabel`, `cursorText` | see `study.py info growth-chart` | Accessible name and spoken value of the chart (it is a keyboard slider) |
| `fitText`, `fitLabel`, `fitTooFew` | `"{series} grows most like {curve}: about {factor} × {curve}."`, … | Fit sentences |

Colours: `--gc-1` … `--gc-8` (the plot-2d palette `--plot-c1…4`, then purple, teal, brown and muted, with
dark-theme values). Override them in site CSS. Curves take them in order unless they set `color`.

## Markup
```html
<div class="widget gc-chart">
  <div class="lbl">Try it · Growth rates</div>
  <script type="application/json">
  { "x": [1, 20], "yScale": "log",
    "curves": [ { "fn": "n^2" }, { "fn": "2^n", "label": "doubling" }, { "fn": "c^n", "base": 1.5 } ],
    "series": [ { "label": "Counted", "points": [[2, 5], [4, 17], [8, 65]], "fit": true } ] }
  </script>
</div>
```

**Spec.**

| Key | Meaning |
|---|---|
| `curves[]` | `fn` (curve name, below), optional `label`, `scale` (constant factor), `base` (for `"c^n"`), `color` (1–8), `dash`, `hidden` |
| `series[]` | `label`, `points` (`[[n, value], …]`), optional `color`, `line` (`false` = dots only), `fit` (`true` or a list of curve names), `hidden` |
| `x` | `[min, max]` of n (default `[1, 32]`; must start above 0 on a log x axis) |
| `y` | fixed `[min, max]`; default: fits the shown curves |
| `xScale`, `yScale` | `"linear"` (default) or `"log"` |
| `maxN` | `[min, max]` of the largest-n control, or `false` for none |
| `fit` | `true` = fit every series; a list = the candidate curves for every series |
| `at` | the n the readout starts at (default: the largest) |
| `integer`, `logToggle`, `height`, `xLabel`, `yLabel` | per-chart versions of the options |

**Curve names.** `1`, `log n`, `n`, `n log n`, `n^2`, `n^3`, any `n^k` (`n^1.5`, `sqrt n`), `2^n`, any
`k^n` (`1.5^n`), `c^n` with `"base"`, `n!`, `n^n`, `log^k n`, `n^k log n`. Spaces, `*`, `·`, brackets
and superscripts are ignored (`n²`, `n·log(n)`, `2ⁿ` all work); `lg` and `log2` mean `log`.
`study.py check` reports invalid JSON, unknown curve names, bad ranges and malformed points.

**Fit.** For each candidate curve the ratios value ÷ f(n) are taken over the larger half of the points
(at least three); the curve whose ratios vary least (the standard deviation of their logarithms) is the
best match, and the mean ratio is its constant factor. It needs three points with n > 0 and value > 0.

## JavaScript API
`Study.growth`:
- `mount(host, spec?)` → `{ items, state, redraw }` (for charts added later; the spec defaults to the
  host's JSON script; `Study.enhance(el)` also works);
- `parse(fn, base?)` → a curve object `{kind, name, …}` or `null`; `label(fn, {base}?)` → display name;
- `value(fn, n, {scale, base, logBase}?)` → the value (may be `Infinity`); `log10(fn, n, …)` → its log10,
  finite where the value overflows;
- `bestFit(points, candidates?, {logBase}?)` → `[{fn, name, label, factor, spread}]`, best first;
- `format(v, log10?)`, `ticks.linear(lo, hi, count)`, `ticks.decades(lo, hi, max)`, `ticks.logX(lo, hi, max)`,
  `lgamma(x)`, `curveNames`.
