# one-minute — an "in one minute" opener

## What it does
Starts a page with a short bulleted section that gives the whole page at a glance
(default heading: "The unit in one minute", number `00`). Readers skim it first; the rail takes them to detail.
Pairs well with the core `.key` ("The idea") box for one-sentence takeaways inside sections.

## Enable
```json
"packages": { "one-minute": {} }
```

## Options
| Option | Default | Meaning |
|---|---|---|
| `title` | `"The {noun_lower} in one minute"` | Heading; a page can set `"overviewTitle"` in front matter |
| `number` | `"00"` | Rail/heading number |
| `id` | `"overview"` | Anchor |
| `reviewable` | `false` | Review button on the section |
| `kinds` | `null` | Limit to some kinds |
| `maxBullets` | `7` | Warn above this many |

## Markup
Either front matter (the build writes the section at the top of the page):
```html
<!--page {"overview": ["First point.", "Second point with <span class=\"m\">x²</span>."]} -->
```
or by hand:
```html
<section class="note one-minute" id="overview" data-no-review>
  <h2><span class="n">00</span> The unit in one minute</h2>
  <ul><li>…</li></ul>
</section>
```
