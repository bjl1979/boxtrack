# BoxTrack

Offline-first moving-box inventory. Number every box, record what is in it, and later find
"passport" or "drill" straight away. Everything is stored on the phone (IndexedDB); there is no
server, no login and no analytics. See [SPEC.md](SPEC.md) for the full spec.

**Status:** Phase 1 (foundation) – moves, box create/edit/delete, box list with summary,
filters and sorting, installable PWA that works offline.

## Install on Android (Add to Home screen)

The app must be opened over **HTTPS** (or `localhost`) for installation, offline mode and the camera to work.

1. Open the app's HTTPS address in **Chrome** on the phone.
2. Wait a moment until the message *"BoxTrack is ready to work offline"* appears.
3. Tap the **⋮** menu → **Add to Home screen** (or **Install app**) → **Install**.
4. Open BoxTrack from the new home-screen icon. It runs full-screen and works in airplane mode.

Installing also helps Android keep the data: BoxTrack asks the browser for *persistent storage*
on first run, and Settings → Storage shows whether it was granted.

## Backing up your data

All boxes live **only on this phone**. If the app is uninstalled, Chrome's site data is cleared, or
the phone is lost, the data is gone.

- Phase 7 adds **Settings → Backup** to export a full `.zip` (data + photos) and restore it.
  Until then, do not clear Chrome's site data for the BoxTrack address.
- Once backup is available: export after each packing session, and copy the `.zip` off the phone
  (Google Drive, email to yourself, or a PC).

## Development

```bash
npm install
```

```bash
npm run dev       # dev server, reachable on the LAN (--host)
npm run build     # type-check + production build (with service worker)
npm run preview   # serve the production build on the LAN
npm test          # Vitest unit tests (data layer, filters, form)
npm run e2e       # build, then Playwright end-to-end tests at 390×844
```

Testing on a phone over the LAN: `http://<pc-ip>:5173` is not a secure origin, so the service
worker, install and camera are disabled there. For a full test, deploy to an HTTPS static host, or
in Chrome on the phone enable `chrome://flags/#unsafely-treat-insecure-origin-as-secure` for that address.

Hosting under a sub-path (e.g. GitHub Pages project site):

```bash
BASE_PATH=/boxtrack/ npm run build
```

Routing uses URL hashes (`#/boxes/…`), so no server rewrite rules are needed.

### Project layout

- `src/db` – Dexie schema, data access functions and live-query hooks (the only code that touches IndexedDB)
- `src/features/<feature>` – screens and logic per feature (boxes, moves, settings, …)
- `src/components` – shared UI (app shell, chips, sheets, dialogs, status ring)
- `src/lib` – utilities (ids, storage)
- `e2e` – Playwright tests; `scripts/gen-icons.mjs` regenerates the PWA icons from `public/favicon.svg`
