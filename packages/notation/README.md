# notation — colour-coded notation and truth tables

## What it does
- **Colour tags.** Many subjects write several kinds of symbol side by side and teach better when
  each kind keeps one colour everywhere: parts of speech, units versus quantities, keywords versus
  names. List the kinds once; each becomes a class (`<span class="noun">…</span>`) with a light and
  a dark colour. Print always uses the light colours.
- **Truth and value tables.** `table.t.tt` centres the cells in the maths font, can separate the
  inputs from the results with a rule, highlights the result column, colours true/false cells and
  marks rows to look at.

## Enable
```json
"packages": {
  "notation": {
    "tags": {
      "noun": { "light": "#1f45c4", "dark": "#93acff" },
      "verb": { "light": "#c0322a", "dark": "#f2897e" },
      "adj":  "warn-ink",
      "kw":   { "light": "#7b2f9e", "dark": "#d39cf2", "weight": 700, "font": "mono" }
    }
  }
}
```

## Options
| Option | Default | Meaning |
|---|---|---|
| `tags` | `{}` | `{"class": {"light": …, "dark": …, "var": …, "weight": …, "font": …, "style": …}}` or `{"class": colour}`; a colour is a CSS colour or a core token (`term`, `bad`, `ok`, `warn-ink`, `muted`, …); `font` is `body`, `display`, `math` or `mono`; `style` is `normal` or `italic` |

Each tag's colour is also a CSS variable (`--nt-<class>`, or the name given in `"var"`), so a
diagram or a package can reuse it: `fill: var(--nt-noun)`. Use `"var"` to choose the variable
names yourself.

## Markup
```html
<p><span class="adj">Quiet</span> <span class="noun">rivers</span> <span class="verb">run</span> deep.</p>

<div class="tablewrap"><table class="t tt">
  <thead><tr><th>switch A</th><th>switch B</th><th class="sep final">lamp</th></tr></thead>
  <tbody>
    <tr><td class="T">on</td><td class="T">on</td><td class="sep final T">on</td></tr>
    <tr class="hot"><td class="T">on</td><td class="F">off</td><td class="sep final F">off</td></tr>
  </tbody>
</table></div>
```
| Class | On | Meaning |
|---|---|---|
| `tt` | `table.t` | a truth / value table |
| `sep` | `th`, `td` | a rule before this column |
| `final` | `th`, `td` | the result column (highlighted) |
| `T` / `F` | `td` | a true / false cell (`F` is muted; in the result column `T` is green, `F` red) |
| `diff` | `tr` | a row where two columns disagree |
| `hot` | `tr` | a row to look at |

## JavaScript API
None.
