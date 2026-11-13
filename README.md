# BoxTrack

Offline-first moving-box inventory. Number every box, record what is in it, and later find
"passport" or "drill" straight away. Everything is stored on the phone (IndexedDB); there is no
server, no login and no analytics. See [SPEC.md](SPEC.md) for the full spec.

**Status:** Phase 4 (photo text / OCR) done.
- **Packing plans** (one per move) on the home screen, each with Packed / Shipped / Delivered progress.
- Boxes: create/edit/delete, "Save & next box", list with summary, filters and sorting.
- Items: quick add (type `3x plates` for a quantity), quantity stepper, reorder, move to another box.
- Photos: camera or gallery, compressed on the phone (1600 px JPEG + 300 px thumbnail), tagged
  *contents* or *outside*, full-screen viewer with swipe and pinch-zoom.
- **Search** from the home screen, the box list or the Search tab: item names and notes, box labels
  and notes, rooms, categories and photo text. Typos are fine ("passprt" finds "Passport"), and
  typing a number jumps to that box. Tapping a result opens the box on the matching item or photo.
- **Photo text (OCR):** contents photos are read in the background on the phone (Tesseract.js in
  a Web Worker, one photo at a time). The text is searchable, can be corrected by hand, and can be
  turned into items. Switch it on/off or re-read everything in Settings → Photo text.
- Installable PWA that works fully offline. The OCR engine and English language data (~9 MB)
  are bundled and cached on the first visit, so open the app once on Wi-Fi before going offline.

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
- `src/features/<feature>` – screens and logic per feature (boxes, items, photos, moves = packing plans, settings, …)
- `src/components` – shared UI (app shell, chips, sheets, dialogs, status ring)
- `src/lib` – utilities (ids, storage, image compression)
- `public/ocr` – OCR engine and language data, copied from `node_modules` by `scripts/copy-ocr-assets.mjs` before `dev`/`build` (not committed)
- `e2e` – Playwright tests; `scripts/gen-icons.mjs` regenerates the PWA icons from `public/favicon.svg`
