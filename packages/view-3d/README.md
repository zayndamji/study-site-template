# view-3d

## What it does

A small orthographic 3D viewer drawn in SVG: axes, lines, arrows, dots, labels, polygons and
plane patches. Readers drag to rotate; when the picture has keyboard focus the arrow keys rotate
it (Shift for bigger steps) and Home resets the view. Requires `math-kit` and `plot-2d` (both added
automatically; the viewer shares plot-2d's colour classes and styles).

## Enable

```json
"packages": { "view-3d": {} }
```

## Options

| Option | Default | Meaning |
|---|---|---|
| `yaw` | `-0.75` | Starting turn about the vertical axis (radians). |
| `pitch` | `0.42` | Starting tilt (radians). |
| `pitchLimit` | `1.4` | Largest tilt either way, so the view never flips. |
| `dragSpeed` | `0.01` | Radians per pixel dragged. |
| `keyStep` | `0.1` | Radians per arrow-key press (Shift × 4). |
| `keyboard` | `true` | Make viewers focusable and keyboard-rotatable. |
| `label` | `"3D view. Drag, or focus and use the arrow keys, to rotate. Home resets."` | `aria-label` for viewers without one. |
| `axisNames` | `["x", "y", "z"]` | Labels written by `V.axes()`. |
| `arrowHead` | `11` | Maximum arrow-head length. |

A view's own options (below) override the package defaults.

## Markup

```html
<div class="widget"><div class="lbl">Two vectors</div><svg id="my-view"></svg></div>
```

Use plot-2d's classes on marks: `c1`…`c4`, `ink`, `muted`, `fill`, `thin`, `dash`, `faint`,
`small`, `halo`, `axis`.

## JavaScript API

```js
const V = Study.view3d.View(document.getElementById('my-view'), { scale: 60 });
V.draw = () => {
  V.axes(2.2);
  V.planePatch([1, 0, 0], [0, 1, 1], 1.8, 'fill c1');
  V.arrow([0, 0, 0], [1, 2, 0.5], 'c2');
};
V.redraw();
```

`View(svg, o)` options: `w`, `h` (viewBox, default 420 × 360), `scale` (pixels per unit, 60),
`yaw`, `pitch`, `pitchLimit`, `dragSpeed`, `keyStep`, `keyboard`, `label`, `draw`.

Points are `[x, y, z]` with `z` up.

| Member | |
|---|---|
| `V.P(p)` | world point → screen `[sx, sy]` |
| `V.depth(p)` | distance towards the viewer (sort by it to paint far things first) |
| `V.line(a, b, cls)` · `V.arrow(a, b, cls)` · `V.dot(p, r, cls)` · `V.text(p, s, cls, dx, dy)` | |
| `V.pline(pts, cls, closed)` | polyline, or polygon when `closed` |
| `V.axes(R = 2.2, names?)` | the three axes from −R to R |
| `V.planePatch(u, v, R = 2, cls = 'fill c1')` | square patch of span(u, v) through the origin; `null` if u, v are dependent |
| `V.draw` / `V.redraw()` | your drawing function / clear and call it |
| `V.scale(s?)` | get, or set and redraw, the zoom |
| `V.rotate(yaw, pitch)` · `V.reset()` | set the angles / back to the start |
| `V.yaw`, `V.pitch`, `V.S`, `V.g` | current state, drawing group |

`Study.view3d.gramSchmidt(vectors, eps = 1e-9)` returns an orthonormal list (floats) spanning
the same space, skipping vectors that are (nearly) dependent on earlier ones.

## Notes for migrating existing notes

Matches the usual hand-rolled `View3D` helper: `V.S = …; V.redraw()` still works alongside
`V.scale()`. The svg is cleared first (keeping `<title>`/`<desc>`), and gains `tabindex="0"`,
`role="img"` and an `aria-label` unless it has its own. With `globalAlias` set in math-kit, the
old names `View3D` and `gramSchmidtFloat` are available on the alias object.
