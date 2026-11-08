# worked-examples

## What it does

"More worked examples" cards: a numbered heading, the task, a collapsible solution (which can hold
a core stepper) and buttons that load the example's numbers into a widget on the page. Loading
scrolls the widget into view (smoothly, unless the reader prefers reduced motion) and briefly
highlights it. Inside an `.exm-list`, cards sit in a grid on wide screens and an opened card takes
the full row. The card styles live here once instead of in every page.

## Enable

```json
"packages": { "worked-examples": {} }
```

## Options

| Option | Default | Meaning |
|---|---|---|
| `solutionLabel` | `"Show solution"` | Text for an empty or missing `<summary>` in `details.exm-sol`. |
| `loadLabel` | `"Load in widget"` | Text for an empty load button. |
| `numbering` | `true` | Fill each empty `.exm-n` with the card's number on the page. |
| `numberLabel` | `"Example {n}"` | Text for automatic numbering. |
| `eventName` | `"load"` | Event dispatched on the target. Change it if the target is an `img`, `iframe` or `svg`, which fire native `load` events. |
| `scroll` | `true` | Scroll the target into view after loading. |
| `flashMs` | `1200` | Highlight duration in ms; `0` = none. |

## Markup

```html
<div class="exm-list">                       <!-- optional grid wrapper -->
  <div class="exm" id="ex-sum">
    <div class="exm-head">
      <span class="exm-n">Example 1</span>    <!-- leave empty for automatic numbering -->
      <span class="exm-t">Title</span>
      <span class="exm-tag">optional tag</span>
    </div>
    <div class="exm-task">The problem…</div>
    <details class="exm-sol"><summary>Show solution</summary>
      …the solution; may contain <div class="widget stepper">…</div>…
    </details>
    <div class="exm-actions">
      <button class="btn" data-load='{"a": [2, 0]}' data-target="my-widget">Load in widget</button>
    </div>
  </div>
</div>
```

The widget receives the parsed `data-load` JSON (or the raw string if it is not JSON):

```js
document.getElementById('my-widget').addEventListener('load', (e) => { set(e.detail); render(); });
```

A button outside a card works too if it has class `exm-load`. Each load also emits
`Study.on('example:load', ({ target, value, example }) => …)`.

## JavaScript API

- `Study.examples.load(targetIdOrElement, value)` — dispatch, scroll and highlight, as a button
  would; returns `false` if there is no such element.
- `Study.examples.flash(element)` — scroll to and highlight any element.

## Notes for migrating existing notes

Cards written as `<div class="exm">` with `exm-head`, `exm-n`, `exm-t`, `exm-task` and
`exm-actions` keep working; change a solution's `<details class="reveal"><summary>…</summary><div
class="body">…</div></details>` to `<details class="exm-sol">` (the `.body` wrapper is optional) or
leave it as a core reveal. Replace per-page load wiring (a data attribute plus a table of loader
functions) with `data-load` + a `load` listener on each widget, rename tag badges inside the head
to `exm-tag`, and delete the per-page `.exm` CSS.
