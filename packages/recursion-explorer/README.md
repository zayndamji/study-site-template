# recursion-explorer — step through a recursive function as it really runs

## What it does
A page script gives the code to show and the same function written in JavaScript with a few recording
hooks. The package runs it once, records every event (call, line, output, local variable, return, extra
state) and lets the reader step through the run. All views move together:

- **Code**: the current line of the current call is marked (code-blocks).
- **Call stack**: a memory column (memory-diagram, layout `"memory"`), one frame per call in progress with its
  parameters and locals; the newest frame is lit, and on the step a call returns its frame shows the value.
- **Call tree**: calls appear in the order they are made, the path to the current call is lit, returned calls
  show their value, calls can be marked good or bad (e.g. a dead end in a search). Click a call to jump to it.
- **Expression**: for calls given a `wait` template, the nested expression still waiting on answers, e.g.
  `answer = 3 + (2 + total(1))`, collapsing as answers come back.
- **Output**, **counters** (calls so far, depth now, deepest so far, values returned in order) and **state**
  (any memory-diagram scene the program shows: a memo array, a grid, a list of choices so far).

Controls: Reset, Back, Step, Step over, Step out, Play / Pause, Run to end. Inputs and preset buttons
(widget-presets) re-run the program with new arguments. A runaway recursion stops at `maxSteps` / `maxDepth`.

## Enable
```json
"packages": { "recursion-explorer": {} }
```
It requires `memory-diagram`, `code-blocks` and `widget-presets` (added automatically).

## Options
| Option | Default | Meaning |
|---|---|---|
| `classPrefix` | `"rx-"` | Prefix of the generated classes (styles use `data-rx` roles) |
| `maxSteps`, `maxDepth`, `speed` | `3000`, `200`, `700` | Recording limits; ms between steps while playing |
| `resetLabel` `backLabel` `stepLabel` `overLabel` `outLabel` `playLabel` `pauseLabel` `endLabel` | Reset, Back, Step, Step over, Step out, Play, Pause, Run to end | Buttons |
| `countLabel` | `"Step {k} of {n}"` | Status |
| `codeLabel` `exprLabel` `stackLabel` `treeLabel` `stateLabel` `outputLabel` `statsLabel` | Code, Expression, Call stack, Call tree, State, Output, Counts | Pane headings |
| `callsLabel` `depthLabel` `maxDepthLabel` `returnsOrderLabel` `tagCountLabel` | Calls so far, Depth now, Deepest so far, Returned, in order, Marked “{note}” | Counters (one tag row per note used with `rx.tag`) |
| `returnsLabel`, `treeReturn`, `frameName`, `mainName` | `"returns"`, `"→ {value}"`, `"{name}()"`, `"main()"` | Frame row on return, tree note, frame names |
| `startText` `callText` `returnText` `returnVoidText` `printText` `setText` `lineText` `endText` `endValueText` | see `study.py info recursion-explorer` | The sentence shown for each step unless the program gives one with `rx.note` |
| `limitText`, `depthText`, `errorText`, `ownValues` | | Messages |

## Markup
A host element, then a script after it:
```html
<div class="widget" id="my-explorer"><div class="lbl">Try it · total(n)</div></div>
<script>
Study.recursion.mount('#my-explorer', {
  lang: 'cpp', code: 'int total(int n) {\n    if (n == 0) return 0;\n    return n + total(n - 1);\n}',
  inputs: [{ name: 'n', label: 'n', value: 3, min: 0, max: 8 }],
  presets: [{ label: 'n = 3', values: { n: 3 }, note: 'Why this case is worth trying.' }],
  main: (rx, v) => rx.call('total', [v.n], { wait: 'answer = □' }),
  functions: {
    total(rx, n) {
      rx.line(2); if (n === 0) return 0;
      rx.line(3); return n + rx.call('total', [n - 1], { wait: n + ' + □' });
    },
  },
});
</script>
```

**Spec.**

| Key | Meaning |
|---|---|
| `functions` | `{ name(rx, …args) { … } }`: the recorded functions; call each other only through `rx.call` |
| `main(rx, values)` | the driver (its frame is named `mainName`); default: call the first function with `args` |
| `args` | without `main`: the input names passed to the first function, in order |
| `params` | `{ name: ["a", "b"] }` parameter names, when they can't be read from the function source |
| `code`, `lang`, `codeTitle` | the listing shown (line numbers in `rx.line` refer to it) |
| `inputs` | `[{ name, label, value, min, max, type: "number" \| "text", size }]` fields that re-run the program |
| `presets` | `[{ label, values: {…}, note }]` |
| `views` | panes to show, in this order of preference: `code expr stack tree state output stats` (default all; a pane the run never uses hides itself) |
| `steps` | `"all"` (default: every event is a step) or `"calls"` (calls, returns, output and state only) |
| `mainName`, `mainFrame` | the driver frame's name; `false` hides that frame |
| `frameName` | this widget's frame names (`{name}`, `{call}`), overriding the `frameName` option |
| `above` | static frames drawn above the driver, e.g. `[{ "name": "main()" }]` |
| `stackScene`, `treeScene` | extra memory-diagram scene keys for the stack (e.g. `base: ["Text"]`) and the tree (e.g. `arrows`) |
| `treeMain` | `true` puts the driver at the root of the tree even with one top-level call |
| `format(value)`, `callLabel(name, args)` | how values and calls are written (default C-like: `"text"`, `{1, 2}`, `f(1, 2)`) |
| `maxSteps`, `maxDepth`, `speed`, `showReturns` | per-widget limits; `showReturns: false` drops the returned-values counter |

**Hooks** (the `rx` argument): `rx.line(n)`, `rx.call(name, args, { label, wait })` (returns the
call's value; `wait` is the caller's pending expression with `□` where the value goes), `rx.print(text)`,
`rx.set(name, value)`, `rx.show(key, scene)` (a memory-diagram scene, copied at that moment),
`rx.tag("ok" | "bad", note)` (mark the current call in the tree), `rx.note(html)` (this step's sentence).

The host fires `rx:step` (`detail: { k, n, state }`) after every step, for page scripts that add views.

## JavaScript API
`Study.recursion`: `mount(host, spec)` → `{ run(), step(k), set(values), steps, index }`;
`record(spec, values)` → `{ events, frames, stopped, result }` (DOM-free, for tests); `stateAt(run, k)`;
`expression(run, state)`; `format(value)`.
