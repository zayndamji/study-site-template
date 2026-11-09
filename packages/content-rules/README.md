# content-rules — a site's own writing rules

## What it does
Lets a site state its house rules in `site.json` and have `study.py check` report every page that
breaks one. Nothing changes in the built pages. With the default options nothing is checked.

Typical uses:

- **no images** in the notes (diagrams are redrawn as SVG);
- **phrases that must not appear in the prose**, e.g. narrating the source ("the slide shows…")
  instead of showing the content, or a citation written in running text instead of in a citation
  element;
- a **minimum number of sections** per page;
- **every quiz question has an explanation**.

The rules look only at a page's body (its `<article>`), not at the top bar, rail or footer.

## Enable
```json
"packages": {
  "content-rules": {
    "forbidTags": { "img": "draw diagrams as SVG or HTML instead of using images" },
    "minSections": 5,
    "quizExplanations": true,
    "proseExclude": ["span.ref", "cite", "p.src", ".lbl"],
    "prose": [
      { "pattern": "\\b(?:the source|the handout) (?:shows|draws|lists)\\b",
        "message": "describes the source instead of showing its content",
        "outsideQuotes": true },
      { "pattern": "(?<![\\w/.-])s\\d{1,3}(?![\\w(])",
        "message": "citation in running text (put it in a citation element)" }
    ]
  }
}
```

## Options
| Option | Default | Meaning |
|---|---|---|
| `kinds` | `null` | Kinds of page checked; `null` = all |
| `forbidTags` | `{}` | `{"tag": "message"}` — tags not allowed in a page body |
| `minSections` | `0` | Fewest `section.note` elements a page may have; `0` = off |
| `quizExplanations` | `false` | Each quiz question (`.q[data-answer]`) needs a `<template class="q-explain">` |
| `prose` | `[]` | Text rules (below) |
| `proseExclude` | `[]` | Simple selectors (`tag`, `.class`, `tag.class`) whose text the prose rules skip |
| `quotes` | `["blockquote.quote", "q.quote"]` | Verbatim quotes; skipped by rules with `outsideQuotes` |

### Prose rules
Each rule is `{ "pattern": …, "message": … }` plus optional keys:

- `outsideQuotes: true` — ignore text inside the `quotes` elements (a quote may say what a
  paraphrase must not);
- `caseSensitive: true` — patterns are case-insensitive by default;
- `kinds` / `pages` — limit the rule to some kinds or page ids.

Patterns are Python regular expressions, matched against the page's text with whitespace collapsed
and with scripts, styles, SVG, templates and the `proseExclude` elements removed. Each match is
reported with a little surrounding text.

## Markup
None.

## JavaScript API
None.

## Notes for migrating existing notes
A hand-written per-page checker usually mixes generic checks (tag balance, duplicate ids, quiz
answers, links), which `study.py check` already does, with house rules. Move the house rules here:
"no `<img>`" → `forbidTags`, "at least N sections" → `minSections`, phrase and citation-format rules
→ `prose`, with the citation elements listed in `proseExclude`.
