// @vitest-environment node
import 'fake-indexeddb/auto';
import JSZip from 'jszip';
import {
  NO_FLAGS,
  addItem,
  addPhotos,
  createBox,
  createMove,
  db,
  deleteAllData,
  exportAllData,
  getActiveMove,
  restoreAllData,
  setPhotoOcrText,
  setRooms,
  setSetting,
} from '../../db';
import { BackupError, buildBackupZip, readBackupZip } from './backupZip';
import { inventoryRows, toCsv, toXlsx } from './rows';
import { buildInventoryPdf, pdfSafe } from './inventoryPdf';

const jpeg = (tag: string) => new Blob([`JPEG-${tag}`], { type: 'image/jpeg' });

async function sample() {
  const move = await createMove({ name: 'Doha → Kochi', toAddress: 'Kakkanad' });
  const b1 = await createBox({
    moveId: move.id,
    number: 1,
    label: 'Kitchen – plates',
    toRoom: 'Kitchen',
    flags: { ...NO_FLAGS, fragile: true },
    status: 'packed',
  });
  const b2 = await createBox({ moveId: move.id, number: 2, label: 'Empty box', flags: { ...NO_FLAGS }, status: 'packing' });
  await addItem(b1.id, { name: 'Dinner plates', quantity: 12 });
  await addItem(b1.id, { name: 'Mugs, "the good ones"', note: 'wrapped' });
  const [p] = await addPhotos(b1.id, [{ kind: 'contents', blob: jpeg('full'), thumbBlob: jpeg('thumb'), width: 1600, height: 1200 }]);
  await setPhotoOcrText(p.id, 'Garam Masala', 'done');
  await setRooms(['Kitchen', 'Loft']);
  return { move, b1, b2 };
}

describe('full backup', () => {
  it('round-trips everything: export, delete all, restore (replace)', async () => {
    await sample();
    const before = await exportAllData();
    const zip = await buildBackupZip(before);

    await deleteAllData();
    expect(await db.boxes.count()).toBe(0);
    expect(await getActiveMove()).toBeUndefined();

    const parsed = await readBackupZip(zip);
    const r = await restoreAllData(parsed.data, 'replace');
    expect(r).toMatchObject({ moves: 1, boxes: 2, items: 2, photos: 1, skippedBoxes: 0 });

    const after = await exportAllData();
    expect(after.moves).toEqual(before.moves);
    expect(after.boxes).toEqual(before.boxes);
    expect(after.items).toEqual(before.items);
    expect(after.photos.map(({ blob, thumbBlob, ...m }) => m)).toEqual(before.photos.map(({ blob, thumbBlob, ...m }) => m));
    expect(await after.photos[0].blob.text()).toBe('JPEG-full');
    expect(await after.photos[0].thumbBlob.text()).toBe('JPEG-thumb');
    expect(after.photos[0].blob.type).toBe('image/jpeg');
    expect(after.settings.find((s) => s.key === 'rooms')?.value).toEqual(['Kitchen', 'Loft']);
    expect((await getActiveMove())?.name).toBe('Doha → Kochi');
  });

  it('merge keeps phone data, adds new records and skips boxes whose number is taken', async () => {
    const { move, b2 } = await sample();
    const backup = await readBackupZip(await buildBackupZip(await exportAllData()));
    // On the phone since the backup: a new item, and box 2 was deleted and its number reused.
    await db.boxes.delete(b2.id);
    const other = await createBox({ moveId: move.id, number: 2, label: 'Replacement', flags: { ...NO_FLAGS }, status: 'packing' });
    await addItem(other.id, { name: 'New thing' });
    await setRooms(['Garage']);

    const r = await restoreAllData(backup.data, 'merge');
    expect(r.skippedBoxes).toBe(1);
    expect(r.boxes).toBe(0);
    const boxes = await db.boxes.where('moveId').equals(move.id).toArray();
    expect(boxes.map((b) => b.label).sort()).toEqual(['Kitchen – plates', 'Replacement']);
    expect(await db.items.count()).toBe(3);
    expect((await db.settings.get('rooms'))?.value).toEqual(['Garage']); // phone wins
  });

  it('merge into an empty phone restores everything and an active plan', async () => {
    await sample();
    const backup = await readBackupZip(await buildBackupZip(await exportAllData()));
    await deleteAllData();
    const r = await restoreAllData(backup.data, 'merge');
    expect(r).toMatchObject({ moves: 1, boxes: 2, items: 2, photos: 1 });
    expect(await getActiveMove()).toBeDefined();
  });

  it('keeps device settings out of backups and rejects bad files', async () => {
    await sample();
    await setSetting('persistRequested', true);
    const zip = await buildBackupZip(await exportAllData());
    await deleteAllData();
    expect((await db.settings.get('persistRequested'))?.value).toBe(true);

    await expect(readBackupZip(new Blob(['hello']))).rejects.toBeInstanceOf(BackupError);
    const noData = await new JSZip().file('x.txt', 'x').generateAsync({ type: 'blob' });
    await expect(readBackupZip(noData)).rejects.toThrow(/data.json is missing/);
    const z = await JSZip.loadAsync(zip);
    const json = JSON.parse(await z.file('data.json')!.async('string'));
    json.version = 99;
    z.file('data.json', JSON.stringify(json));
    await expect(readBackupZip(await z.generateAsync({ type: 'blob' }))).rejects.toThrow(/newer version/);
    json.version = 1;
    json.items[0].boxId = 'nope';
    z.file('data.json', JSON.stringify(json));
    await expect(readBackupZip(await z.generateAsync({ type: 'blob' }))).rejects.toThrow(/damaged \(item\)/);
  });
});

describe('spreadsheet export', () => {
  it('has one row per item, plus a row for an empty box', async () => {
    const { move } = await sample();
    const all = await exportAllData();
    const rows = inventoryRows(move, all.boxes, all.items);
    expect(rows.map((r) => [r[1], r[11], r[12]])).toEqual([
      [1, 'Dinner plates', 12],
      [1, 'Mugs, "the good ones"', 1],
      [2, '', ''],
    ]);
    expect(rows[0][7]).toBe('Fragile');
  });

  it('writes valid CSV (quotes, BOM) and guards against formula injection', () => {
    const csv = toCsv([['Plan', 1, 'a,b', '', '', '', 'Packed', '', '', '', '=HYPERLINK("x")', 'Mugs, "good"', 2, 'line1\nline2']]);
    expect(csv.startsWith('﻿Plan,Box,')).toBe(true);
    expect(csv).toContain(`"a,b"`);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain(`"Mugs, ""good"""`);
    expect(csv).toContain(`"line1\nline2"`);
  });

  it('writes an Excel file that reads back', async () => {
    const { move } = await sample();
    const all = await exportAllData();
    const blob = await toXlsx(inventoryRows(move, all.boxes, all.items), move.name);
    const XLSX = await import('xlsx');
    const wb = XLSX.read(new Uint8Array(await blob.arrayBuffer()), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
    expect(rows[0]).toMatchObject({ Box: 1, Item: 'Dinner plates', Quantity: 12, 'To room': 'Kitchen' });
    expect(rows).toHaveLength(3);
  });
});

describe('inventory PDF', () => {
  it('makes a PDF listing boxes and items', async () => {
    const { move } = await sample();
    const all = await exportAllData();
    const pdf = await buildInventoryPdf(move, all.boxes, all.items);
    const text = Buffer.from(await pdf.arrayBuffer()).toString('latin1');
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text).toContain('Dinner plates');
    expect(text).toContain('Inventory');
    expect(text).toContain('Fragile');
  });

  it('replaces characters the PDF fonts cannot show', () => {
    expect(pdfSafe('Doha → Kochi 📦 “x” 3×')).toBe('Doha -> Kochi  "x" 3x');
  });
});
