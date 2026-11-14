// @vitest-environment node
// (Node's Blob can be stored by fake-indexeddb; jsdom's cannot.)
import 'fake-indexeddb/auto';
import { db } from './schema';
import { createBox, deleteBox } from './boxes';
import { createMove } from './moves';
import { addPhotos, deletePhoto, getCoverThumb, listPhotos, setPhotoKind } from './photos';
import { setSetting } from './settings';
import { NO_FLAGS } from './types';

const jpeg = (tag: string) => new Blob([tag], { type: 'image/jpeg' });

async function box() {
  const move = await createMove({ name: 'M' });
  return createBox({ moveId: move.id, number: 1, flags: { ...NO_FLAGS }, status: 'packing' });
}

describe('photos', () => {
  it('stores blobs and queues only contents photos for OCR', async () => {
    const b = await box();
    await addPhotos(b.id, [
      { kind: 'outside', blob: jpeg('o'), thumbBlob: jpeg('ot'), width: 1600, height: 1200 },
      { kind: 'contents', blob: jpeg('c'), thumbBlob: jpeg('ct') },
    ]);
    const photos = await listPhotos(b.id);
    expect(photos.map((p) => [p.kind, p.ocrStatus])).toEqual([
      ['outside', 'skipped'],
      ['contents', 'pending'],
    ]);
    expect(photos[0].blob).toBeInstanceOf(Blob);
    expect(await photos[0].blob.text()).toBe('o');
    expect(photos[0].width).toBe(1600);
  });

  it('skips OCR when it is switched off', async () => {
    const b = await box();
    await setSetting('ocrEnabled', false);
    const [p] = await addPhotos(b.id, [{ kind: 'contents', blob: jpeg('c'), thumbBlob: jpeg('t') }]);
    expect(p.ocrStatus).toBe('skipped');
  });

  it('cover thumbnail prefers an outside photo', async () => {
    const b = await box();
    expect(await getCoverThumb(b.id)).toBeNull();
    await addPhotos(b.id, [{ kind: 'contents', blob: jpeg('c'), thumbBlob: jpeg('ct') }]);
    expect(await (await getCoverThumb(b.id))!.text()).toBe('ct');
    await addPhotos(b.id, [{ kind: 'outside', blob: jpeg('o'), thumbBlob: jpeg('ot') }]);
    expect(await (await getCoverThumb(b.id))!.text()).toBe('ot');
  });

  it('changing kind to contents queues OCR; delete removes the photo', async () => {
    const b = await box();
    const [p] = await addPhotos(b.id, [{ kind: 'outside', blob: jpeg('o'), thumbBlob: jpeg('t') }]);
    await setPhotoKind(p.id, 'contents');
    expect((await db.photos.get(p.id))?.ocrStatus).toBe('pending');
    await deletePhoto(p.id);
    expect(await listPhotos(b.id)).toEqual([]);
  });

  it('photos are removed with their box', async () => {
    const b = await box();
    await addPhotos(b.id, [{ kind: 'outside', blob: jpeg('o'), thumbBlob: jpeg('t') }]);
    await deleteBox(b.id);
    expect(await db.photos.count()).toBe(0);
  });
});
