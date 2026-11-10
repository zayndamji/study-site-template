# code-blocks — highlighted code listings

## What it does
Colours code in `<pre>` blocks (keywords, type names, strings, numbers, comments, preprocessor lines,
function calls) for C, C++, Java, JavaScript and Python. A block can **mark lines** (a soft highlight with
an edge, e.g. the line a passage is about), show **line numbers**, and carry a **file-name caption**.
Inline `<code>` that names its language is coloured too. Highlighting is done in the browser from the
block's plain text, so the source stays readable and copy-paste gives the original code.

## Enable
```json
"packages": { "code-blocks": { "defaultLang": "cpp" } }
```

## Options
| Option | Default | Meaning |
|---|---|---|
| `defaultLang` | `""` | Language of a `<pre>` that names none; `""` = leave such blocks alone |
| `lineNumbers` | `false` | Number every block's lines (a block overrides it with `data-numbers`) |
| `inline` | `false` | Also colour inline `<code>` without a language, in `defaultLang` |
| `types` | `[]` | Extra identifiers to colour as type names (capitalised identifiers already are) |
| `titleLabel` | `"{title}"` | Caption text for `data-title` |
| `markLabel` | `"marked line"` | Screen-reader note on a marked line |

Languages: `cpp` (also `c++`, `cc`, `h`, `hpp`), `c`, `java`, `js` (`javascript`), `py` (`python`),
`text` (no colours, but marks, numbers and captions still work).

## Markup
```html
<pre data-lang="cpp" data-mark="3" data-title="count.cpp">
int countHeads(int flips) {
    int heads = 0;
    for (int i = 0; i &lt; flips; i++) { … }
}
</pre>
<pre><code class="language-py">print("hello")</code></pre>     <!-- class form also works -->
<p>Call <code data-lang="cpp">size()</code> first.</p>
```
- `data-lang` (or `class="language-x"` on the `pre` or its `code`): the language.
- `data-mark="2,5-7"`: lines to mark (1-based).
- `data-numbers="true|false"`: line numbers for this block.
- `data-title`: caption above the block (the block is wrapped in `figure.cb-figure`).
- Write `<`, `>`, `&` as entities, as in any HTML. A common leading indent and the first and last blank
  lines are removed, so a block can be indented with the surrounding markup.

Colours are the custom properties `--cb-kw --cb-ty --cb-str --cb-num --cb-com --cb-pre --cb-fn
--cb-mark --cb-mark-edge` (light and dark values are set); token classes are `.cb-kw`, `.cb-ty`, ….

## JavaScript API
`Study.code`:
- `highlight(text, lang)` → HTML with token spans; `lines(text, lang, {mark})` → HTML with one
  `<span class="cb-line" data-line="n">` per line (`mark`: `"2,4-5"` or a Set of line numbers);
- `render(pre)` (for blocks a script adds; `Study.enhance(el)` also works), `tidy(text)` (strip the
  common indent), `tokens(text, lang)` → `[[class, text], …]`, `lang(name)` (resolve an alias),
  `languages`.
