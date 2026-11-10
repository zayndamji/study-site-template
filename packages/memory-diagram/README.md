# memory-diagram — memory pictures, trees, arrays and a code tracer

## What it does
Draws, from a small JSON **scene**:
- **memory**: stack frames (a name and its variables) and heap objects (arrays with indices, or records
  with named fields such as a node's value and next pointer), with an **arrow** from every pointer to what
  it points at. Pointers can be null, objects can be freed (a pointer into one is drawn as dangling),
  and any frame, variable, object or cell can be lit up;
- **trees**: binary trees (left and right kept apart even when a child is missing) or trees of any arity,
  laid out automatically, with optional edge labels, arrows and side notes (e.g. return values of calls);
- **arrays**: a row of cells with optional indices.

A **tracer** (`md-trace`) steps through a list of scenes, optionally beside a code listing whose current
line is marked, with a note and printed output per step. Each step only states what changed: a scene
part it leaves out is kept from the step before.

Useful for anything about how data sits in memory or how calls unfold: pointers and references,
linked structures, recursion, trees, sorting by hand.

## Enable
```json
"packages": { "memory-diagram": { "nullLabel": "nullptr" } }
```
It requires `code-blocks` (added automatically), which highlights the tracer's code.

## Options
| Option | Default | Meaning |
|---|---|---|
| `classPrefix` | `"md-"` | Prefix of host classes (`md-figure`, `md-trace`) and generated classes (`md-frame`, `md-cell`, `md-arrow`, …) |
| `stackLabel`, `heapLabel` | `"Stack"`, `"Heap"` | Region headings |
| `nullLabel` | `"null"` | Text in a null pointer cell |
| `resetLabel`, `backLabel`, `nextLabel` | `"Reset"`, `"Back"`, `"Next"` | Tracer buttons |
| `stepLabel` | `"Step {k} of {n}"` | Tracer status |
| `outputLabel` | `"Output"` | Heading of a step's output |

## Markup
```html
<div class="md-figure"><script type="application/json">{ scene }</script></div>
<div class="widget md-trace"><div class="lbl">Try it · …</div>
  <script type="application/json">{ "code": "…", "lang": "cpp", "steps": [ {scene + line, note, out}, … ] }</script></div>
```

**Scene** (any mix of the parts; they are drawn top to bottom: memory, tree, array):

| Key | Meaning |
|---|---|
| `stack` | frames, drawn top to bottom in the order listed: `{name, vars: [var], on, dim, done}` (`done` = dashed, a frame that has returned) |
| var | `{name, value, ptr, on, dim, junk}` or a stack array `{name, cells: [cell], index: true}` |
| `heap` | objects: `{id, cells: [cell] \| fields: [{name, value \| ptr}], index, label, row, x, gap, on, dim, freed}`; objects with the same `row` (default 0) sit side by side, left to right; `x` places one at an offset in its row |
| cell | `"7"` or `{value, ptr, on, dim, junk}`; `"ptr": "id"` points at an object, `"id#2"` at its cell 2, `"id.next"` at its field `next`; `"ptr": null` is a null pointer (`nullLabel`, unless `value` is given); `junk` = an uninitialised value, drawn muted |
| `layout` | `"columns"` (default: heap to the right of the stack) or `"rows"` (heap below) |
| `tree` | `{v, l, r}` (binary) or `{v, c: [children]}`; each node may have `on`, `dim`, `e` (label on the edge from its parent), `note` (text to its right) |
| `arrows`, `spacing`, `levelGap` | tree edges with arrowheads; extra horizontal space between nodes (default 14); vertical distance between levels (default 64) |
| `array` | `[cell]` or `{cells, index: true \| first index, label}` |
| `title`, `note`, `scale` | accessible title; a line under a figure (HTML; source chips work); display scale (default 1) |

**Tracer**: `code` (plain text, `\n` between lines), `lang` (a code-blocks language), `codeTitle`, and
`steps`, each a scene plus `line` (a line number or a list of them to mark), `note` (HTML) and `out`
(the output printed so far; kept from the step before when left out). Scene parts at the top level are
the first step's defaults.

`study.py check` reports invalid JSON, heap objects without an `id`, pointers to unknown objects and
scenes with nothing to draw.

## JavaScript API
`Study.memory`: `draw(scene)` → an `<svg>` (wrap it in `<div class="diagram-wrap">`), `mount(host)` for
hosts added later (or `Study.enhance(el)`), `layoutTree(root)` → `{nodes, edges, binary}` with each
node's `slot` (column) and `depth`, `prefix`.
