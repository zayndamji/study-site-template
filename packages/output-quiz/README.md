# output-quiz — predict the output

## What it does
A **"predict the output"** exercise: a code listing (coloured by `code-blocks`, added automatically)
and a box where the reader types the output they expect, one line per line. **Check** compares the
answer with the expected output line by line and marks every line as matching or not. After the last
allowed try, or with **Show answer**, the expected lines appear next to the reader's, and the
explanation from the markup is shown. A **value** variant has a one-line field for "what does it
return?" questions and accepts several spellings of the answer.

Answers, tries and the verdict are saved per widget (`data-id`), so they survive a reload; **Reset**
clears them. Settled widgets report through the core `quiz:answer` event, so progress features that
count core quiz answers count these too.

## Enable
```json
"packages": { "output-quiz": {} }
```

## Options
| Option | Default | Meaning |
|---|---|---|
| `attempts` | `3` | Checks before the answer is shown; `0` = unlimited |
| `showExpected` | `"end"` | `"end"`: expected lines appear after the last try or Show answer; `"wrong"`: after every wrong check |
| `trimTrailing` | `true` | Ignore spaces and tabs at the end of lines |
| `trimLeading` | `false` | Ignore indentation at the start of lines |
| `collapseSpaces` | `false` | Treat runs of spaces and tabs as one space |
| `ignoreBlankLines` | `false` | Leave blank lines out (blank lines at the very end never count) |
| `caseSensitive` | `true` | Compare letter case |
| `rows` | `4` | Starting height of the answer box (it grows while typing) |
| `defaultLang` | `""` | Language of a listing that names none; `""` = code-blocks' `defaultLang`, else plain text |
| `quizEvents` | `true` | Emit core `quiz:answer` once a widget is settled |
| `outputPrompt`, `valuePrompt` | `"What does it print?"`, `"What does it return?"` | Field labels |
| `outputPlaceholder`, `valuePlaceholder` | `"One line of output per line"`, `""` | Placeholders |
| `checkLabel`, `revealLabel`, `resetLabel` | `"Check"`, `"Show answer"`, `"Reset"` | Buttons |
| `triesLeft`, `attemptsMade` | `"{left} of {max} tries left"`, `"Checked {used}×"` | Status (limited / unlimited tries) |
| `empty` | `"Type your answer first."` | Check with an empty answer |
| `right`, `rightValue` | `"Right: every line matches."`, `"Right."` | Correct verdicts |
| `wrong`, `lineCount`, `wrongValue` | `"Not yet: {right} of {total} lines match."`, `" The output has a different number of lines."`, `"Not yet."` | Wrong verdicts (`{right} {total} {given}`) |
| `outOfTries`, `revealed` | `"No tries left. The expected answer is shown."`, `"The expected answer is shown."` | Settled without a right answer |
| `yoursHeading`, `expectedHeading` | `"Yours"`, `"Expected"` | Column headings |
| `lineHeading`, `markHeading` | `"Line"`, `"Match"` | Screen-reader headings of the number and mark columns |
| `rightMark`, `wrongMark` | `"✓"`, `"✗"` | Line marks |
| `rightLine`, `wrongLine` | `"matches"`, `"differs"` | Screen-reader words for the marks |
| `missingLine`, `blankLine` | `"(no line)"`, `"(blank)"` | Shown for a missing or an empty line |
| `alsoAccepted` | `"Also accepted: {list}"` | Value mode: other accepted answers, when the answer is shown |

Every comparison option and `attempts`, `showExpected`, `rows` can be set per widget with a data
attribute: `data-attempts="0"`, `data-show-expected="wrong"`, `data-trim-trailing="false"`,
`data-trim-leading`, `data-collapse-spaces`, `data-ignore-blank-lines`, `data-case-sensitive`, `data-rows`.

## Markup
```html
<div class="widget oq" data-id="site-unique-id">
  <div class="lbl">Predict the output · A loop</div>
  <pre data-lang="js">
    for (let i = 3; i &gt; 0; i--) console.log(i);
  </pre>
  <script type="text/plain" class="oq-expected">
    3
    2
    1
  </script>
  <template class="oq-explain"><p>Why it prints that.</p></template>
</div>

<div class="widget oq" data-id="another-id" data-mode="value">     <!-- "what does it return?" -->
  <pre data-lang="py">len("hello")</pre>
  <script type="text/plain" class="oq-expected">5</script>        <!-- or data-expected="5" -->
</div>
```
- `data-id` is required and unique across the site (it is also the id in `quiz:answer`, so it may not
  repeat a core quiz id); `check` enforces it, and that every widget has a `<pre>` and an expected answer.
- The `<pre>` takes every `code-blocks` attribute (`data-lang`, `data-mark`, `data-title`, `data-numbers`).
- The expected block is plain text: write `<` and `&` as they are (no entities), but never `</script`.
  As with code blocks, a common indent and the first and last blank lines are removed.
- **Value mode** (`data-mode="value"`): each non-blank line of the expected block is one accepted
  answer; both sides are trimmed before comparing.
- `template.oq-explain` (optional) is shown once the widget is settled: right, out of tries, or answer shown.
- Keys: Ctrl+Enter (or ⌘+Enter) checks the output box; Enter checks the value field.

Saved state: store key `oq:<id>` → `{ text, tries, status, checked }` (`status`: `""`, `"right"`,
`"out"` or `"revealed"`).

## JavaScript API
`Study.outputQuiz`:
- `compare(expected, given, settings)` → `{ ok, right, total, given, rows: [{n, exp, got, ok}] }`
  (`exp`/`got` are `null` where a side has no line);
- `compareValue(expected, given, settings)` → the same shape with one row, plus `accepted`;
- `prepare(text, settings)` → `[{text, key}]` (lines as shown and as compared);
- `settings(host, base?)` → the comparison settings of a widget (options, then data attributes);
- `tidy(text)`, `mount(host)` (for widgets added later; `Study.enhance(el)` also works), `key(id)`.

Events: `Study.on('oq:check', ({id, tries, correct, right, total}) => …)` on every check, and the core
`quiz:answer` with `{ id, index: 0, correct, source: "output-quiz" }` once per settling.
