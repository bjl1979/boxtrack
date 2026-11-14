import Dexie from 'dexie';
import { db } from './schema';
import { DuplicateBoxNumberError, ValidationError } from './errors';
import { BOX_SIZES, BOX_STATUSES, NO_FLAGS, type Box, type BoxInput, type BoxStatus } from './types';
import { newId } from '../lib/id';
import { notifyBoxesChanged } from './changes';

/** Drops keys whose value is undefined so cleared fields are really removed from storage. */
function compact<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

function optText(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

/** Normalises and validates user input. Throws ValidationError. */
export function normaliseBoxInput(input: BoxInput): BoxInput {
  if (!Number.isInteger(input.number) || input.number < 1) {
    throw new ValidationError('Box number must be a whole number of 1 or more');
  }
  if (!input.moveId) throw new ValidationError('Box must belong to a move');
  if (!BOX_STATUSES.includes(input.status)) throw new ValidationError(`Unknown status "${input.status}"`);
  if (input.size !== undefined && !BOX_SIZES.includes(input.size)) {
    throw new ValidationError(`Unknown size "${input.size}"`);
  }
  const weightKg = input.weightKg;
  if (weightKg !== undefined && (!Number.isFinite(weightKg) || weightKg < 0)) {
    throw new ValidationError('Weight must be a positive number');
  }
  return compact({
    moveId: input.moveId,
    number: input.number,
    label: optText(input.label),
    fromRoom: optText(input.fromRoom),
    toRoom: optText(input.toRoom),
    category: optText(input.category),
    flags: { ...NO_FLAGS, ...input.flags },
    status: input.status,
    weightKg,
    size: input.size,
    notes: optText(input.notes),
  });
}

async function numberTaken(moveId: string, number: number, exceptId?: string): Promise<boolean> {
  const existing = await db.boxes.where('[moveId+number]').equals([moveId, number]).first();
  return !!existing && existing.id !== exceptId;
}

export async function isBoxNumberTaken(moveId: string, number: number, exceptId?: string): Promise<boolean> {
  return numberTaken(moveId, number, exceptId);
}

/** Next number to suggest for a new box: one more than the highest number in the move. */
export async function getNextBoxNumber(moveId: string): Promise<number> {
  const last = await db.boxes
    .where('[moveId+number]')
    .between([moveId, Dexie.minKey], [moveId, Dexie.maxKey])
    .last();
  return last ? last.number + 1 : 1;
}

export async function createBox(input: BoxInput): Promise<Box> {
  const data = normaliseBoxInput(input);
  const box = await db.transaction('rw', db.boxes, async () => {
    if (await numberTaken(data.moveId, data.number)) throw new DuplicateBoxNumberError(data.number);
    const now = Date.now();
    const box: Box = { id: newId(), ...data, createdAt: now, updatedAt: now };
    await db.boxes.add(box);
    return box;
  });
  notifyBoxesChanged([box.id]);
  return box;
}

export async function updateBox(id: string, input: BoxInput): Promise<Box> {
  const data = normaliseBoxInput(input);
  const box = await db.transaction('rw', db.boxes, async () => {
    const existing = await db.boxes.get(id);
    if (!existing) throw new ValidationError('Box not found');
    if (await numberTaken(data.moveId, data.number, id)) throw new DuplicateBoxNumberError(data.number);
    // put() (not update()) so cleared optional fields are actually removed.
    const box: Box = { ...data, id, createdAt: existing.createdAt, updatedAt: Date.now() };
    await db.boxes.put(box);
    return box;
  });
  notifyBoxesChanged([id]);
  return box;
}

export async function setBoxStatus(ids: string[], status: BoxStatus): Promise<void> {
  if (!BOX_STATUSES.includes(status)) throw new ValidationError(`Unknown status "${status}"`);
  const now = Date.now();
  await db.transaction('rw', db.boxes, async () => {
    await db.boxes.where('id').anyOf(ids).modify({ status, updatedAt: now });
  });
}

/** Deletes a box together with its items and photos, in one transaction. */
export async function deleteBox(id: string): Promise<void> {
  await db.transaction('rw', db.boxes, db.items, db.photos, async () => {
    await db.items.where('boxId').equals(id).delete();
    await db.photos.where('boxId').equals(id).delete();
    await db.boxes.delete(id);
  });
  notifyBoxesChanged([id]);
}

export async function getBox(id: string): Promise<Box | undefined> {
  return db.boxes.get(id);
}

export async function getBoxByNumber(moveId: string, number: number): Promise<Box | undefined> {
  return db.boxes.where('[moveId+number]').equals([moveId, number]).first();
}

export async function listBoxes(moveId: string): Promise<Box[]> {
  return db.boxes
    .where('[moveId+number]')
    .between([moveId, Dexie.minKey], [moveId, Dexie.maxKey])
    .toArray();
}

/** Item count per box id, for every box in the move. */
export async function getItemCounts(moveId: string): Promise<Record<string, number>> {
  const boxIds = (await listBoxes(moveId)).map((b) => b.id);
  const counts: Record<string, number> = {};
  if (!boxIds.length) return counts;
  await db.items
    .where('boxId')
    .anyOf(boxIds)
    .each((item) => {
      counts[item.boxId] = (counts[item.boxId] ?? 0) + 1;
    });
  return counts;
}
