# widget-presets

## What it does

Adds a row of small pill buttons that load ready-made inputs into a widget. Each preset can
carry a one-line **note** — why this case is worth trying — shown under the row when the preset is
chosen. The chosen button is marked `aria-pressed="true"`. Works with any widget; no other
package is needed.

## Enable

```json
"packages": { "widget-presets": {} }
```

## Options

| Option | Default | Meaning |
|---|---|---|
| `selectFirst` | `true` | Start each row with its first preset selected (declarative rows also send it to the target). |
| `noteLabel` | `""` | Short text before each note, e.g. `"Why:"`. |
| `eventName` | `"preset"` | Event a declarative row dispatches on its target. |

## Markup

Declarative form — no script needed for the buttons:

```html
<div class="widget" id="my-widget">
  <div class="presets" data-target="my-widget">
    <button data-preset='{"a": 1, "b": 0}' data-note="The simplest case.">simple</button>
    <button data-preset='{"a": 0, "b": 0}' data-note="Everything is zero, so nothing happens.">zero</button>
  </div>
  …
</div>
<script>
  document.getElementById('my-widget').addEventListener('preset', (e) => {
    const value = e.detail;        // the parsed data-preset JSON (or the raw string if not JSON)
    …
  });
</script>
```

- `data-target` — id of the element that receives the event (it bubbles).
- `data-preset` — JSON value; `data-note` — the note (HTML allowed).
- Optional on the row: `data-note-target="id"` to show notes in your own element (otherwise a
  `<p class="preset-note">` is added after the row); `data-select-first="false"`.

Each pick also emits `Study.on('preset:pick', ({ target, index, name, value }) => …)`.

## JavaScript API

```js
const row = Study.presets.mount(container, [
  { name: 'simple', value: [1, 0], note: 'The simplest case.' },
  { name: 'zero', value: [0, 0], note: 'Nothing happens.' },
], (preset, index) => { /* load preset.value into the widget */ }, { note: noteElement });
```

`mount(container, list, onPick, o)` — `container` is an element or id. Each preset is any object
with a `name`; `note` and `value` are optional and the whole object is passed to `onPick`.
Options `o`:

- `note` — element for the notes. Omitted: one is created after the container if any preset has
  a note. `false`: no notes.
- `selectFirst` — default from the package option.
- `pickFirst` — also call `onPick` for the first selection (default `true`).
- `noteLabel` — overrides the package option.

The returned handle has `select(indexOrName, { pick: false }?)`, `clear(text?)` (un-press all
buttons and show `text` as the note — call it when the reader edits the widget by hand),
`current()` (index, or −1), `buttons`, `note`, `list`.

`Study.presets.get(container)` returns a row's handle (also for declarative rows);
`Study.presets.clear(container, text)` is a shortcut.

Notes are inserted as HTML (they come from your own content), so they may contain `<i>`,
`<span class="m">` and similar.

## Notes for migrating existing notes

A hand-rolled `presetButtons(box, list, onPick)` maps to `Study.presets.mount(box, list, onPick)`.
Old code that set the first preset and its note itself can pass `{ pickFirst: false }`, or just
drop that code. Notes that used to be written into a separate paragraph with `textContent` can be
given as `note` on each preset plus `{ note: thatParagraph }`. With `globalAlias` set in math-kit,
`presetButtons` (old behaviour: marks the first preset without calling `onPick`, no notes) is on
the alias object. Remove page-level `.presets` CSS once this package is on.
