// @vitest-environment node
import 'fake-indexeddb/auto';
import { NO_FLAGS, addPhotos, createBox, createMove, db, setSetting } from '../../db';
import { OcrQueue } from './ocrQueue';

const jpeg = (tag: string) => new Blob([tag], { type: 'image/jpeg' });

async function box() {
  const move = await createMove({ name: 'M' });
  return createBox({ moveId: move.id, number: 1, flags: { ...NO_FLAGS }, status: 'packing' });
}

describe('OCR queue', () => {
  it('reads pending contents photos one at a time, oldest first, and stores clean text', async () => {
    const b = await box();
    const order: string[] = [];
    let active = 0;
    let maxActive = 0;
    const q = new OcrQueue(async (blob) => {
      active++;
      maxActive = Math.max(maxActive, active);
      const tag = await blob.text();
      order.push(tag);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return [
        { text: `Label ${tag}`, confidence: 90 },
        { text: '~~~', confidence: 90 },
      ];
    });
    await addPhotos(b.id, [
      { kind: 'contents', blob: jpeg('one'), thumbBlob: jpeg('t') },
      { kind: 'outside', blob: jpeg('outside'), thumbBlob: jpeg('t') },
      { kind: 'contents', blob: jpeg('two'), thumbBlob: jpeg('t') },
    ]);
    await q.kick();
    expect(order).toEqual(['one', 'two']);
    expect(maxActive).toBe(1);
    const photos = await db.photos.orderBy('id').toArray();
    const byText = Object.fromEntries(photos.map((p) => [p.ocrText ?? p.kind, p.ocrStatus]));
    expect(byText).toEqual({ 'Label one': 'done', 'Label two': 'done', outside: 'skipped' });
  });

  it('marks a failed photo as failed and carries on with the next one', async () => {
    const b = await box();
    const q = new OcrQueue(async (blob) => {
      if ((await blob.text()) === 'bad') throw new Error('boom');
      return [{ text: 'Books', confidence: 80 }];
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await addPhotos(b.id, [
      { kind: 'contents', blob: jpeg('bad'), thumbBlob: jpeg('t') },
      { kind: 'contents', blob: jpeg('good'), thumbBlob: jpeg('t') },
    ]);
    await q.kick();
    const statuses = (await db.photos.toArray()).map((p) => p.ocrStatus).sort();
    expect(statuses).toEqual(['done', 'failed']);
    expect(await db.photos.count()).toBe(2); // the photo is kept
    warn.mockRestore();
  });

  it('does nothing while OCR is switched off, and resumes when kicked after switching on', async () => {
    const b = await box();
    await addPhotos(b.id, [{ kind: 'contents', blob: jpeg('x'), thumbBlob: jpeg('t') }]);
    await setSetting('ocrEnabled', false);
    const recognize = vi.fn().mockResolvedValue([{ text: 'Tools', confidence: 90 }]);
    const q = new OcrQueue(recognize);
    await q.kick();
    expect(recognize).not.toHaveBeenCalled();
    await setSetting('ocrEnabled', true);
    await q.kick();
    expect(recognize).toHaveBeenCalledOnce();
    expect((await db.photos.toArray())[0].ocrText).toBe('Tools');
  });

  it('picks up photos added while it is busy', async () => {
    const b = await box();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const seen: string[] = [];
    const q = new OcrQueue(async (blob) => {
      const t = await blob.text();
      seen.push(t);
      if (t === 'first') await gate;
      return [{ text: t, confidence: 90 }];
    });
    await addPhotos(b.id, [{ kind: 'contents', blob: jpeg('first'), thumbBlob: jpeg('t') }]);
    const running = q.kick();
    await vi.waitFor(() => expect(seen).toEqual(['first']));
    await addPhotos(b.id, [{ kind: 'contents', blob: jpeg('second'), thumbBlob: jpeg('t') }]);
    void q.kick();
    release();
    await running;
    expect(seen).toEqual(['first', 'second']);
  });
});
