# plot-2d

## What it does

Draws interactive coordinate planes in an `<svg>`: grid, axes, tick labels, lines, arrows,
polygons, dots, text, whole lines `a·x + b·y = c`, and draggable handles. Colours come from the
core tokens through four colour classes, so planes look right in light and dark themes.
Requires `math-kit` (added automatically).

## Enable

```json
"packages": { "plot-2d": {} }
```

## Options

| Option | Default | Meaning |
|---|---|---|
| `width` | `440` | Default viewBox width in SVG units (the svg itself scales to its container). |
| `arrowHead` | `11` | Maximum arrow-head length in SVG units. |
| `handleRadius` | `7` | Radius of the dot drawn by `P.handle()`. |
| `hitRadius` | `16` | Radius of the invisible touch target around a handle. |
| `colors` | `[]` | Up to four CSS colours for `c1`…`c4` in light mode; empty = core tokens. |
| `darkColors` | `[]` | Up to four CSS colours for `c1`…`c4` in dark mode. |
| `markNames` | `{}` | Extra class names that draw like shape classes, e.g. `{"swept": "region", "gate": "rod"}`; a value lists `fill` `outline` `thin` `dash` `faint` `region` `hollow` `rod` `pin` |
| `colorNames` | `{}` | Extra colour class names mapped to a slot `1`–`4`, a core token (`"ink"`, `"muted"`) or a CSS colour, e.g. `{"blue": 1, "grey": "muted"}`. |

Without `colors`, `c1`…`c4` are `--term`, `--bad`, `--ok`, `--warn-edge`. The palette is also
available as CSS variables `--plot-c1`…`--plot-c4`.

## Markup

```html
<div class="widget">
  <div class="lbl">My plane</div>
  <svg id="my-plane"><title>What the picture shows</title></svg>
</div>
```

Classes for drawn marks (combine freely):

| Class | Effect |
|---|---|
| `c1` `c2` `c3` `c4` `ink` `muted` | colour of a line, arrow, dot, polygon or label |
| `fill` | translucent fill in the mark's colour (for polygons) |
| `outline` | no fill |
| `thin` `dash` `faint` | thinner stroke, dashed stroke, 35 % opacity |
| `region` | a filled area with no outline (a feasible set, a shaded strip) |
| `hollow` | an open ring: no fill, heavier stroke |
| `rod` | a thick round-ended line, e.g. a gate or a lever |
| `pin` | a hinge or pivot: background-filled dot with an outline in the mark's colour |
| `small` | small muted text (tick labels) |
| `halo` | text with a background-coloured outline, readable over lines |
| `grid` `axis` | grid and axis lines (used by the plane itself) |

A site whose scripts already use their own class names (`swept`, `gate`, …) keeps them: map each to
these shapes with `markNames` and to a colour with `colorNames`, and drop the page CSS that styled them.
For an element with two such classes (`<line class="gate blocked">`), list the modifier after the base
name in each option so its rules come later:

```json
"plot-2d": {
  "markNames":  { "gate": "rod", "hinge": "pin" },
  "colorNames": { "gate": "ink", "hinge": "ink", "blocked": 2 }
}
```

## JavaScript API

```js
const { Plane, drag, snap, clamp } = Study.plot;
const P = Plane(svg, { xmin: -5, xmax: 5, ymin: -4, ymax: 4 });
```

`Plane(svg, o)` clears the svg (keeping `<title>`/`<desc>`), draws the grid and returns `P`.
Options `o`: `xmin xmax ymin ymax` (default −5…5), `w` (viewBox width), `h` (default keeps grid
squares square), `step` or `stepx`/`stepy` (grid spacing, default 1), `grid` and `axes`
(`false` hides them), `labels` (`false` hides tick labels), `labelEvery` / `labelEveryY`
(default every second grid line), `labelDp` (decimals, default 2).

All coordinates below are world coordinates `[x, y]`; `cls` is a class string; `g` an optional
parent group (default `P.fg`, or `P.top` for text and handles).

| Member | |
|---|---|
| `P.X(x)`, `P.Y(y)` | world → SVG units |
| `P.toWorld(evt)` | pointer event → `[x, y]` |
| `P.line(a, b, cls, g)` | segment |
| `P.arrow(a, b, cls, g)` | arrow; returns its `<g>` (or `null` if too short) |
| `P.poly(pts, cls, g)` / `P.pline(pts, cls, g)` | closed polygon / open polyline |
| `P.dot(p, r, cls, g)` | circle of radius `r` SVG units |
| `P.text(p, s, cls, dx = 6, dy = −6, g)` | text label, offset in SVG units |
| `P.infLine(a, b, c, cls, g)` | the whole line `a·x + b·y = c` |
| `P.handle(id, p, cls)` | draggable dot plus touch target, tagged `data-h="id"` |
| `P.inView(p)`, `P.clampToView(p)` | |
| `P.clear()` | remove everything except the grid |
| `P.bg`, `P.fg`, `P.top`, `P.w`, `P.h`, `P.o` | layers, size, options |

`drag(svg, P, onMove(id, [x, y], evt), onClick?([x, y], evt))` lets the reader drag any element
with `data-h` (usually made by `P.handle`). A press on empty space that does not move calls
`onClick`. It returns a function that removes the listeners. Touch scrolling is disabled only on
planes that have `drag` attached.

A typical widget redraws everything on each change:

```js
const pt = { u: [2, 1] };
function render() { P.clear(); P.arrow([0, 0], pt.u, 'c1'); P.handle('u', pt.u, 'c1'); }
drag(svg, P, (id, p) => { pt[id] = [snap(p[0], 0.5), snap(p[1], 0.5)]; render(); });
render();
```

## Notes for migrating existing notes

The API matches the common hand-rolled `Plane`/`drag` helpers, with these differences: the
plane clears the svg first; `arrow` returns a `<g>` (the class is also set on its shaft and head,
so CSS written for `line.cls` keeps working); `dot` defaults to radius 4. Keep old colour class
names with the `colorNames` option instead of renaming markup. Remove page-level `svg.plane` CSS
once this package is on. Keyboard dragging of handles is not built in.
