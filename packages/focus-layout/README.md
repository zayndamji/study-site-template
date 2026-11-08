# focus-layout — short sections with folds

## What it does
A layout convention plus small helpers for pages that should not feel congested:

- each section shows **one `.key` idea, its main definition/theorem box, and one or two widgets**;
- everything else (derivations, proofs, applications, extra examples) goes in **`details.reveal.more`** folds;
- the section's quick check goes in **`details.reveal.check`** (marked ✎).

The script adds an **Expand all / Collapse all** button to the top bar, **opens the folds around a linked
`#target`**, unfolds everything for **printing**, and can remember opened folds.

## Enable
```json
"packages": { "focus-layout": {} }
```

## Options
| Option | Default | Meaning |
|---|---|---|
| `toggle` | `true` | Top-bar expand/collapse button (only on pages with folds) |
| `expandLabel` / `collapseLabel` | `"Expand all"` / `"Collapse all"` | Its labels |
| `openOnHash` | `true` | Open folds around link targets |
| `printOpen` | `true` | Unfold for printing |
| `moreIcon` / `checkIcon` | `"▸"` / `"✎"` | Fold markers |
| `remember` | `false` | Remember opened folds per page |

## Markup
```html
<details class="reveal more"><summary>Why it works</summary><div class="body">…</div></details>
<details class="reveal check"><summary>Quick check</summary><div class="body">…</div></details>
```
Plain `details.reveal` (core) still works for anything else.
