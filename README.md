# BoxTrack

Offline-first moving-box inventory. Number every box, record what is in it, and later find
"passport" or "drill" straight away. Everything is stored on the phone (IndexedDB); there is no
server, no login and no analytics. See [SPEC.md](SPEC.md) for the full spec.

**Status:** all 8 phases of SPEC.md are done.
- **Packing plans** (one per move) on the home screen, each with Packed / Shipped / Delivered progress.
- Boxes: create/edit/delete, "Save & next box", list with summary, filters and sorting. *Select*
  on the box list changes the status of, or deletes, several boxes at once.
- Plans: Settings → Plans to rename, switch, archive, or delete a plan with all its boxes.
- Items: quick add (type `3x plates` for a quantity), quantity stepper, reorder, move to another box.
- Photos: camera or gallery, compressed on the phone (1600 px JPEG + 300 px thumbnail), tagged
  *contents* or *outside*, full-screen viewer with swipe and pinch-zoom.
- **Search** from the home screen, the box list or the Search tab: item names and notes, box labels
  and notes, rooms, categories and photo text. Typos are fine ("passprt" finds "Passport"), and
  typing a number jumps to that box. Tapping a result opens the box on the matching item or photo.
- **Photo text (OCR):** contents photos are read in the background on the phone (Tesseract.js in
  a Web Worker, one photo at a time). The text is searchable, can be corrected by hand, and can be
  turned into items. Switch it on/off or re-read everything in Settings → Photo text.
- **QR labels:** Boxes → *Print labels* lays out A4 sheets (8 or 4 per page) with the box number,
  QR code, "to" room and fragile / open-first marks. Print, or "Save as PDF" (A4, margins None,
  scale 100 %). You can also print numbered stickers before packing.
- **Scan:** the QR button (home screen or box list) opens the camera; scanning a label opens that
  box. A sticker with no box yet starts a new box with that number. The camera needs HTTPS.
- **Moving day:** on the box list tap *Select* to change the status of many boxes at once (e.g. all
  to *Shipped* when the truck is loaded). *Moving day → Delivery check* shows what has arrived and
  what is still missing; scan each label (or tap *Arrived*) as boxes come off the truck, with Undo.
  *Unpacking* lists delivered boxes with "open first" boxes on top; tap *Emptied* when done.
- **Light / dark / system theme** (Settings → General). Text on orange buttons is dark in the
  dark theme because white on that orange is hard to read outdoors.
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
the phone is lost, the data is gone – so keep backups.

1. **Settings → Backup → Download backup (.zip)** (or *Share backup* to send it straight to Google
   Drive, WhatsApp or email). The file contains every plan, box, item and photo.
2. Copy the `.zip` off the phone (Drive, email to yourself, or a PC). Do this after each packing session.
3. To restore: **Settings → Backup → Choose backup file**, then
   - **Merge into my data** – keeps what is on the phone and adds what is missing, or
   - **Replace all my data** – deletes what is on the phone first.

A reminder appears on the home screen when you have more than 10 boxes and no backup from the last
7 days. BoxTrack also asks Chrome to keep its storage (Settings → Backup shows whether this was granted).

**Exports** (Settings → Backup, for the active plan): an **Inventory PDF** for the movers or an
insurance claim, and **Excel / CSV** with one row per item.

## Publishing the app (GitHub Pages)

The camera and installing to the home screen need HTTPS, so the app has to be hosted. GitHub Pages
is free for public repositories and the workflow is already in `.github/workflows/deploy.yml`.

1. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions** (one time).
2. Merge the work into `main` (or run the *Deploy to GitHub Pages* workflow by hand from the
   Actions tab). The workflow runs the unit tests, builds for `/<repo>/` and publishes.
3. On the phone, open `https://<your-user>.github.io/boxtrack/` in Chrome, wait for
   "ready to work offline", then **⋮ → Add to Home screen**.

## Updates (no reinstalling)

Each push to `main` publishes a new version. The installed app picks it up by itself:

- It checks when you open it, whenever you switch back to it, and every hour while it is open.
- The new version downloads in the background; then a message appears: *"A new version of
  BoxTrack is ready – Update"*. Tap **Update** and the app reloads into the new version.
- **Settings → General → About & updates** shows the version and build, and has a
  **Check for updates** button.
- Updates only replace the app itself – your plans, boxes, items and photos stay on the phone.

Other static hosts work too: run `npm run build` and upload the `dist` folder (e.g. drag it onto
Netlify Drop). For a sub-path build use `BASE_PATH=/sub/path/ npm run build`.

## Performance

`npm run perf` loads 300 boxes, 1,500 items and 1,500 photos (≈100 MB) and measures the app with
the CPU slowed 4× (roughly a mid-range Android phone). Last result: box list 0.24 s, no janky
frames while scrolling all 300 boxes, search 0.05–0.46 s, 27 MB JavaScript memory.

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
npm run perf      # performance check with 300 boxes / 1,500 photos
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
