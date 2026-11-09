# Instructions for AI agents

You are probably here to do one of three things. Find yours, then read only what it links.

## A. Make a new study site from this template

1. `python3 tools/study.py new <dir> --title "<title>" --noun <Lecture|Chapter|Week|Unit>`
2. Read `<dir>/AGENTS.md` (the site's own instructions — they travel with the site), then
   [docs/configuration.md](docs/configuration.md) and [docs/components.md](docs/components.md).
3. Look at working markup: `demo/` is a complete real-content site using every package; `python3 tools/study.py new /tmp/x --demo` makes one placeholder page per package.
4. Pick packages: `python3 tools/study.py packages`, then `info <name>` and the package README.
5. Follow [docs/agent-workflow.md](docs/agent-workflow.md): recon → report and ask → one page →
   iterate with the human → batch.
6. Finish only when `python3 tools/study.py check <dir>` prints `OK` and you have looked at the pages in a
   browser at desktop width and at 375 px.

## B. Move an existing notes site onto the template

Read [docs/migration.md](docs/migration.md). Keep the old URLs, storage prefix, page storage ids and
section ids so readers keep their progress. Everything the old site does should map onto the
template's core, packages and options; when something has no equivalent, add it to the template in a
general form first (generic examples, original demo). Site packages are for new features, which
are later generalized and moved into the template.

## C. Change the template itself

- Layout: `core/` (core.css, core.js) — only features **every** site needs belong here.
- Features: `packages/<name>/`, following [docs/packages.md](docs/packages.md) exactly
  (package.json with defaulted, described options · README · example.html).
- Tools: `tools/study.py` (CLI) and `tools/studylib/` (common, build, check, scaffold). Standard library only.
- After any change: `python3 tools/study.py check demo` and
  `python3 tools/study.py new /tmp/t --demo && python3 tools/study.py check /tmp/t` must print OK, and
  `demo/` should look right in a browser in both themes. CI (`.github/workflows/pages.yml`) runs the same
  checks on every push and pull request, and publishes `demo/` to GitHub Pages from `main`.
- Keep the core API in the header of `core/core.js` backwards compatible; sites depend on it.

## Rules for everything in this repo

- **No identifying or course-specific content.** This repository is public. No course names or codes,
  school names, people, real lecture/chapter titles or copied course material — in code, comments,
  examples, docs or commit messages. Examples use generic placeholders, and `demo/` content is original,
  non-copyrighted writing on a topic unrelated to any particular course.
- No external runtime dependencies or CDN scripts. Vanilla JS in the browser, Python stdlib in tools.
- Every reader-facing string in a package comes from an option.
- Commit messages: 5–10 lowercase words describing the main change, no body.
