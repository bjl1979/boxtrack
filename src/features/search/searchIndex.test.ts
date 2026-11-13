// @vitest-environment node
import 'fake-indexeddb/auto';
import {
  NO_FLAGS,
  addItem,
  addPhotos,
  createBox,
  createMove,
  deleteBox,
  deleteItems,
  moveItems,
  onBoxesChanged,
  setPhotoOcrText,
  updateBox,
  updateItem,
  type BoxInput,
} from '../../db';
import { BoxSearchIndex } from './searchIndex';

const jpeg = () => new Blob(['x'], { type: 'image/jpeg' });

describe('search index', () => {
  let index: BoxSearchIndex;
  let unsub: () => void;
  let moveId: string;
  const box = (number: number, extra: Partial<BoxInput> = {}) =>
    createBox({ moveId, number, flags: { ...NO_FLAGS }, status: 'packing', ...extra });
  const top = (q: string) => index.search(q, moveId)[0];
  const sync = () => index.idle();

  beforeEach(async () => {
    moveId = (await createMove({ name: 'Doha → Kochi' })).id;
    index = new BoxSearchIndex();
    unsub = onBoxesChanged((ids) => void index.reindexBoxes(ids));
  });
  afterEach(() => unsub());

  it('finds an item despite a typo ("passprt" → Box 17)', async () => {
    const b17 = await box(17, { label: 'Study' });
    const b3 = await box(3, { label: 'Kitchen' });
    await addItem(b17.id, { name: 'Passport' });
    await addItem(b17.id, { name: 'Birth certificates' });
    await addItem(b3.id, { name: 'Pasta pot' });
    await index.rebuild();
    const hit = top('passprt');
    expect(hit.boxId).toBe(b17.id);
    expect(hit.matches[0]).toMatchObject({ source: 'item', text: 'Passport', terms: ['passport'] });
  });

  it('finds a box from photo text alone ("masala")', async () => {
    const b = await box(9, { label: 'Pantry' });
    await box(10, { label: 'Linen' });
    const [p] = await addPhotos(b.id, [{ kind: 'contents', blob: jpeg(), thumbBlob: jpeg() }]);
    await index.rebuild();
    expect(index.search('masala', moveId)).toEqual([]);
    await setPhotoOcrText(p.id, 'EVEREST\nGaram Masala\n100 g', 'done');
    await sync();
    const hit = top('masala');
    expect(hit.boxId).toBe(b.id);
    expect(hit.matches[0]).toMatchObject({ source: 'photo', photoId: p.id });
  });

  it('searches labels, notes, rooms and categories, and prefers multi-word AND matches', async () => {
    const a = await box(1, { label: 'Kitchen – plates', toRoom: 'Kitchen', notes: 'wrapped in newspaper' });
    const b = await box(2, { label: 'Toys', category: 'Toys', toRoom: 'Kids Room' });
    await index.rebuild();
    expect(top('newspaper').matches[0].source).toBe('boxNote');
    expect(top('kids').boxId).toBe(b.id);
    expect(top('kids').matches[0].source).toBe('room');
    expect(top('kitchen plates').boxId).toBe(a.id);
  });

  it('stays in sync with creates, updates, moves and deletes', async () => {
    await index.rebuild();
    const a = await box(1);
    const b = await box(2);
    const drill = await addItem(a.id, { name: 'Drill' });
    await sync();
    expect(top('drill').boxId).toBe(a.id);

    await updateItem(drill.id, { name: 'Hammer drill', note: 'with bits' });
    await sync();
    expect(top('bits').matches[0].source).toBe('itemNote');

    await moveItems([drill.id], b.id);
    await sync();
    expect(index.search('drill', moveId).map((h) => h.boxId)).toEqual([b.id]);

    await updateBox(b.id, { moveId, number: 2, flags: { ...NO_FLAGS }, status: 'packing', label: 'Garage tools' });
    await sync();
    expect(top('garage').boxId).toBe(b.id);

    await deleteItems([drill.id]);
    await sync();
    expect(index.search('drill', moveId)).toEqual([]);

    await deleteBox(b.id);
    await sync();
    expect(index.search('garage', moveId)).toEqual([]);
  });

  it('only searches the given move', async () => {
    const other = await createMove({ name: 'Other' });
    const mine = await box(1);
    const theirs = await createBox({ moveId: other.id, number: 1, flags: { ...NO_FLAGS }, status: 'packing' });
    await addItem(mine.id, { name: 'Lamp' });
    await addItem(theirs.id, { name: 'Lamp' });
    await index.rebuild();
    expect(index.search('lamp', moveId).map((h) => h.boxId)).toEqual([mine.id]);
    expect(index.search('lamp', other.id).map((h) => h.boxId)).toEqual([theirs.id]);
  });

  it('groups several matches under one box and ranks it higher', async () => {
    const a = await box(1);
    const b = await box(2);
    await addItem(a.id, { name: 'Charger' });
    await addItem(b.id, { name: 'Phone charger' });
    await addItem(b.id, { name: 'Laptop charger' });
    await index.rebuild();
    const hits = index.search('charger', moveId);
    expect(hits).toHaveLength(2);
    expect(hits.find((h) => h.boxId === b.id)!.matches).toHaveLength(2);
  });
});
