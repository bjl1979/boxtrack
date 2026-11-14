import { archiveMove, createMove, getActiveMove, listMoves, setActiveMove, unarchiveMove, updateMove } from './moves';
import { ValidationError } from './errors';

describe('moves', () => {
  it('first move becomes active, and a new move takes over as active', async () => {
    const a = await createMove({ name: 'Doha → Kochi' });
    expect((await getActiveMove())?.id).toBe(a.id);
    const b = await createMove({ name: 'Second' });
    expect((await getActiveMove())?.id).toBe(b.id);
    const all = await listMoves();
    expect(all.filter((m) => m.isActive)).toHaveLength(1);
  });

  it('can create a move without switching to it', async () => {
    const a = await createMove({ name: 'A' });
    await createMove({ name: 'B' }, false);
    expect((await getActiveMove())?.id).toBe(a.id);
  });

  it('trims fields and rejects empty names', async () => {
    const m = await createMove({ name: '  Trip  ', fromAddress: ' ', toAddress: ' Kochi ' });
    expect(m.name).toBe('Trip');
    expect(m.fromAddress).toBeUndefined();
    expect(m.toAddress).toBe('Kochi');
    await expect(createMove({ name: '   ' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('renames and switches active move', async () => {
    const a = await createMove({ name: 'A' });
    await createMove({ name: 'B' });
    await updateMove(a.id, { name: 'A renamed' });
    await setActiveMove(a.id);
    const active = await getActiveMove();
    expect(active?.name).toBe('A renamed');
    expect((await listMoves()).filter((m) => m.isActive)).toHaveLength(1);
  });

  it('archiving the active move activates another one; restore works', async () => {
    const a = await createMove({ name: 'A' });
    const b = await createMove({ name: 'B' });
    await archiveMove(b.id);
    expect((await getActiveMove())?.id).toBe(a.id);
    await archiveMove(a.id);
    expect(await getActiveMove()).toBeUndefined();
    await unarchiveMove(a.id);
    expect((await getActiveMove())?.id).toBe(a.id);
  });
});

describe('move stats', () => {
  it('counts boxes per move by progress', async () => {
    const { createBox } = await import('./boxes');
    const { NO_FLAGS } = await import('./types');
    const a = await createMove({ name: 'A' });
    const b = await createMove({ name: 'B' });
    const mk = (moveId: string, number: number, status: 'packing' | 'packed' | 'shipped' | 'delivered' | 'unpacked') =>
      createBox({ moveId, number, status, flags: { ...NO_FLAGS } });
    await mk(a.id, 1, 'packing');
    await mk(a.id, 2, 'packed');
    await mk(a.id, 3, 'shipped');
    await mk(a.id, 4, 'unpacked');
    await mk(b.id, 1, 'delivered');
    const { getMoveStats } = await import('./moves');
    expect(await getMoveStats()).toEqual({
      [a.id]: { total: 4, packed: 3, shipped: 2, delivered: 1 },
      [b.id]: { total: 1, packed: 1, shipped: 1, delivered: 1 },
    });
  });
});
