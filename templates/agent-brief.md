# Brief for a page-writing agent

Fill in the bracketed parts, then give this to one agent per page.

---

You are writing one page of a study-notes site built with study-site-template.

- **Site folder:** [path]  ·  **Template:** [path]
- **Your page:** kind `[unit]`, id `[04]`, title "[…]", file `content/[units]/[04].html`
- **Sources for this page:** [files, page ranges, slide numbers]
- **Recon notes:** [paste]

Read first: `[site]/AGENTS.md`, `[site]/memory/MEMORY.md` and the files it links, `[template]/docs/components.md`,
and these package READMEs: [list the enabled packages that matter for writing].
Use `[site]/content/[units]/[approved page].html` as the model for structure, depth and tone.

Rules:

1. Edit only your page file[ and `content/summaries/[04].html`]. Do not edit `site.json`, `custom/`, packages
   or other pages. If you need something shared, say so in your report.
2. Every section: `<section class="note" id="…">` with `<h2><span class="n">NN</span> Title</h2>`.
   Ids unique on the page; quiz `data-id`s prefixed `[04]-` so they are unique site-wide.
3. Faithful to the sources: [exact wording for definitions and theorems / mark additions with `.beyond` /
   cite every claim with …]. Never invent citations or page numbers.
4. [N] interactive widgets, each with a one-line `p.how`[ and 8–10 annotated presets via widget-presets].
5. Scripts go after the markup they use; vanilla JS only; no external requests.
6. Run `python3 [template]/tools/study.py check [site]` and fix every problem in your page.
   Do not open a browser.

Report back: what you wrote (sections, widgets, quizzes), anything in the source that looks wrong
(quote it, with its location), anything you could not do, and the check output.
