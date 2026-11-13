# BoxTrack — Moving Boxes Inventory App (Spec v1)

## 1. Purpose
When moving house, every box gets a numbered sticker. This app records what is in each box, using typed item lists and photos. Later, the owner can search for an item ("passport", "drill") and get the box number straight away, so only that one box needs opening.

## 2. Key decisions (fixed)
| Area | Decision |
|---|---|
| Platform | Progressive Web App (PWA), installable on Android from Chrome, mobile-first UI |
| Storage | On-device only (IndexedDB). No backend, no login, works fully offline |
| Photo text reading | Yes. On-device OCR (Tesseract.js) runs on content photos; the text it finds is searchable |
| Backup | Manual export/import of a full backup file (.zip) because data lives only on the phone |
| Hosting | Static hosting over HTTPS (needed for camera access), e.g. GitHub Pages / Netlify / Vercel |

## 3. Users and context
- Single user (the owner) on an Android phone, used one-handed while packing.
- Big tap targets, very few typing steps, quick "add next box" flow.
- Must work with no internet connection (warehouse, new flat with no Wi-Fi yet).

## 4. Core concepts and data model

### Move
A container for one relocation, so the app can be reused for future moves.
- `id`, `name` (e.g. "Doha → Kochi, Dec 2026"), `fromAddress?`, `toAddress?`, `createdAt`, `isActive`

### Box
- `id`, `moveId`
- `number`: integer, unique within a move, and it matches the physical sticker
- `label?`: short free text, e.g. "Kitchen – plates"
- `fromRoom?`, `toRoom?`: picked from an editable room list (Kitchen, Master Bedroom, Kids Room, Living, Study, Bathroom, Store, Balcony, Garage)
- `category?`: Kitchen, Books, Clothes, Documents, Electronics, Toys, Tools, Decor, Linen, Misc
- `flags`: `fragile`, `priority` (open first), `valuable`, `thisSideUp`
- `status`: `packing` → `packed` → `shipped` → `delivered` → `unpacked`
- `weightKg?`, `size?` (S/M/L/XL), `notes?`
- `createdAt`, `updatedAt`

### Item
- `id`, `boxId`, `name`, `quantity` (default 1), `note?`, `createdAt`

### Photo
- `id`, `boxId`, `kind` (`outside` | `contents`), `blob` (compressed JPEG), `thumbBlob`, `createdAt`
- `ocrText?`: text read from the photo
- `ocrStatus`: `pending` | `done` | `failed` | `skipped`

## 5. Features

### 5.1 Box list (home screen)
- A grid or list of boxes for the active move: number shown large, label, room, status chip, flag icons, item count, photo thumbnail.
- Filters by status, room, category and flags. Sorting by number or by last updated.
- A summary bar at the top: total boxes, packed, delivered, unpacked, and how many are missing (shipped but not delivered).
- A large floating "+ New Box" button that pre-fills the next free number.

### 5.2 Add / edit box
- The number is pre-filled with the next free one and can be edited. Duplicate numbers within a move are blocked.
- Fields can be filled quickly with chip pickers for rooms and categories.
- "Save & next box" button for rapid packing sessions.

### 5.3 Box contents
- **Typed items:** a fast add field (type, press Enter, the next item field is ready). Quantity stepper. Items can be reordered or deleted, and moved to another box.
- **Photos:** capture with the camera (`<input type="file" accept="image/*" capture="environment">`) or pick from the gallery. Several photos per box, tagged outside or contents.
- Photos are compressed on the device (longest side about 1600 px, JPEG quality about 0.75) and a thumbnail of about 300 px is made.
- Full-screen photo viewer with swipe and pinch-zoom.

### 5.4 Photo text reading (OCR)
- After a **contents** photo is saved, OCR is queued in a background Web Worker using Tesseract.js (English by default; the language pack is cached for offline use).
- OCR must never block the UI. A small "reading text…" indicator shows on the thumbnail.
- The text it reads is stored in `photo.ocrText`, can be viewed and edited by the user, and is included in search.
- A "Turn OCR text into items" action splits the text into lines, the user ticks which lines to keep, and those become Items.
- A setting turns OCR on or off and can re-run OCR on all photos.

### 5.5 Search (key feature)
- A global search bar is always reachable from the home screen.
- It searches item names, item notes, box labels, box notes, rooms, categories and photo OCR text.
- Fuzzy and typo-tolerant (MiniSearch or Fuse.js), with results shown as you type.
- Each result shows the **box number (large)**, the matched text highlighted, where the match came from (item / note / photo text), and the box's room and status.
- Tapping a result opens the box. Photo-text matches open the box with that photo highlighted.

### 5.6 QR labels
- Each box can have a QR code that contains its number and the move id (format `boxtrack://move/{moveId}/box/{number}`, or plain text that the in-app scanner understands).
- A **Print labels** screen lays out A4 sheets of labels: box number in large type, QR code, "to" room, and fragile/priority icons. It prints with the browser print dialog / save as PDF. A range can be chosen (e.g. boxes 1–40).
- A **Scan** button opens the camera scanner (BarcodeDetector API with a fallback to `@zxing/browser` or `html5-qrcode`). Scanning a label opens that box.

### 5.7 Status tracking (moving day)
- Status can be changed in bulk: select several boxes and set them to shipped or delivered.
- "Delivery check" mode: scan or tap each box as it arrives. The app lists any boxes still missing.
- Unpacking checklist: mark a box as unpacked when it has been emptied.

### 5.8 Export and backup
- **Inventory PDF:** box number, label, rooms, flags and the item list for every box, for the movers or an insurance claim (jsPDF + autotable).
- **Excel/CSV export:** one row per item, with its box details (SheetJS).
- **Full backup (.zip):** `data.json` plus all photo files (JSZip). **Restore** imports a backup file, with a choice of merging into or replacing the current data.
- A reminder banner appears if there is no backup from the last 7 days and there are more than 10 boxes.
- `navigator.storage.persist()` is requested on first run so Android does not clear the data. The settings screen shows how much storage is used.

### 5.9 Settings
- Manage moves (create, rename, switch the active move, archive).
- Edit the room and category lists.
- OCR on/off and OCR language.
- Theme (light/dark/system).
- Storage usage, backup and restore, and "Delete all data" (asks for confirmation twice).

## 6. Non-functional requirements
- **Offline-first:** the service worker caches the app and the OCR files. Every feature works with no network after the first load.
- **Performance:** the box list stays smooth with 300 boxes and 1,500 photos. Lists are virtualised and thumbnails are lazy-loaded.
- **Privacy:** no analytics and no network calls besides loading the app.
- **Reliability:** each save is one IndexedDB transaction. If OCR fails, the photo is still kept.
- **Accessibility:** tap targets at least 44 px, good contrast, readable outdoors.

## 7. Tech stack
- Vite + React + TypeScript
- `vite-plugin-pwa` (manifest + Workbox service worker)
- Dexie.js (IndexedDB) with `dexie-react-hooks`
- Tailwind CSS
- Tesseract.js (OCR in a Web Worker, with its files bundled or cached locally)
- MiniSearch (full-text search index, rebuilt from IndexedDB at startup and updated on every change)
- `qrcode` (QR generation), BarcodeDetector API with `@zxing/browser` as fallback (scanning)
- `browser-image-compression` or a canvas resize (photo compression)
- jsPDF + jspdf-autotable, SheetJS (xlsx), JSZip
- React Router
- Vitest + Testing Library (unit tests), Playwright (key end-to-end flows)

## 8. Build phases
1. **Foundation:** project scaffold, PWA setup, Dexie schema, Moves, Box CRUD, box list, app installs on Android.
2. **Contents:** typed items, photo capture and compression, thumbnails, photo viewer.
3. **Search:** MiniSearch index across all fields, search screen with highlighting.
4. **OCR:** Tesseract worker queue, OCR text in search, "Turn OCR text into items".
5. **QR:** label printing sheet and in-app scanner.
6. **Moving day:** bulk status changes, delivery check mode, missing-box list.
7. **Export/backup:** PDF, Excel/CSV, zip backup and restore, persistent storage, backup reminder.
8. **Polish:** dark mode, empty states, performance testing with 300 boxes, deploy to static hosting.

## 9. Acceptance tests (owner's view)
- Create box 17, type 5 items and add 2 photos in under 60 seconds.
- Search "passprt" (typo) and see "Box 17" as the top result.
- Photograph a box containing a labelled jar of "Garam Masala", then search "masala" and find that box from the photo text alone.
- Print labels for boxes 1–20 on A4 and scan label 12 to open box 12.
- With airplane mode on, everything above still works.
- Export a backup, clear the data, restore it, and every box, item and photo comes back.

## 10. Out of scope for v1
Cloud sync, multiple users, sharing with movers, iOS-specific tuning, cost/insurance valuation fields. These are possible in v2.
