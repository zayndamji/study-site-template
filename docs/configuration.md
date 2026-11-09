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
    "footer": "{site}",                   // home and package pages (HTML allowed; site fields below)
    "pageFooter": "{site} · {noun} {badge} · {position} of {count}",
    "titleFormat": "{short} {badge} · {title} — {site}"   // browser tab title of a page
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
    "prevLong": "← {short} {badge}", "nextLong": "Next: {label} →",  // wide screens
    "pickerOption": "{badge} · {label}",
    "showPlanned": false                  // set by the coming-later package
  },
  "home": {
    "intro": { "eyebrow": "", "tagline": "" },   // HTML allowed; both empty = no intro line
    "search": true,
    "searchPlaceholder": "Find a page or topic…",
    "filters": "auto",                    // auto (kinds if several kinds are listed, else groups) | groups | kinds | none
    "allLabel": "Everything",
    "columns": 3,
    "showRange": true,                    // "01–09" above each group
    "emptyText": "No matching pages.",
    "columnWidths": null,                 // e.g. ".9fr 1fr 1.1fr": unequal columns on wide screens
    "after": "",                          // HTML after the catalog (a help box, a note); site fields allowed
    "afterFile": null                     // or a file under content/ with that HTML
  },
  "kinds": {
    "unit": {
      "noun": "Unit", "plural": "Units", "short": "Unit",
      "file": "unit-{id}.html",           // output file name
      "source": "units/{id}.html",        // under content/
      "storageKey": "{id}",               // progress key (localStorage): changing it loses readers' progress
      "eyebrow": "{noun} {badge}",
      "rail": "Sections",                 // rail heading
      "review": true,                     // "Mark section as reviewed" buttons + progress
      "prevNext": true,
      "numbered": true,                   // show the id as a number on home rows
      "inPicker": true,
      "titleFormat": null,                // browser title of this kind's pages; null = site.titleFormat
      "pageFooter": null                  // footer of this kind's pages; null = site.pageFooter
    }
  },
  "groups": [
    { "id": "part-1", "title": "Part one", "note": "optional small line", "range": null, "filterLabel": null }
  ],
  "pages": [
    {
      "id": "01",                         // string; numeric ids get number search ("3" finds 03)
      "badge": "A1",                      // optional display number (home rows, picker, titles, footer); defaults to id
      "noun": "Appendix", "short": "App.", // optional per-page overrides of the kind's noun / short noun
      "kind": "unit",                     // defaults to the first kind
      "title": "Full title",
      "label": "Short title for lists",   // defaults to title
      "description": "One line, searchable",
      "keywords": "extra search words",
      "group": "part-1",
      "status": "ready",                  // ready | planned | anything else (only ready is built)
      "statusLabel": "Draft",             // badge text: coming-later (planned pages), preview-pages (ready ones)
      "statusNote": "…",                  // preview-pages: this page's banner text
      "file": "…", "source": "…", "storageKey": "…",  // per-page overrides of the kind templates
      "only": ["default"], "except": ["public"]       // which builds include the page (see Variants)
    }
  ],
  "variants": {                           // other builds of the same sources (see Variants)
    "public": { "outDir": "dist-public", "config": {}, "exclude": [] }
  },
  "packages": {
    "summaries": {},                      // {} = defaults; list options with `study.py info <name>`
    "cite-pills": { "pageLabel": "p. {page}" }
  }
}
```

## Template fields

Strings such as `titleFormat`, `eyebrow`, `pageFooter`, `nav.*Long` and kind `file`/`source` accept:
`{id} {badge} {num} {title} {label} {noun} {short} {plural} {kind} {group} {site} {position} {count} {last}`.
Unknown fields are left as written.

- `{badge}` is the page's display number: its `badge` field, or its id when there is none.
- `{num}` is the number in the id without leading zeros (`"07"` → `7`), or the id itself when the id
  has no number. Use it for labels like `"Ch {num}"`; keep `{id}` in file names and storage keys.

**Site fields** — the home `intro`, `home.after`, `site.footer` and `site.pageFooter` can also use
`{pages}` (number of ready pages) and, for each kind, `{<kind>Count}`, `{<kind>First}` and
`{<kind>Last}` (the badges of its first and last ready page), e.g.
`"footer": "{site} · {lectureCount} lectures &amp; {guideCount} guides"`.

The page switcher lists pages group by group, in the order of `groups`, even when the page order
(which drives Prev/Next) moves back and forth between groups.

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

## Hosting

`dist/` is plain static files: serve it from any web server, GitHub Pages, or upload it as a
multi-file page.

- `build.cacheBust` adds `?v=<hash>` to the two bundled assets so browsers fetch new versions. Turn
  it off (`false`) for hosts that do not serve URLs with a query string.
- `.study-build` in the output folder only marks it as generated (the build refuses to overwrite a
  folder without it). Leave it out when you upload the files somewhere.
- Rebuilds sync the output folder rather than wiping it, so a large `static/` (source images) is
  copied only when files change.
- Readers' progress is stored per origin (browser storage): moving the site to another address
  starts everyone afresh.
- To keep a hosted site out of search engines, use the `privacy` package (`noindex`, on by default).

## Variants

One set of sources can build more than one site: for example the full notes for yourself, and a
public copy without private material (source images you may not share, personal pages). The main
build is called `default`. Each entry of `variants` is another build:

```jsonc
"variants": {
  "public": {
    "outDir": "dist-public",              // default dist-<name>
    "config": {                           // merged over site.json for this build
      "packages": { "image-viewer": false },   // false leaves a package out
      "home": { "after": "<p>Public edition.</p>" }
    },
    "exclude": ["assets/private/**"]      // output paths (globs) left out of this build
  }
}
```

Mark what belongs to only some builds:

- **Pages:** `"except": ["public"]` (or `"only": ["default"]`) on the page in `pages` leaves it out of
  the other builds entirely: no file, no home row, no picker entry, no Prev/Next link.
- **Parts of a page:** any element with `data-except="public"` or `data-only="default"` (names
  separated by spaces) is removed from the builds it doesn't belong to. This works in content files,
  summary sheets and `home.after`; build hooks see the full HTML, and the removal happens last.
- **Static files:** `exclude` globs.

`study.py build --variant public` builds one variant, `build --all` builds the main site and every
variant, and `check --variant public` / `check --all` checks them. In a check, an excluded file
counts as missing, so a link to it is reported.

## Several kinds

The first kind in `kinds` is the main sequence. Add more for other page types (guides, handouts,
checklists, reference pages). Prev/Next runs within a kind, and with `home.filters: "auto"` the home
page filters by kind ("All / Units / Guides") once more than one kind is listed. A typical resource
kind has no numbering, review buttons or Prev/Next, and its own title and footer:

```json
"kinds": {
  "unit":  { "noun": "Unit" },
  "guide": { "noun": "Guide", "plural": "Guides & resources", "file": "guide-{id}.html", "source": "guides/{id}.html",
             "eyebrow": "{noun}", "rail": "On this page", "review": false, "prevNext": false, "numbered": false,
             "titleFormat": "{title} — {site}", "pageFooter": "{site} · {plural}" }
}
```

Give un-numbered sections plain headings (no `<span class="n">`).
