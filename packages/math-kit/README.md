# math-kit

## What it does

Gives widget scripts a small, dependency-free maths toolbox as `Study.math`:

- **exact fractions** — add, subtract, multiply, divide, compare and print without rounding;
  read what a reader types (`3/4`, `-0.25`, `−1/2`, `.5`, `1e-3`);
- **number formatting** — `fmt(x, dp)` rounds, drops trailing zeros and prints a real minus
  sign (−) and ∞;
- **exact vector helpers** and **2×2 float helpers** (matrix–vector, matrix–matrix, determinant, inverse);
- **HTML matrices and column vectors** — `mat(rows)` / `col(v)` return a `<span class="mat">`
  grid with brackets that always span its full height;
- `$(id)` and `svgEl(tag, attrs, parent)` for building SVG.

It also gives `.m`, `.mblock`, `.eq` and `.mat` slightly roomier letter and word spacing, which
makes Unicode maths (no TeX engine) easier to read. The amount is an option.

## Enable

```json
"packages": { "math-kit": {} }
```

## Options

| Option | Default | Meaning |
|---|---|---|
| `letterSpacing` | `"0.03em"` | Extra letter spacing for `.m`, `.mblock`, `.eq`, `.mat`; `"normal"` turns it off. |
| `wordSpacing` | `"0.14em"` | Extra word spacing for the same elements; `"normal"` turns it off. |
| `blockLineHeight` | `"2"` | Line height of `.mblock` display maths. |
| `matrixGap` | `"3px 16px"` | Row and column gap between matrix entries. |
| `bracket` | `"square"` | Default brackets for every matrix (hand-written or from `mat()` / `col()`): `"square"`, `"round"`, `"bar"`, `"soft"` (rounded side bars) or `"none"`. |
| `unicodeMinus` | `true` | Print negatives with − (U+2212) instead of a hyphen. |
| `infinity` | `"∞"` | What `fmt()` prints for ±Infinity. |
| `notANumber` | `"—"` | What `fmt()` prints for NaN. |
| `strict` | `true` | Fractions throw on a zero denominator, division by zero or values past 2^53. `false` = no exceptions (a zero denominator gives `d = 0`, `gcd(0, 0) = 1`), like typical hand-rolled helpers. |
| `globalAlias` | `null` | Also expose the flat helper names as `window[globalAlias]` (see migration notes). |

The four spacing options are written by the build into a small `<style>` in each page's
`<head>` as CSS variables (`--mk-letter-spacing`, `--mk-word-spacing`,
`--mk-block-line-height`, `--mk-matrix-gap`); you can also set those variables in
`custom/site.css`.

## Markup

Matrices written by hand need their column count:

```html
<span class="mat" data-cols="2"><span>1</span><span>0</span><span>0</span><span>1</span></span>
```

`data-cols` works for 1–6 columns (or set `style="grid-template-columns:repeat(N,auto)"`).
The `bracket` option sets the look of every matrix. A class overrides it for one matrix:
`mat-square`, `mat-round` (parentheses), `mat-bar` (determinant bars), `mat-soft` (rounded side
bars) or `mat-none` (no brackets).

## JavaScript API

```js
const { F, add, sub, mul, div, neg, isZero, value, str, parse, fmt, mat, col, vec, m2, $, svgEl } = Study.math;
```

**Fractions** are plain objects `{ n, d }`, always reduced, with `d > 0`. Every function accepts
fractions, integers, decimals or numeric strings.

| Call | Result |
|---|---|
| `F(3, 4)`, `F(5)`, `F(0.5)`, `F('-0.25')`, `F(p)` | a reduced fraction (copy of `p`) |
| `add(p, q)` `sub` `mul` `div` | exact result; `div` by zero throws `RangeError` |
| `neg(p)` `inv(p)` `abs(p)` | |
| `isZero(p)` `sign(p)` `cmp(p, q)` `eq(p, q)` `isInt(p)` | |
| `value(p)` | the float `n / d` |
| `str(p)` | `"3/4"`, `"−2"` (with the configured minus) |
| `parse(s)` | a fraction, or `null` if `s` is not a number (or has a zero denominator) |
| `isFrac(x)` | is `x` a `{ n, d }` object |

The same functions hang off `F` too (`F.add`, `F.str`, `F.parse`, …; `F.toString(p)` works).
Fractions use ordinary JS numbers: they are exact while numerators and denominators stay below
2^53, and an operation that would exceed that throws a `RangeError` rather than silently
rounding. Multiplication and addition cancel common factors first to keep numbers small.

**Numbers**: `fmt(x, dp = 3)`, `minus(s)` (hyphens → −), `gcd(a, b)` (`gcd(0, 0) = 0`), `lcm(a, b)`,
`snap(v, step)`, `clamp(v, lo, hi)`.

**Exact vectors** (arrays of fractions or numbers): `vec.dot(a, b)`, `vec.add(a, b)`,
`vec.sub(a, b)`, `vec.scale(c, a)`, `vec.isZero(a)`, `vec.str(a)` → `"(1/2, −3)"`, `vec.of(a)`.

**2×2 floats** (`M = [[a, b], [c, d]]`): `m2.mv(M, v)`, `m2.mm(A, B)`, `m2.det(M)`,
`m2.inv(M)` (returns `null` when the determinant is 0).

**HTML**: `mat(rows, f?, o?)` and `col(v, f?, o?)` return HTML strings. `f(entry, i, j)` turns an
entry into HTML; the default (`show`) prints fractions with `str`, numbers with `fmt`, and
strings as given. `o.bracket` overrides the bracket style; `o.class` adds classes.

```js
out.innerHTML = 'A = ' + mat([[F(1, 2), 0], [0, 2]]) + ', x = ' + col([1, -1]);
```

**SVG**: `svgEl(tag, attrs, parent)` creates an SVG element; `NS` is the SVG namespace; `$(id)`
is `document.getElementById`.

## Notes for migrating existing notes

Old page scripts often take all their helpers from one global object
(`const { F, fadd, fmt, mat, Plane } = window.Helpers;`). Set `"globalAlias": "Helpers"` and
that object exists again, with these flat names: `NS $ el minus fmt gcd lcm F snap clamp fadd fsub
fmul fdiv fneg fzero fval fs parseF fsign vdot vsub vscale vzero mv mm det2 inv2 mat col`, plus
`Plane drag` (plot-2d), `View3D gramSchmidtFloat` (view-3d) and `presetButtons` (widget-presets)
when those packages are on. The same object is always available as `Study.legacy`. Differences
from typical hand-rolled helpers: `inv2` returns `null` for a singular matrix, and with the default
`strict: true`, `F` throws on a zero denominator and `gcd(0, 0)` is 0. Set `"strict": false` to keep
old scripts' forgiving behaviour while they are ported, and `"notANumber": "∞"` if they relied on
`fmt(NaN)` printing ∞. Pick the old matrix look with `bracket`. Move each page's private `.mat` CSS and roomier-spacing rules
out of the page once this package is on.
