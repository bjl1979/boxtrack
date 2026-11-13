import { db } from './schema';
import type { Box, Item } from './types';

/** Searchable text of one or more boxes (photo blobs are not read, only their OCR text). */
export interface SearchSources {
  boxes: Box[];
  items: Item[];
  photos: { id: string; boxId: string; ocrText: string }[];
}

/** All searchable data, or only that of the given boxes. */
export async function getSearchSources(boxIds?: string[]): Promise<SearchSources> {
  return db.transaction('r', db.boxes, db.items, db.photos, async () => {
    const boxes = boxIds ? (await db.boxes.bulkGet(boxIds)).filter((b): b is Box => !!b) : await db.boxes.toArray();
    const items = boxIds ? await db.items.where('boxId').anyOf(boxIds).toArray() : await db.items.toArray();
    const photos: SearchSources['photos'] = [];
    const coll = boxIds ? db.photos.where('boxId').anyOf(boxIds) : db.photos.toCollection();
    await coll.each((p) => {
      if (p.ocrText) photos.push({ id: p.id, boxId: p.boxId, ocrText: p.ocrText });
    });
    return { boxes, items, photos };
  });
}
