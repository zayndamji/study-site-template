# state-machine — state diagrams and a step-by-step simulator

## What it does
Draws a **state diagram** from a small JSON spec (states at given positions, labelled arrows
between them, a start arrow, double outlines for accepting states) and, optionally, a **simulator**:
type an input string or pick a preset, then step through it symbol by symbol. The current state (or
set of states, for a nondeterministic machine with ε moves) and the arrows just used light up, and at
the end the machine accepts or rejects. A transition table can be shown under the diagram.

Useful for anything that moves between a few states on inputs: turnstiles and vending machines,
protocols, game rules, text patterns, parsers.

## Enable
```json
"packages": { "state-machine": {} }
```

## Options
| Option | Default | Meaning |
|---|---|---|
| `classPrefix` | `"sm-"` | Prefix of host classes (`sm-sim`, `sm-figure`) and of generated classes (`sm-state`, `sm-edge`, `sm-lbl`, `sm-tape`, …) |
| `classStyles` | `false` | Also style elements that have only the prefixed classes (`sm-tape`, `sm-verdict`, `sm-status`, …), for page scripts that build parts of a simulator themselves |
| `labelColor` | `""` | Edge-label colour: CSS colour or core token; `""` = accent |
| `startLabel` | `"start"` | Text by the start arrow; `""` = none |
| `inputLabel`, `tapeLabel` | `"Input string"`, `"input"` | Input field label, accessible name of the symbol row |
| `resetLabel`, `backLabel`, `stepLabel`, `runLabel` | `"Reset"`, `"Back"`, `"Step"`, `"Run to end"` | Buttons |
| `progress` | `"Read {k} of {n}"` | Status line |
| `currentState`, `noTransition` | `"current state {state}"`, `"no current state (no transition)"` | Deterministic status |
| `currentStates`, `noStatesLeft` | `"current states {{states}}"`, `" — no states left"` | Nondeterministic status (`{{` `}}` print braces) |
| `acceptLabel`, `rejectLabel` | `"Accept"`, `"Reject"` | Verdicts |
| `notInAlphabet`, `readsOnly` | `"Not in the alphabet"`, `"this machine reads only {alphabet}"` | Shown for an input symbol the machine does not read |
| `machineName` | `"Machine {n}"` | Switch button of an unnamed machine |

The package's own CSS targets `data-sm` attributes, so `classPrefix` can be anything; the classes
are there for page CSS and scripts. A page script that builds extra pieces (a second tape, a verdict
in a results list) can give them the prefixed classes and turn on `classStyles`.

## Markup
```html
<div class="widget sm-sim" id="turnstile">
  <div class="lbl">Try it · A coin-operated turnstile</div>
  <script type="application/json">
  { "alphabet": ["c", "p"], "start": "L",
    "states": [ { "id": "L", "label": "locked", "x": 0, "y": 0, "accept": true },
                { "id": "U", "label": "open", "x": 200, "y": 0 } ],
    "edges": [ { "from": "L", "to": "U", "on": ["c"] }, { "from": "U", "to": "L", "on": ["p"] },
               { "from": "L", "to": "L", "on": ["p"] }, { "from": "U", "to": "U", "on": ["c"], "loop": "bottom" } ],
    "inputs": ["cp", "ppc", "cpcp"], "note": "c = insert a coin, p = push the arm." }
  </script>
</div>
<div class="sm-figure"><script type="application/json">{ … }</script></div>   <!-- diagram only -->
```

**Spec.**

| Key | Meaning |
|---|---|
| `alphabet` | the input symbols, one string each |
| `start` | id of the start state |
| `kind` | `"nfa"` or `"dfa"`; automatic when left out (nondeterministic if any edge reads `"ε"` or a state has two moves on one symbol) |
| `states[]` | `id`, `x`, `y` (diagram units), optional `label`, `accept`, `dim`, `shape: "box"`, `w`, `h`, `r` |
| `edges[]` | `from`, `to`, `on` (list of symbols; `"Σ"` = every symbol, `"ε"` = a free move), optional `label`, `math` (label in maths type), `bend` (curve, ± fraction of the length), `offset`, `side`, `loop` (`top` `bottom` `left` `right`), `lp` (label nudge `[dx, dy]`), `hidden` |
| `startDir` | side the start arrow comes from (`left` default) |
| `inputs`, `input` | preset strings (buttons) and the first input |
| `note` | a line under the diagram (other packages, e.g. source chips, process it) |
| `table` | `true` = show the transition table |
| `title`, `scale` | accessible title of the svg; display scale (default 1.15) |
| `machines` | instead of one spec: a list of specs with `name`s, shown with switch buttons |

Labels like `q0` or `q_{in}` get subscripts; a label containing `{` or `,` (a set of states) is drawn
as a box. Two opposite edges between the same states are drawn as parallel arrows.

## JavaScript API
`Study.stateMachine`:

- `model(spec)` → a model; `draw(model, {active, edges, only})` → an `<svg>` (`active`: Set of state
  ids to light up, `edges`: Set of edge indices, `only`: Set of state ids to show);
- `run(model, input)` → a trace `[{set, used}]` after 0, 1, … symbols; `step(model, set, symbol)`;
  `closure(model, set)` (ε moves); `accepts(model, set)`;
- `table(model, active?)` → a transition table element; `mount(host)` (for hosts added later);
  `subHTML(label)` → HTML with subscripts; `prefix`.
