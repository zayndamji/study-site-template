# `site.json` reference

Everything about a site that is not page content lives in one file. Only `site.title` and
`pages` are really needed; every other key has a default (see `tools/studylib/common.py` →
`DEFAULTS`). Unknown keys are kept and passed to packages, so a package can read its own extra
page fields.

```jsonc
{
  "template": "../study-site-template",   // informational: where the tools live
  "site": {
    "title": "Example Notebook",
    "brand": { "text": null, "open": "[", "close": "]" },  // top-left mark; text defaults to title
    "description": "",                    // <meta name=description> (pages use their own description)
    "lang": "en",
    "storagePrefix": "study:",            // localStorage key prefix: give every site its own
    "defaultTheme": "system",             // system | light | dark
    "favicon": "auto",                    // "auto" (generated from brand + accent), a path, or null
    "footer": "{site}",                   // home and package pages
    "pageFooter": "{site} · {noun} {id} · {position} of {count}",
    "titleFormat": "{short} {id} · {title} — {site}"   // browser tab title of a page
  },
  "theme": {
    "fonts": {
      "css": ["https://fonts.googleapis.com/css2?…"],   // stylesheet URLs; [] for system fonts only
      "display": null, "body": null, "math": null, "mono": null   // CSS font stacks
    },
    "tokens": {
      "all":   { "--radius": "6px", "--content-width": "46rem" },
      "light": { "--term": "#0b6e4f", "--term-soft": "#e3f4ec" },
      "dark":  { "--term": "#6fd3a8", "--term-soft": "#12301f" }
    }
  },
  "build": {
    "outDir": "dist", "contentDir": "content", "staticDir": "static", "packagesDir": "packages",
    "cacheBust": true,                    // ?v=<hash> on the bundled assets
    "css": [], "js": []                   // extra site files to bundle (custom/site.css|js are automatic)
  },
  "nav": {
    "picker": true,                       // page switcher in the top bar
    "prevNext": true,
    "home": "Home",                       // first option of the switcher
    "prevShort": "← Prev", "nextShort": "Next →",          // narrow screens
    "prevLong": "← {short} {id}", "nextLong": "Next: {label} →",  // wide screens
    "pickerOption": "{id} · {label}",
    "showPlanned": false                  // set by the coming-later package
  },
  "home": {
    "intro": { "eyebrow": "", "tagline": "" },   // HTML allowed; both empty = no intro line
    "search": true,
    "searchPlaceholder": "Find a page or topic…",
    "filters": "auto",                    // auto | groups | kinds | none
    "allLabel": "Everything",
    "columns": 3,
    "showRange": true,                    // "01–09" above each group
    "emptyText": "No matching pages."
  },
  "kinds": {
    "unit": {
      "noun": "Unit", "plural": "Units", "short": "Unit",
      "file": "unit-{id}.html",           // output file name
      "source": "units/{id}.html",        // under content/
      "storageKey": "{id}",               // progress key; keep an old site's ids here when migrating
      "eyebrow": "{noun} {id}",
      "rail": "Sections",                 // rail heading
      "review": true,                     // "Mark section as reviewed" buttons + progress
      "prevNext": true,
      "numbered": true,                   // show the id as a number on home rows
      "inPicker": true
    }
  },
  "groups": [
    { "id": "part-1", "title": "Part one", "note": "optional small line", "range": null, "filterLabel": null }
  ],
  "pages": [
    {
      "id": "01",                         // string; numeric ids get number search ("3" finds 03)
      "kind": "unit",                     // defaults to the first kind
      "title": "Full title",
      "label": "Short title for lists",   // defaults to title
      "description": "One line, searchable",
      "keywords": "extra search words",
      "group": "part-1",
      "status": "ready",                  // ready | planned | anything else (only ready is built)
      "file": "…", "source": "…", "storageKey": "…"   // per-page overrides of the kind templates
    }
  ],
  "packages": {
    "summaries": {},                      // {} = defaults; list options with `study.py info <name>`
    "cite-pills": { "pageLabel": "p. {page}" }
  }
}
```

## Template fields

Strings such as `titleFormat`, `eyebrow`, `pageFooter`, `nav.*Long` and kind `file`/`source` accept:
`{id} {title} {label} {noun} {short} {plural} {kind} {group} {site} {position} {count} {last}`.
Unknown fields are left as written.

## Page front matter

A content file may start with a JSON comment. All keys are optional:

```html
<!--page {
  "lede": "Shown under the title (HTML allowed)",
  "eyebrow": "Overrides the kind's eyebrow",
  "title": "Overrides the h1 (site.json title stays for lists)",
  "docTitle": "Overrides the browser tab title",
  "styles": ["static-relative.css"], "scripts": ["static-relative.js"],
  "rail": false, "railTitle": "On this page", "review": false,
  "footer": "…", "bodyClass": "wide"
} -->
```

Packages read their own keys from it too (e.g. `one-minute` reads `"overview": [...]`).

## Several kinds

The first kind in `kinds` is the main sequence. Add more for other page types, or enable the
`resources` package, which adds a `guide` kind. Prev/Next runs within a kind.
