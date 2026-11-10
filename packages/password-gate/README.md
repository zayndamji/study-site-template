# password-gate

## What it does

After `study.py build`, writes a second folder next to the build output (`dist-gate/`, or
`dist-public-gate/` for a `public` variant): a small Next.js app that serves the built site from
`public/` only to readers who know the password. Upload that folder to any Next.js host (on Vercel,
drag it onto a project in the dashboard; no git, settings or environment variables needed).

- Every request goes through `proxy.ts`, including the site's own files. Without a valid session it
  redirects to `/login?next=…`, and back to the page after a correct password.
- A correct password sets a signed, HttpOnly cookie (`sessionDays`, default 30). A wrong one waits
  about a second before answering.
- Every response carries `X-Robots-Tag: noindex, nofollow, noarchive`, `Referrer-Policy: no-referrer`,
  `X-Frame-Options: SAMEORIGIN` and `nosniff`.
- The plain password never goes into the folder: `lib/gate.json` holds a salted PBKDF2-SHA256 hash
  and a signing secret. Salt and secret are kept in `stateFile`, so a rebuild with the same password
  keeps readers signed in; a new password signs everyone out.
- The build stops if the password is shorter than 8 characters or appears in any built file, and
  `study.py check` reports the same. Pair it with `privacy` to keep identifying words out too.

Building needs only Python. node is needed only to try the app locally; the host installs it.

## Enable

```json
"packages": { "password-gate": {} }
```

Then put the password in `.gate-password` at the site root (first non-empty line) and rebuild. Keep
`.gate-password`, `.gate-state.json` and the `*-gate/` folders out of version control (`study.py new`
adds them to `.gitignore`). Until the password file exists the build warns and writes no gate.

To gate only one variant, enable it in that variant's `config`:

```json
"variants": { "public": { "config": { "packages": { "password-gate": { "outDir": "upload/my-notes" } } } } }
```

When it is enabled for the main build, every variant gets its own gate too (with its own salt and
secret); turn it off in a variant with `"password-gate": false`. Give each gated build its own
`passwordFile` if they should have different passwords.

## Options

| Option | Default | |
|---|---|---|
| `passwordFile` | `".gate-password"` | File (relative to the site) holding the password. Private. |
| `stateFile` | `".gate-state.json"` | Salts and secrets, per variant. Private. Deleting it signs everyone out. |
| `outDir` | `""` | Where to write the app; empty = build output + `-gate`. Drag-and-drop hosts name the project after the folder, so pick a neutral name. |
| `refuse` | `[]` | Globs of built paths (`assets/private/**`) that must not be in the gated copy; the build stops if one is. |
| `title` | `""` | Login heading and tab title; empty = the site title. |
| `intro`, `passwordLabel`, `wrongPassword`, `submitLabel` | English | The login page's text. |
| `lang` | `"en"` | The login page's `lang`. |
| `sessionDays` | `30` | How long a sign-in lasts. |
| `cookie` | `"study_session"` | Session cookie name. Changing it signs everyone out. |
| `iterations` | `210000` | PBKDF2 iterations (at least 100000). Changing it signs everyone out. |

## Markup

None: the package changes no page. It adds the `after_write` build hook's output folder only.

## Updating a hosted copy

1. Rebuild the site (`study.py build`, or `build --variant <name>`).
2. Upload the gate folder again (on Vercel, drop it onto the same project for a new production
   deployment).

## Trying it locally

Copy the folder somewhere else first, so `node_modules/` and `.next/` never end up in an upload
(every rebuild empties the gate folder anyway):

```bash
cp -R dist-gate /tmp/gate-test && cd /tmp/gate-test
npm ci && npx next build && npx next start --hostname 127.0.0.1 --port 4180
```

The app's tests run from the template:
`node --test packages/password-gate/tests/`.

## How the app is put together

`app/` in this package is copied as is; only `package.json`'s name (from the folder name) and
`lib/gate.json` are written per build. Things that matter if you change it:

- `next.config.ts` sets `skipTrailingSlashRedirect`, and `proxy.ts` maps `/` and every folder URL to
  its `index.html`.
- Build redirect URLs with `new URL(path, req.url)`: `req.nextUrl.clone()` re-adds a trailing slash
  it saw, which loops.
- The proxy cannot return a relative `Location` ("Invalid URL"); the login route handler can, which
  keeps the browser on whatever host it came from.
- The matcher skips only `_next/static` and `_next/image` (the login page's own assets).
