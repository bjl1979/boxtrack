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
