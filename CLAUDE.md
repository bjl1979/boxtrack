# CLAUDE.md — BoxTrack

You are building **BoxTrack**, an offline-first PWA moving-box inventory app. **`SPEC.md` is the source of truth.** Read it in full before writing any code.

## How to work
- Build in the phases listed in SPEC.md §8, one phase at a time. At the end of each phase, run the app and the tests, give a short summary, and wait for the owner to confirm before starting the next phase.
- Mobile-first: test every screen at a 390×844 viewport. The owner uses an Android phone with Chrome.
- Keep dependencies to the stack in SPEC.md §7. Ask before adding anything else.
- No backend, no network calls, no analytics. All data stays in IndexedDB via Dexie.

## Conventions
- TypeScript strict mode. Functional React components and hooks.
- Folders: `src/db` (Dexie schema + data access), `src/features/<feature>` (boxes, items, photos, ocr, search, qr, export, settings), `src/components` (shared UI), `src/lib` (utilities).
- All database access goes through `src/db` functions. Components never call Dexie directly.
- Dexie schema changes always use a new `version()` with a migration, so existing user data survives.
- Photos are stored as Blobs, never as base64 strings. Always store a thumbnail as well.
- OCR runs only inside a Web Worker, through a queue (one job at a time). The UI must stay responsive.
- The search index is updated on every create, update and delete of a box, item or photo's OCR text.

## Commands (set these up in phase 1)
- `npm run dev`: dev server (make it reachable on the LAN with `--host` so the owner can test on a phone)
- `npm run build` / `npm run preview`
- `npm test`: Vitest
- `npm run e2e`: Playwright

## Definition of done for each phase
- Feature works offline (check with the service worker active and the network turned off in devtools).
- Unit tests for the data layer and search pass. An E2E test covers the phase's main user flow.
- No TypeScript errors and no console errors.
- The README is updated with how to install the app on Android ("Add to Home screen") and how to back up the data.
