# The Last Login

**An abandoned Windows 98-style computer, last used at 11:58 PM on 31 December 1999.**
Boot it, poke through its files, and find out what its 14-year-old owner was hiding from the
Millennium Bug.

Built for the Gandhi Hackathon 2026 (OpenLake × Meraz, IIT Bhilai). Fan-made and
Windows 98-*inspired*; not affiliated with or endorsed by Microsoft.

- **Live demo:** _not deployed yet — see [Deploy](#deploy)_
- **Status / test evidence:** [`docs/IMPLEMENTATION-STATUS.md`](docs/IMPLEMENTATION-STATUS.md)
- **Original blueprint:** [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md)

## What you can do

| | |
|---|---|
| **Desktop** | Boot screen, teal desktop, Start menu with submenus, taskbar, Run…, Shut Down…, a clock that stopped at 11:58 PM |
| **Windows** | Drag, resize, minimize, maximize, cascade; keyboard Move/Size from each window's menu |
| **My Computer / Explorer** | Real virtual `C:\` drive: create, rename, cut/paste, delete, properties, address bar |
| **Notepad** | Edit, Save, Save As, conflict detection between windows, unsaved-changes guard |
| **Recycle Bin** | Restore (with collision handling), delete permanently, empty — and an old homework excuse |
| **MS-DOS Prompt** | `dir`, `cd`, `type`, `ver` (try it six times), `help me`, `unlock` … nothing real is executed |
| **The Internet** | 56K dial-up, a mailbox with an unsent e-mail, WebSeek99, a guestbook, a GeoPages-style homepage |
| **Calculator, Imaging, Control Panel, Help** | Working utilities; Help has progressive hints |

Everything is saved in your browser (IndexedDB), so files and progress survive a reload.

## The mystery (spoilers)

<details>
<summary>Walkthrough</summary>

1. Open **Read Me First** on the desktop.
2. Open `My Documents\y2k_checklist.txt` — item 7 describes the vault password.
3. Read `My Documents\letters\unsent_1999.txt` (or the Outbox at `retro://mail`).
4. Start → Programs → **SYSADMIN-99 Vault**, password `MIDNIGHT` (or `unlock midnight` in DOS).
5. Open `C:\TOP_SECRET\survival_plan.txt`. Enjoy the crash.

Clues can be found in any order. Control Panel → **Replay mystery** resets the story without
touching your files.
</details>

## Run it locally

Requires Node 20.19+ or 22.12+.

```bash
npm ci
```

```bash
npm run dev
```

## Quality checks

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm run test
```

```bash
npm run build
```

```bash
npm run test:e2e
```

`test:e2e` builds the app, serves it with the production security headers and runs Playwright
(Chromium by default; set `E2E_ALL_BROWSERS=1` to add Firefox). It needs Playwright browsers
installed (`npx playwright install chromium`).

## Deploy

The output is a static site in `dist/`; there is no server or database.

- **GitHub Pages:** in the repository go to Settings → Pages → Source: **GitHub Actions**. Every
  push to `main` then runs `.github/workflows/deploy-pages.yml`. Pages cannot send HTTP headers,
  so the CSP is also embedded as a `<meta>` tag (without `frame-ancestors`).
- **Vercel:** import the repository; `vercel.json` sets the build and the security headers.
- **Netlify / Cloudflare Pages:** build `npm run build`, publish `dist`; `public/_headers` applies
  the headers.

After deploying, open the URL in a private window and run through the walkthrough once.

## How it is built

React 19 + TypeScript (strict) + Vite, styled with [98.css](https://github.com/jdan/98.css).

```text
src/
  domain/      pure logic: virtual filesystem, path/name validation, story engine, settings
  persistence/ IndexedDB adapter (idb), in-memory fallback, seed-once bootstrap
  shell/       boot, desktop, taskbar, Start menu, window frame, window-manager reducer
  apps/        explorer, notepad, calculator, browser, terminal, recycle, vault, ...
  os/          OS context: opening apps/files, close guards, dialogs, story effects
  content/     seeded files and story text
  ui/          modal, menu bar, file dialog, icons, synthesized sounds
e2e/           Playwright tests
```

Key decisions:

- **Files are addressed by ID**, never by path; paths are parsed and validated only at the edges.
- **Saves are atomic.** Content and metadata are written in one IndexedDB transaction with a
  revision check *inside* the transaction, so a stale window (or tab) gets a conflict instead of
  silently overwriting. The UI says "saved" only after the commit.
- **Story progress is a pure, idempotent reducer** over semantic events (`file.opened:read-me`,
  `clue.letter-read`, …). The vault, the DOS `unlock` command and the browser mailbox all emit the
  same events, so no path depends on one specific app.
- **Nothing executes user input.** No `eval`, no HTML injection, no iframes; the browser resolves
  a fixed list of `retro://` pages and the DOS prompt dispatches from a fixed command table.
- **Apps are lazy-loaded** and each window has its own error boundary.

## Accessibility

Every interaction has a keyboard path: Tab/arrow keys/Enter on the desktop, `Ctrl+Esc` for
Start, menus with arrow keys, `Ctrl+F4` to close, and a window menu with keyboard Move/Size.
No clue needs sound, timing or dragging. Control Panel offers text size (100–150%), reduced
motion and an extra-visible focus ring. Automated axe scans report no serious or critical
issues; a manual screen-reader check has not been done yet.

## Privacy

Files, progress and settings stay in your browser. Nothing is uploaded, there are no analytics
and no account. Clearing site data or private browsing can erase progress; if the browser blocks
storage the app says so and runs in session-only mode.

## Credits

- [98.css](https://github.com/jdan/98.css) by Jordan Scales — MIT licence (vendored without its
  bundled font).
- Icons, pictures, sounds and story are original to this project; see
  [`docs/ASSET-LICENSES.csv`](docs/ASSET-LICENSES.csv).
- All characters are fictional.

## Licence

No licence has been chosen for this project's own code yet.
