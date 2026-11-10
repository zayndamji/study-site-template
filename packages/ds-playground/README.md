# ds-playground — playgrounds for abstract data types

## What it does
An interactive **playground** for one data structure. The reader types an index, value, key or priority,
presses an operation button and watches the structure change, drawn with `memory-diagram`. Beside the
picture:

- a **cost counter** per kind of work (elements moved, nodes visited, swaps, comparisons, elements
  touched), for the last operation and in total, so the growth of the cost with the size is visible;
- each operation's **return value**, or its **error** ("Index out of range", "It is empty", …) as a line,
  never an exception;
- an **operation log** of every call with its result and cost;
- **step by step**: an operation that does real work (shifting, walking, searching, bubbling) shows one
  picture per step with a note, and **Next step** / **Finish** buttons; the counter ticks up as it goes;
- **presets**: named sequences of operations from given contents, each with a one-line note
  (through `widget-presets`).

Kinds:

| `kind` | Operations | Picture | Cost |
|---|---|---|---|
| `vector` | `add(v)` `insert(i, v)` `remove(i)` `get(i)` `set(i, v)` `size` `clear` | cells with indices; optional spare capacity | elements moved (shifted or copied on growth) |
| `stack` | `push(v)` `pop` `peek` `isEmpty` `size` | a vertical pile, top first (or a row) | elements touched |
| `queue` | `enqueue(v)` `dequeue` `peek` `isEmpty` `size` | a row with front and back | elements touched |
| `set` | `add(v)` `remove(v)` `contains(v)` `size` | sorted cells; the binary search lights each probe | comparisons |
| `map` | `put(k, v)` `get(k)` `remove(k)` `containsKey(k)` `size` | sorted key → value rows | comparisons |
| `pq-heap` | `enqueue(p)` or `enqueue(v, p)` `dequeue` `peek` `isEmpty` `size` | the binary heap as a tree and as an array, in sync; each compare and swap lit | comparisons, swaps |
| `linked-list` | `add(v)` (at the end) `addFront(v)` `insert(i, v)` `remove(i)` `get(i)` `size` | nodes with value and next fields, head (and tail) pointer, a `cur` pointer while walking | nodes visited |
| `bst` | `put(k)` `contains(k)` `remove(k)` `size` | the tree; the search path lit step by step; height in the status line | nodes visited |

Values are numbers or short strings; numbers sort before strings. Sets and maps count the comparisons of a
binary search over their sorted keys (what a balanced search tree would make), the heap counts one
comparison per parent check and two per level when bubbling down (children against each other, then the
better child against the parent), and the linked list counts every node read, including the one a
`remove` unlinks.

## Enable
```json
"packages": { "ds-playground": {} }
```
It requires `memory-diagram` (which draws the pictures) and `widget-presets` (preset rows); both are
added automatically.

## Options
| Option | Default | Meaning |
|---|---|---|
| `classPrefix` | `"dsp-"` | Prefix of the host class (`dsp-playground`) and generated classes (`dsp-op`, `dsp-cost`, `dsp-log`, …) |
| `maxSize`, `maxLength` | `12`, `8` | Most elements, longest text value (a spec's `max`, `maxLength` override them) |
| `logLimit` | `60` | Lines kept in the log |
| `opLabels` | the operation names | Button text per operation, e.g. `{ "push": "push on top" }` |
| `indexLabel`, `valueLabel`, `keyLabel`, `priorityLabel` | `"Index"`, `"Value"`, `"Key"`, `"Priority"` | Field labels |
| `nextLabel`, `finishLabel`, `stepLabel` | `"Next step"`, `"Finish"`, `"Step {k} of {n}"` | Step controls |
| `resetLabel`, `zeroLabel` | `"Reset"`, `"Reset count"` | Back to the initial contents; set the counter to zero |
| `sizeLabel`, `capacityLabel`, `heightLabel` | `"Size {size}"`, `"capacity {capacity}"`, `"height {height}"` | Status line |
| `emptyLabel` | `"Empty"` | Drawn for an empty structure |
| `topLabel`, `frontLabel`, `backLabel`, `frontBackLabel` | `"top"`, `"front"`, `"back"`, `"front, back"` | Stack and queue names |
| `headLabel`, `tailLabel`, `curLabel`, `valueField`, `nextField` | `"head"`, `"tail"`, `"cur"`, `"value"`, `"next"` | Linked-list names |
| `entryFormat` | `"{priority}:{value}"` | A heap entry with a value |
| `returned`, `noReturn`, `trueLabel`, `falseLabel` | `"Returned {value}"`, `""`, `"true"`, `"false"` | Result line |
| `costMoved`, `costVisited`, `costSwaps`, `costCompares`, `costTouched` | `"Elements moved"`, `"Nodes visited"`, `"Swaps"`, `"Comparisons"`, `"Elements touched"` | Counter names |
| `costLast`, `costTotal`, `costShort` | `"last operation"`, `"in total"`, `"{label}: {n}"` | Counter words; cost in a log line |
| `logLabel`, `logEmpty` | `"Operations"`, `"Press an operation to start."` | Log heading and placeholder |
| `errorIndex`, `errorEmpty`, `errorFull`, `errorKey` | `"Index out of range"`, `"It is empty"`, `"Full: this playground holds at most {max}"`, `"Key not found"` | Errors |
| `errorInteger`, `errorNumber`, `errorValue`, `errorLong`, `errorOp` | `"Enter a whole number"`, … | Input errors; `errorOp` only from the API |
| `note…` | see `package.json` | The note of each kind of step, e.g. `noteMove` `"Move {value} from index {from} to {to}"`, `noteUpSwap`, `noteVisit` |

`python3 tools/study.py info ds-playground` lists every option with its default.

## Markup
```html
<div class="widget dsp-playground" id="my-vector">
  <div class="lbl">Try it · A vector</div>
  <script type="application/json">
  { "kind": "vector", "initial": [3, 8, 1], "capacity": 4, "suggest": [5, 12, 7],
    "presets": [
      { "name": "Insert at the front of a long vector", "initial": [1, 2, 3, 4, 5, 6, 7, 8],
        "ops": [["insert", 0, 99]], "note": "Every element moves one place." } ] }
  </script>
</div>
```

**Spec.**

| Key | Meaning |
|---|---|
| `kind` | one of the kinds above (required) |
| `initial` | starting contents: a list of values; for `map` an object `{key: value}` or `[[key, value], …]`; for `pq-heap` priorities, or `[value, priority]` / `{"value", "priority"}` with `pairs` (inserted in order, so any order is fine) |
| `ops` | operations to offer, in button order (default: all of the kind) |
| `presets` | `[{name, note, initial, ops: [[op, arg…], …], watch}]`: Reset to `initial` (default the spec's), zero the counter, run `ops`; only the last one plays step by step unless `"watch": "all"` |
| `steps` | `false` = apply every operation at once (no step controls) |
| `valueType` | `"any"` (default: numerals become numbers), `"number"`, `"text"` |
| `max`, `maxLength` | most elements; longest text value |
| `suggest` | values the value (or key) field cycles through after each use, or `"random"` (1–99) |
| `fields` | starting field contents, e.g. `{ "index": 2, "value": 5, "key": "fig", "priority": 3 }` |
| `labels` | overrides of any option string for this playground, including `opLabels` |
| `title`, `scale` | accessible title and display scale of the picture |
| `capacity`, `growth` | `vector`: show an array of this many slots that grows by `growth` (default 2) when full, copying every element |
| `orientation` | `stack`: `"vertical"` (default) or `"horizontal"` |
| `order`, `base`, `pairs` | `pq-heap`: `"min"` (default) or `"max"`; array index of the root, `1` (default) or `0`; `true` = `enqueue(value, priority)` |
| `tail`, `perRow` | `linked-list`: also keep a tail pointer (then `add` visits one node, not all); nodes per row (default 4) |
| `heightEdges` | `bst`: height counts edges (a single node has height 0) instead of levels |

`study.py check` reports specs that are not valid JSON, unknown kinds, operations the kind does not have
(in `ops` and in presets, with the right number of arguments), `initial` lists of the wrong shape or longer
than `max`, and bad values of the keys above.

## JavaScript API
`Study.playground`:

- `model(kind, spec)` (or `model(spec)`) → a DOM-free model, usable from page scripts and in tests:
  - `apply(op, args)` → `{ call, args, result, hasResult, text, error, cost, steps }`. `args` may be
    strings (as typed) or values. `error` is a message or `null`; `cost` maps counter keys (`moved`,
    `visited`, `swaps`, `compares`, `touched`) to amounts; `steps` is a list of `memory-diagram` scenes, each
    with a `note` and the `cost` so far; the last one shows the final state (an input error has none);
  - `scene()`, `contents()`, `size()`, `info()` (`{size, capacity?, height?}`), `reset(initial?)`;
  - `ops` (`[{name, label, args}]`, args among `i v k p`), `signature`, `metrics`, `metricLabel(key)`, `max`.
- `mount(host, spec?)` → a handle `{ model, run(op, …args), reset(), finish(), preset(name), element }`;
  the spec defaults to the host's JSON child. Hosts added later are also mounted by `Study.enhance(el)`.
- `kinds` (each kind's operations and counters), `prefix`.

```js
const m = Study.playground.model('linked-list', { initial: [4, 8, 15] });
m.apply('get', [2]).cost.visited;   // 3
m.apply('remove', [9]).error;       // "Index out of range"
```
