# Implementation status, deviations and evidence

This file records what was actually built against `docs/BLUEPRINT.md`, how each requirement is
verified, where the build deliberately departs from the blueprint, and what is still open.
"Verified" means an automated test in this repository exercises it; nothing here is claimed
from the blueprint alone.

Test commands: `npm run test` (Vitest, 125 unit tests) and `npm run test:e2e` (Playwright, 25
end-to-end tests, Chromium; Firefox runs in CI only — see *Open items*).

## Functional requirements

| ID | Status | Evidence |
|---|---|---|
| FR-001 Start PC by explicit input | Done | `e2e/core.spec.ts` TC-001; keyboard in TC-015 |
| FR-002 Period desktop/taskbar | Done | Visual review; 98.css + tokens in `src/styles/os.css` |
| FR-003/004 Icons open on double-click and Enter/Space | Done | TC-001, TC-015 (keyboard) |
| FR-005/006 Start menu, closes on Esc/outside/activation | Done | `FR-006` e2e; arrow keys + submenus in TC-015 |
| FR-007 Coherent clock | Done | Frozen 11:58 PM, 31 Dec 1999; becomes 12:00 AM after the finale (story test) |
| FR-008 Restart keeps saved state | Done | `FR-008` e2e (unsaved-work guard, safe-to-turn-off, power on) |
| FR-010–016 Window lifecycle and taskbar | Done | `src/tests/windows.test.ts`, TC-003 |
| FR-017 Keyboard Move/Close | Done | System menu Move/Size (arrows, Shift = 1px, Enter, Esc), Ctrl+F4; e2e "keyboard Move mode" |
| FR-018 No unreachable window | Done | Clamp on move/resize/viewport change; "Arrange All Windows" rescue; TC-020 |
| FR-020–024 Seeded VFS, IndexedDB, path/name validation | Done | `src/tests/vfs.test.ts`, `validation.test.ts` (TC-007, TC-009) |
| FR-025 Create/rename/move/delete | Done | Explorer e2e (create, invalid rename, cut/paste) |
| FR-026 Recycle Bin | Done | unit + e2e (restore, collision → "Restore as copy", purge, empty) |
| FR-027 Story reset separate from file reset | Done | Control Panel: Replay mystery / Reset files / Reset everything; TC-012 |
| FR-028 Storage unavailable | Done | TC-017 (IndexedDB removed → session-only notice + tray warning) |
| FR-030 Explorer | Done | Back/Forward/Up, editable address bar, type-ahead, F2/Del/Backspace |
| FR-031/032 Notepad + dirty guard | Done | TC-004/005/006, Save As, replace-confirm |
| FR-033 Calculator | Done | `calculator.test.ts` (0.1+0.2, ÷0, repeated =, overflow), keyboard e2e |
| FR-034 Fake browser, local pages only | Done | `terminal.test.ts` resolver tests; e2e blocked/offline pages; zero external requests |
| FR-035 DOS prompt allowlist | Done | `terminal.test.ts` (TC-014 payloads), e2e |
| FR-036 Paint / game | Not built | P2; intentionally skipped (see below) |
| FR-040–044 Story | Done | `story.test.ts`; TC-010/011 mouse path, TC-015 keyboard-only path, terminal path, mail path |
| FR-045 Hints | Done | Help → Hints (3 levels, last level gives the answer) |
| FR-046 Replay keeps notes | Done | TC-012 |
| FR-050 Public HTTPS URL | **Not done — needs you** | Workflow `deploy-pages.yml` + `vercel.json` are ready; nobody has deployed yet |
| FR-051 Public repo with history | **Needs you** | Repo visibility is a GitHub setting |
| FR-052 README | Done | `README.md` |
| FR-053 Recoverable failures | Done | Per-window error boundaries (incl. failed lazy chunk) + shell boundary |

## Deliberate deviations from the blueprint

1. **Story is order-independent.** The blueprint's state machine is strictly linear, so opening
   the unsent letter before the checklist would be a silent no-op — a dead end for exactly the
   curious visitor the brief targets. Clues are recorded in any order; the unlock is gated by a
   password (`MIDNIGHT`, found in checklist item 7) and the finale by the unlock. The blueprint's
   own unit-test example (`processed: ['read-me']` with stage `Y2K_FOUND`) also contradicts its
   linear table.
2. **Replay goes to `UNSTARTED`, not `INTRO_FOUND`.** "Replay clears milestones" and
   "FINISHED → INTRO_FOUND" contradict each other; clearing is what the user asked for.
3. **Story files are read-only.** Clue files cannot be edited, renamed, moved or deleted (Save As
   still works). This removes the "user deleted the clue" dead end the blueprint mentions
   without needing a recovery tool.
4. **The fake IE is called "The Internet"** (the Windows 95 desktop name) to avoid a product
   trademark; "Windows" appears only in parody text.
5. **98.css font removed.** The bundled pixel font's provenance is undocumented upstream, so it is
   stripped and system fonts are used (blueprint ch. 18 forbids fonts of unknown licence).
6. **Title-bar buttons are 24×24 hit targets** (visual 16×14 glyph). This widens the gap between
   the three buttons compared with real Windows 98 — accessibility over pixel accuracy (ADR-008).
7. **Windows cascade from the top-left** instead of being centred, so each window's title bar and
   controls stay visible; axe flagged the centred layout (overlapping controls).
8. **`Ctrl+F4` closes windows, `Ctrl+Esc` opens Start.** Alt+F4 and the Windows key are captured by
   the host OS/browser.

## Edge cases handled (beyond the blueprint's lists)

- Two tabs: revision check runs *inside* the IndexedDB transaction, plus BroadcastChannel sync.
- Purging a folder keeps separately-deleted children in the Recycle Bin (unit-tested).
- Restoring into a deleted/purged parent falls back to `C:\`.
- Writing a file inside a deleted folder fails with NOT_FOUND → Notepad offers Save As.
- Explorer viewing a folder that gets deleted/hidden (e.g. after Replay) climbs to the nearest
  valid ancestor with a notice; the DOS prompt falls back to `C:\`.
- Opening a file that is already open focuses that Notepad instead of creating a conflict.
- Rename: Escape cancels without committing on blur; error dialogs cannot re-trigger the commit.
- Windows opened from a dialog are not pushed behind by focus restoration (found by e2e).
- Lazily loaded apps receive keyboard focus once their code arrives (found by e2e).
- Hovering "Programs" and then clicking it no longer closes the submenu (found by e2e).
- Corrupt/forged persisted story or settings are sanitized (e.g. a finale without unlock is dropped).
- Reserved device names (`CON`, `LPT1`…), control chars, `..`, UNC, other drives, URL schemes.
- Window count capped at 24 ("640K was not enough after all"), z-order compaction.
- `beforeunload` warning while any Notepad has unsaved edits.

## Measured (not targets)

| Date | Commit | Measure | Value |
|---|---|---|---|
| 2026-11-01 | this branch | Initial JS (main chunk) | 305 KB raw / 96 KB gzip |
| 2026-11-01 | this branch | CSS | 48 KB raw / 10 KB gzip |
| 2026-11-01 | this branch | Whole `dist/` | 480 KB |
| 2026-11-01 | this branch | axe (wcag2a/aa, 2.1, 2.2aa) on power screen, desktop, Explorer+Notepad | 0 serious/critical |
| 2026-11-01 | this branch | `npm audit --omit=dev` | 0 vulnerabilities |

LCP and input latency were **not** measured; do that on the deployed URL (blueprint ch. 13).

## Open items

- Deploy and record the live URL; make the repository public (FR-050/051).
- Firefox E2E runs only in CI (no Firefox binary in the build environment) — check the first CI run.
- Screen-reader spot check (NVDA/VoiceOver) has not been done; axe is not a conformance claim.
- Choose a licence for the project code (not decided here).
- P2 items not built: Paint, a mini-game, JSON export/import.
