import Dexie from 'dexie';
import { db } from './schema';
import { ValidationError } from './errors';
import { touchBox } from './touch';
import type { Item } from './types';
import { newId } from '../lib/id';
import { notifyBoxesChanged } from './changes';

export const MAX_QUANTITY = 999;

export interface ItemInput {
  name: string;
  quantity?: number;
  note?: string;
}

function cleanQty(q: number | undefined): number {
  const n = q ?? 1;
  if (!Number.isInteger(n) || n < 1 || n > MAX_QUANTITY) {
    throw new ValidationError(`Quantity must be a whole number from 1 to ${MAX_QUANTITY}`);
  }
  return n;
}

function cleanName(name: string): string {
  const t = name.trim();
  if (!t) throw new ValidationError('Item name is required');
  return t;
}

/**
 * Parses quick-entry text: "3x plates", "3 x plates", "plates x3", "plates × 3" → quantity 3.
 * Only an explicit "x" marks a quantity, so "2 pin plug" stays a name.
 */
export function parseItemEntry(text: string): { name: string; quantity: number } {
  const t = text.trim().replace(/\s+/g, ' ');
  const lead = /^(\d{1,3})\s?[x×]\s+(.+)$/i.exec(t);
  if (lead) return { name: lead[2].trim(), quantity: Math.max(1, Number(lead[1])) };
  const trail = /^(.+?)\s+[x×]\s?(\d{1,3})$/i.exec(t);
  if (trail) return { name: trail[1].trim(), quantity: Math.max(1, Number(trail[2])) };
  return { name: t, quantity: 1 };
}

function itemsOf(boxId: string) {
  return db.items.where('[boxId+position]').between([boxId, Dexie.minKey], [boxId, Dexie.maxKey]);
}

export async function listItems(boxId: string): Promise<Item[]> {
  return itemsOf(boxId).toArray();
}

async function nextPosition(boxId: string): Promise<number> {
  const last = await itemsOf(boxId).last();
  return last ? last.position + 1 : 0;
}

export async function addItem(boxId: string, input: ItemInput): Promise<Item> {
  const name = cleanName(input.name);
  const quantity = cleanQty(input.quantity);
  const created = await db.transaction('rw', db.items, db.boxes, async () => {
    if (!(await db.boxes.get(boxId))) throw new ValidationError('Box not found');
    const item: Item = { id: newId(), boxId, name, quantity, position: await nextPosition(boxId), createdAt: Date.now() };
    const note = input.note?.trim();
    if (note) item.note = note;
    await db.items.add(item);
    await touchBox(boxId);
    return item;
  });
  notifyBoxesChanged([boxId]);
  return created;
}

/** Adds several items to a box in one transaction (e.g. from photo text). */
export async function addItems(boxId: string, inputs: ItemInput[]): Promise<Item[]> {
  const clean = inputs.map((i) => ({ name: cleanName(i.name), quantity: cleanQty(i.quantity), note: i.note?.trim() }));
  const created = await db.transaction('rw', db.items, db.boxes, async () => {
    if (!(await db.boxes.get(boxId))) throw new ValidationError('Box not found');
    let position = await nextPosition(boxId);
    const now = Date.now();
    const rows: Item[] = clean.map((c, i) => ({
      id: newId(),
      boxId,
      name: c.name,
      quantity: c.quantity,
      ...(c.note ? { note: c.note } : {}),
      position: position++,
      createdAt: now + i,
    }));
    await db.items.bulkAdd(rows);
    await touchBox(boxId);
    return rows;
  });
  notifyBoxesChanged([boxId]);
  return created;
}

export async function updateItem(id: string, input: ItemInput): Promise<void> {
  const name = cleanName(input.name);
  const quantity = cleanQty(input.quantity);
  const boxId = await db.transaction('rw', db.items, db.boxes, async () => {
    const item = await db.items.get(id);
    if (!item) throw new ValidationError('Item not found');
    const next: Item = { ...item, name, quantity };
    const note = input.note?.trim();
    if (note) next.note = note;
    else delete next.note;
    await db.items.put(next);
    await touchBox(item.boxId);
    return item.boxId;
  });
  notifyBoxesChanged([boxId]);
}

export async function setItemQuantity(id: string, quantity: number): Promise<void> {
  const q = cleanQty(quantity);
  await db.transaction('rw', db.items, db.boxes, async () => {
    const item = await db.items.get(id);
    if (!item) throw new ValidationError('Item not found');
    await db.items.update(id, { quantity: q });
    await touchBox(item.boxId);
  });
}

export async function deleteItems(ids: string[]): Promise<void> {
  const boxIds = await db.transaction('rw', db.items, db.boxes, async () => {
    const items = (await db.items.bulkGet(ids)).filter((i): i is Item => !!i);
    await db.items.bulkDelete(ids);
    const boxIds = new Set(items.map((i) => i.boxId));
    for (const boxId of boxIds) await touchBox(boxId);
    return boxIds;
  });
  notifyBoxesChanged(boxIds);
}

/** Saves a new order for a box's items. `orderedIds` must contain exactly the box's items. */
export async function reorderItems(boxId: string, orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.items, db.boxes, async () => {
    const current = await listItems(boxId);
    const ids = new Set(current.map((i) => i.id));
    if (orderedIds.length !== ids.size || !orderedIds.every((id) => ids.has(id))) {
      throw new ValidationError('Item list changed, please try again');
    }
    await Promise.all(orderedIds.map((id, position) => db.items.update(id, { position })));
    await touchBox(boxId);
  });
}

/** Moves items (keeping their relative order) to the end of another box. */
export async function moveItems(ids: string[], targetBoxId: string): Promise<void> {
  const changed = await db.transaction('rw', db.items, db.boxes, async () => {
    const target = await db.boxes.get(targetBoxId);
    if (!target) throw new ValidationError('Target box not found');
    const items = (await db.items.bulkGet(ids))
      .filter((i): i is Item => !!i)
      .sort((a, b) => (a.boxId === b.boxId ? a.position - b.position : 0));
    let pos = await nextPosition(targetBoxId);
    const sources = new Set<string>();
    for (const item of items) {
      if (item.boxId === targetBoxId) continue;
      sources.add(item.boxId);
      await db.items.update(item.id, { boxId: targetBoxId, position: pos++ });
    }
    for (const s of sources) await touchBox(s);
    await touchBox(targetBoxId);
    return [...sources, targetBoxId];
  });
  notifyBoxesChanged(changed);
}
