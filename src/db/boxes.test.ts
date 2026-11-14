import { db } from './schema';
import {
  createBox,
  deleteBox,
  getBoxByNumber,
  getItemCounts,
  getNextBoxNumber,
  isBoxNumberTaken,
  listBoxes,
  setBoxStatus,
  updateBox,
} from './boxes';
import { createMove } from './moves';
import { DuplicateBoxNumberError, ValidationError } from './errors';
import { NO_FLAGS, type BoxInput } from './types';

const input = (moveId: string, number: number, extra: Partial<BoxInput> = {}): BoxInput => ({
  moveId,
  number,
  flags: { ...NO_FLAGS },
  status: 'packing',
  ...extra,
});

describe('boxes', () => {
  let moveId: string;
  beforeEach(async () => {
    moveId = (await createMove({ name: 'Move' })).id;
  });

  it('suggests the next number after the highest one', async () => {
    expect(await getNextBoxNumber(moveId)).toBe(1);
    await createBox(input(moveId, 1));
    await createBox(input(moveId, 5));
    expect(await getNextBoxNumber(moveId)).toBe(6);
  });

  it('numbers are per move', async () => {
    const other = (await createMove({ name: 'Other' })).id;
    await createBox(input(moveId, 1));
    await createBox(input(other, 1));
    await createBox(input(other, 2));
    expect(await getNextBoxNumber(moveId)).toBe(2);
    expect(await listBoxes(moveId)).toHaveLength(1);
  });

  it('blocks duplicate numbers within a move', async () => {
    await createBox(input(moveId, 17));
    await expect(createBox(input(moveId, 17))).rejects.toBeInstanceOf(DuplicateBoxNumberError);
    expect(await isBoxNumberTaken(moveId, 17)).toBe(true);
    expect(await isBoxNumberTaken(moveId, 18)).toBe(false);
  });

  it('validates numbers, weight and status', async () => {
    await expect(createBox(input(moveId, 0))).rejects.toBeInstanceOf(ValidationError);
    await expect(createBox(input(moveId, 1.5))).rejects.toBeInstanceOf(ValidationError);
    await expect(createBox(input(moveId, 2, { weightKg: -1 }))).rejects.toBeInstanceOf(ValidationError);
    await expect(createBox(input(moveId, 3, { status: 'lost' as never }))).rejects.toBeInstanceOf(ValidationError);
  });

  it('stores trimmed optional fields and timestamps', async () => {
    const box = await createBox(
      input(moveId, 3, { label: ' Plates ', notes: '  ', toRoom: 'Kitchen', flags: { ...NO_FLAGS, fragile: true } }),
    );
    expect(box.label).toBe('Plates');
    expect(box.notes).toBeUndefined();
    expect(box.flags.fragile).toBe(true);
    expect(box.createdAt).toBe(box.updatedAt);
    expect((await getBoxByNumber(moveId, 3))?.id).toBe(box.id);
  });

  it('updates a box, clears fields and keeps createdAt', async () => {
    const box = await createBox(input(moveId, 1, { label: 'Old', category: 'Books' }));
    await new Promise((r) => setTimeout(r, 5));
    const updated = await updateBox(box.id, input(moveId, 2, { label: 'New' }));
    expect(updated.number).toBe(2);
    expect(updated.category).toBeUndefined();
    expect(updated.createdAt).toBe(box.createdAt);
    expect(updated.updatedAt).toBeGreaterThan(box.updatedAt);
    const stored = await db.boxes.get(box.id);
    expect(stored).not.toHaveProperty('category');
  });

  it('allows saving a box with its own number but not another box number', async () => {
    const a = await createBox(input(moveId, 1));
    await createBox(input(moveId, 2));
    await expect(updateBox(a.id, input(moveId, 1, { label: 'same' }))).resolves.toBeTruthy();
    await expect(updateBox(a.id, input(moveId, 2))).rejects.toBeInstanceOf(DuplicateBoxNumberError);
  });

  it('bulk status change', async () => {
    const a = await createBox(input(moveId, 1));
    const b = await createBox(input(moveId, 2));
    await setBoxStatus([a.id, b.id], 'shipped');
    expect((await listBoxes(moveId)).map((x) => x.status)).toEqual(['shipped', 'shipped']);
  });

  it('deleting a box removes its items and photos', async () => {
    const box = await createBox(input(moveId, 1));
    const keep = await createBox(input(moveId, 2));
    await db.items.bulkAdd([
      { id: 'i1', boxId: box.id, name: 'Drill', quantity: 1, position: 0, createdAt: 0 },
      { id: 'i2', boxId: keep.id, name: 'Books', quantity: 1, position: 0, createdAt: 0 },
    ]);
    await db.photos.add({
      id: 'p1',
      boxId: box.id,
      kind: 'contents',
      blob: new Blob(['x']),
      thumbBlob: new Blob(['x']),
      createdAt: 0,
      ocrStatus: 'pending',
    });
    expect(await getItemCounts(moveId)).toEqual({ [box.id]: 1, [keep.id]: 1 });
    await deleteBox(box.id);
    expect(await db.boxes.get(box.id)).toBeUndefined();
    expect(await db.items.where('boxId').equals(box.id).count()).toBe(0);
    expect(await db.photos.count()).toBe(0);
    expect(await db.items.count()).toBe(1);
  });
});

describe('bulk delete', () => {
  it('deletes several boxes with their items and photos', async () => {
    const { deleteBoxes } = await import('./boxes');
    const moveId = (await createMove({ name: 'M' })).id;
    const a = await createBox(input(moveId, 1));
    const b = await createBox(input(moveId, 2));
    const c = await createBox(input(moveId, 3));
    await db.items.bulkAdd([
      { id: 'i1', boxId: a.id, name: 'x', quantity: 1, position: 0, createdAt: 0 },
      { id: 'i2', boxId: c.id, name: 'y', quantity: 1, position: 0, createdAt: 0 },
    ]);
    await deleteBoxes([a.id, b.id]);
    expect((await listBoxes(moveId)).map((x) => x.number)).toEqual([3]);
    expect((await db.items.toArray()).map((i) => i.id)).toEqual(['i2']);
  });
});
