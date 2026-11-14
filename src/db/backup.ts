import { db } from './schema';
import { notifyDataReset } from './changes';
import type { AppSettings, Box, Item, Move, Photo, SettingRow } from './types';

/** Everything in the database. */
export interface AllData {
  moves: Move[];
  boxes: Box[];
  items: Item[];
  photos: Photo[];
  settings: SettingRow[];
}

export async function exportAllData(): Promise<AllData> {
  return db.transaction('r', [db.moves, db.boxes, db.items, db.photos, db.settings], async () => ({
    moves: await db.moves.toArray(),
    boxes: await db.boxes.toArray(),
    items: await db.items.toArray(),
    photos: await db.photos.toArray(),
    settings: await db.settings.toArray(),
  }));
}

export type RestoreMode = 'merge' | 'replace';

export interface RestoreResult {
  moves: number;
  boxes: number;
  items: number;
  photos: number;
  /** Boxes not merged because their number is already used by a different box in that plan. */
  skippedBoxes: number;
}

/** Settings that describe this phone rather than the user's data; never taken from a backup. */
const DEVICE_SETTINGS = new Set<keyof AppSettings>(['persistRequested']);

/**
 * Restores a backup in one transaction (all or nothing).
 * - replace: the current data is deleted first.
 * - merge: records already on the phone (same id) are kept, except boxes, where the newer
 *   version wins. A backup box whose number is taken by another box in the same plan is skipped,
 *   together with its items and photos.
 */
export async function restoreAllData(data: AllData, mode: RestoreMode): Promise<RestoreResult> {
  const result = await db.transaction('rw', [db.moves, db.boxes, db.items, db.photos, db.settings], async () => {
    const settings = data.settings.filter((s) => !DEVICE_SETTINGS.has(s.key));
    if (mode === 'replace') {
      await Promise.all([db.moves.clear(), db.boxes.clear(), db.items.clear(), db.photos.clear()]);
      await db.settings.where('key').noneOf([...DEVICE_SETTINGS]).delete();
      await db.moves.bulkAdd(data.moves);
      await db.boxes.bulkAdd(data.boxes);
      await db.items.bulkAdd(data.items);
      await db.photos.bulkAdd(data.photos);
      await db.settings.bulkPut(settings);
      // Exactly one active plan.
      const active = data.moves.filter((m) => m.isActive && !m.archived);
      if (active.length !== 1) {
        await db.moves.toCollection().modify({ isActive: false });
        const first = data.moves.filter((m) => !m.archived).sort((a, b) => b.createdAt - a.createdAt)[0];
        if (first) await db.moves.update(first.id, { isActive: true });
      }
      return { moves: data.moves.length, boxes: data.boxes.length, items: data.items.length, photos: data.photos.length, skippedBoxes: 0 };
    }

    const r: RestoreResult = { moves: 0, boxes: 0, items: 0, photos: 0, skippedBoxes: 0 };
    const hadActive = (await db.moves.filter((m) => m.isActive && !m.archived).count()) > 0;
    for (const m of data.moves) {
      if (await db.moves.get(m.id)) continue;
      await db.moves.add({ ...m, isActive: hadActive ? false : m.isActive });
      r.moves++;
    }
    const skipped = new Set<string>();
    for (const b of data.boxes) {
      const existing = await db.boxes.get(b.id);
      const sameNumber = await db.boxes.where('[moveId+number]').equals([b.moveId, b.number]).first();
      if (sameNumber && sameNumber.id !== b.id) {
        skipped.add(b.id);
        continue;
      }
      if (!existing || b.updatedAt > existing.updatedAt) {
        await db.boxes.put(b);
        if (!existing) r.boxes++;
      }
    }
    r.skippedBoxes = skipped.size;
    for (const i of data.items) {
      if (skipped.has(i.boxId) || (await db.items.get(i.id))) continue;
      await db.items.add(i);
      r.items++;
    }
    for (const p of data.photos) {
      if (skipped.has(p.boxId) || (await db.photos.get(p.id))) continue;
      await db.photos.add(p);
      r.photos++;
    }
    // Lists such as rooms/categories: keep the phone's own values, only fill in missing ones.
    for (const s of settings) if (!(await db.settings.get(s.key))) await db.settings.put(s);
    if (!hadActive) {
      const first = await db.moves.filter((m) => !m.archived).first();
      if (first) await db.moves.update(first.id, { isActive: true });
    }
    return r;
  });
  notifyDataReset();
  return result;
}

/** Deletes every plan, box, item, photo and setting on this phone. */
export async function deleteAllData(): Promise<void> {
  await db.transaction('rw', [db.moves, db.boxes, db.items, db.photos, db.settings], async () => {
    await Promise.all([db.moves.clear(), db.boxes.clear(), db.items.clear(), db.photos.clear()]);
    await db.settings.where('key').noneOf([...DEVICE_SETTINGS]).delete();
  });
  notifyDataReset();
}

export async function countAllBoxes(): Promise<number> {
  return db.boxes.count();
}
