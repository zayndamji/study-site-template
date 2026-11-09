# Building a site with AI agents

The template is designed so an agent can go from a pile of source material (slides, a textbook,
handouts) to a finished site with little supervision. This is the workflow that works.

## 0. Set up

```bash
git clone <this repo> study-site-template
python3 study-site-template/tools/study.py new my-notebook --title "…" --noun Chapter
python3 study-site-template/tools/study.py new /tmp/demo --demo     # reference: every component
```

Read: `AGENTS.md` (template), `my-notebook/AGENTS.md`, `docs/components.md`, `docs/configuration.md`,
and the README of each package you plan to enable.

## 1. Recon, then report

Before writing pages, survey the sources: how many units, their titles and natural groups, what each
covers, which parts are visual, which need interactive widgets, any errors in the source. Report this and
**ask the human to choose** the things only they can decide: depth, which packages, the page noun, what
to leave out, privacy constraints. Record decisions in `my-notebook/memory/`.

## 2. One page first

Write a single page to the agreed format and let the human iterate on it. Turn every piece of feedback
into a rule in `memory/` (e.g. "one widget per section, max", "keep proofs folded"). Only then batch.

## 3. Batch with parallel agents

Give each writing agent `templates/agent-brief.md` filled in, plus that unit's recon notes. Each agent:

- edits **only** its own `content/<kind>/<id>.html` (and its summary sheet, if used);
- never touches `site.json`, shared CSS/JS or other pages — the coordinating agent does that;
- runs `study.py check <site> --page <id>` and fixes everything it reports (checks build into a
  temporary folder, so writers can run them in parallel);
- does not use a shared browser; the coordinator does browser checks one page at a time.

The coordinator then adds the pages to `site.json`, rebuilds, checks, reviews each page in a browser
(desktop and 375 px), and verifies any "source error" an agent reported against the source itself.

## 4. Verify before calling anything done

- `study.py check` prints OK.
- Every page: no console errors; no horizontal page scroll at 375 px; steppers start at step 1;
  every widget preset works.
- Facts, numbers and quotes match the sources. Recompute worked examples independently.
- Quiz answers you clicked while testing are reset (they persist in localStorage).
