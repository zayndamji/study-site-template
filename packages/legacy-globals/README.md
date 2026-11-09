# legacy-globals — old global names for old page scripts

## What it does
Hand-built notes sites often expose their shared helpers as one global object, and every page
script calls through it: `Old.diagrams.draw(…)`, `Old.store.get(…)`. When such a site moves onto the
template, this package recreates those globals and points each member at the template's own API, so
the page scripts run unchanged. Members are looked up when used, so it does not matter which
package loads first.

## Enable
```json
"packages": {
  "legacy-globals": {
    "globals": {
      "Old": { "machines": "stateMachine", "chips": "sources", "store": "rawStore" },
      "Helpers": "legacy"
    }
  }
}
```

## Options
| Option | Default | Meaning |
|---|---|---|
| `globals` | `{}` | `{"Name": {"member": "path"}}` makes `window.Name.member`; `{"Name": "path"}` makes `window.Name` itself |

A **path** is a property of `Study`, with dots for nested ones:

| Path | What it is |
|---|---|
| `store` | `Study.store` (keys get the site's `storagePrefix`) |
| `rawStore` | JSON `localStorage` with keys exactly as given, for scripts that wrote full key names |
| `sources` | the `source-viewer` API (`chipify`, `open`, …) |
| `stateMachine` | the `state-machine` API (`model`, `draw`, `run`, …) |
| `legacy` | the flat helper names of `math-kit`, `plot-2d`, `view-3d`, `widget-presets` |
| `plot.Plane`, `math.F`, … | any other part of the API |

A global that already exists is left alone (with a console warning). After load, a path that names
nothing (a typo, or a package that is not enabled) is reported in the console.

## Markup
None.

## JavaScript API
None of its own; it only adds the configured globals.

## Notes for migrating existing notes
List each old global and the members page scripts actually use (`grep -o "Old\.[a-zA-Z]*"`),
then map them here. `math-kit`'s `globalAlias` does the same for a flat helper object; this package
is the general form. Once pages are rewritten to call `Study.*`, remove the entries.
