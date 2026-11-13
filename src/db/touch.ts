import { db } from './schema';

/** Marks a box as changed (so "Last updated" sorting reflects item/photo edits). Call inside a transaction. */
export async function touchBox(boxId: string): Promise<void> {
  await db.boxes.update(boxId, { updatedAt: Date.now() });
}
