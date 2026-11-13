import { db } from './schema';
import { createBox } from './boxes';
import { createMove } from './moves';
import { addItem, deleteItems, listItems, moveItems, parseItemEntry, reorderItems, setItemQuantity, updateItem } from './items';
import { ValidationError } from './errors';
import { NO_FLAGS } from './types';

async function setup() {
  const move = await createMove({ name: 'M' });
  const mk = (number: number) => createBox({ moveId: move.id, number, flags: { ...NO_FLAGS }, status: 'packing' });
  return { a: await mk(1), b: await mk(2) };
}

describe('parseItemEntry', () => {
  it.each([
    ['3x plates', 'plates', 3],
    ['3 x plates', 'plates', 3],
    ['plates x3', 'plates', 3],
    ['plates × 12', 'plates', 12],
    ['2 pin plug', '2 pin plug', 1],
    ['  Passport  ', 'Passport', 1],
    ['0x cups', 'cups', 1],
  ])('%s', (text, name, quantity) => {
    expect(parseItemEntry(text)).toEqual({ name, quantity });
  });
});

describe('items', () => {
  it('adds items in order and touches the box', async () => {
    const { a } = await setup();
    await new Promise((r) => setTimeout(r, 5));
    await addItem(a.id, { name: 'Drill' });
    await addItem(a.id, { name: ' Screws ', quantity: 3, note: 'box of 100' });
    const items = await listItems(a.id);
    expect(items.map((i) => [i.name, i.quantity, i.position])).toEqual([
      ['Drill', 1, 0],
      ['Screws', 3, 1],
    ]);
    expect(items[1].note).toBe('box of 100');
    expect((await db.boxes.get(a.id))!.updatedAt).toBeGreaterThan(a.updatedAt);
  });

  it('validates name and quantity', async () => {
    const { a } = await setup();
    await expect(addItem(a.id, { name: '  ' })).rejects.toBeInstanceOf(ValidationError);
    await expect(addItem(a.id, { name: 'x', quantity: 0 })).rejects.toBeInstanceOf(ValidationError);
    await expect(addItem('nope', { name: 'x' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('updates, clears note and changes quantity', async () => {
    const { a } = await setup();
    const it1 = await addItem(a.id, { name: 'Lamp', note: 'shade' });
    await updateItem(it1.id, { name: 'Desk lamp', quantity: 2, note: '' });
    await setItemQuantity(it1.id, 5);
    const [stored] = await listItems(a.id);
    expect(stored).toMatchObject({ name: 'Desk lamp', quantity: 5 });
    expect(stored).not.toHaveProperty('note');
  });

  it('reorders items', async () => {
    const { a } = await setup();
    const x = await addItem(a.id, { name: 'x' });
    const y = await addItem(a.id, { name: 'y' });
    const z = await addItem(a.id, { name: 'z' });
    await reorderItems(a.id, [z.id, x.id, y.id]);
    expect((await listItems(a.id)).map((i) => i.name)).toEqual(['z', 'x', 'y']);
    await expect(reorderItems(a.id, [x.id])).rejects.toBeInstanceOf(ValidationError);
  });

  it('moves items to the end of another box', async () => {
    const { a, b } = await setup();
    await addItem(b.id, { name: 'existing' });
    const x = await addItem(a.id, { name: 'x' });
    const y = await addItem(a.id, { name: 'y' });
    await addItem(a.id, { name: 'stays' });
    await moveItems([y.id, x.id], b.id);
    expect((await listItems(b.id)).map((i) => i.name)).toEqual(['existing', 'x', 'y']);
    expect((await listItems(a.id)).map((i) => i.name)).toEqual(['stays']);
  });

  it('deletes items', async () => {
    const { a } = await setup();
    const x = await addItem(a.id, { name: 'x' });
    await addItem(a.id, { name: 'y' });
    await deleteItems([x.id]);
    expect((await listItems(a.id)).map((i) => i.name)).toEqual(['y']);
  });
});
