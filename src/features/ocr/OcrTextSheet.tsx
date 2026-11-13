import { useState } from 'react';
import { addItems, requeueOcr, setPhotoOcrText, useSettings, type Photo } from '../../db';
import { Sheet } from '../../components/Sheet';
import { Button, cx } from '../../components/ui';
import { IconCheck } from '../../components/Icons';
import { inputClass } from '../moves/MoveForm';
import { ocrTextToItemCandidates, type ItemCandidate } from './text';

function StatusLine({ photo, enabled }: { photo: Photo; enabled: boolean }) {
  if (photo.ocrStatus === 'pending')
    return <p className="text-sm text-muted">{enabled ? 'Reading text… you can keep using the app.' : 'Waiting – text reading is switched off in Settings.'}</p>;
  if (photo.ocrStatus === 'failed') return <p className="text-sm text-danger">Could not read this photo. Try “Read again”, or type the text yourself.</p>;
  if (photo.ocrStatus === 'skipped') return <p className="text-sm text-muted">Text is not read from outside photos. Type it here if you like.</p>;
  if (!photo.ocrText) return <p className="text-sm text-muted">No text found. You can type it yourself.</p>;
  return <p className="text-sm text-muted">Read from the photo. Fix anything that looks wrong – search uses this text.</p>;
}

function ItemPicker({ boxId, text, onDone }: { boxId: string; text: string; onDone: (n: number) => void }) {
  const candidates = ocrTextToItemCandidates(text);
  const [picked, setPicked] = useState<Set<number>>(() => new Set(candidates.map((_, i) => i)));
  const toggle = (i: number) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  const chosen: ItemCandidate[] = candidates.filter((_, i) => picked.has(i));
  if (!candidates.length) return <p className="py-4 text-center text-muted">There are no usable lines in this text.</p>;
  return (
    <>
      <p className="mb-3 text-sm text-muted">Tick the lines to add as items.</p>
      <ul className="flex flex-col gap-2" aria-label="Lines from photo">
        {candidates.map((c, i) => (
          <li key={i}>
            <button
              type="button"
              role="checkbox"
              aria-checked={picked.has(i)}
              onClick={() => toggle(i)}
              className="card flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left"
            >
              <span
                className={cx(
                  'grid size-6 shrink-0 place-items-center rounded-md border-2',
                  picked.has(i) ? 'border-accent bg-accent text-white' : 'border-line',
                )}
              >
                {picked.has(i) && <IconCheck width={16} height={16} />}
              </span>
              <span className="min-w-0 flex-1">{c.name}</span>
              {c.quantity > 1 && <span className="text-sm text-muted">×{c.quantity}</span>}
            </button>
          </li>
        ))}
      </ul>
      <Button
        variant="primary"
        className="mt-4 w-full"
        disabled={!chosen.length}
        onClick={async () => {
          await addItems(boxId, chosen.map((c) => ({ name: c.name, quantity: c.quantity })));
          onDone(chosen.length);
        }}
      >
        Add {chosen.length} {chosen.length === 1 ? 'item' : 'items'}
      </Button>
    </>
  );
}

/** View / edit the text read from a photo, re-run OCR, or turn the lines into items. */
export function OcrTextSheet({ photo, onClose, onItemsAdded }: { photo: Photo; onClose: () => void; onItemsAdded: (n: number) => void }) {
  const settings = useSettings();
  const [draft, setDraft] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const text = draft ?? photo.ocrText ?? '';
  const dirty = draft !== null && draft !== (photo.ocrText ?? '');

  return (
    <Sheet open onTop title={picking ? 'Turn text into items' : 'Text in photo'} onClose={onClose}>
      {picking ? (
        <ItemPicker
          boxId={photo.boxId}
          text={text}
          onDone={(n) => {
            setPicking(false);
            onItemsAdded(n);
          }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <StatusLine photo={photo} enabled={settings?.ocrEnabled ?? true} />
          <textarea
            aria-label="Text in photo"
            className={`${inputClass} min-h-40 font-mono text-sm`}
            value={text}
            placeholder={photo.ocrStatus === 'pending' ? 'Reading…' : 'No text'}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex gap-3">
            <Button
              className="flex-1"
              disabled={!dirty}
              onClick={async () => {
                await setPhotoOcrText(photo.id, draft ?? '', photo.ocrStatus === 'pending' ? 'done' : photo.ocrStatus === 'skipped' ? 'skipped' : 'done');
                setDraft(null);
              }}
            >
              Save text
            </Button>
            <Button
              className="flex-1"
              disabled={photo.ocrStatus === 'pending'}
              onClick={async () => {
                setDraft(null);
                await requeueOcr(photo.id);
              }}
            >
              Read again
            </Button>
          </div>
          <Button variant="primary" disabled={!text.trim()} onClick={() => setPicking(true)}>
            Turn text into items
          </Button>
        </div>
      )}
    </Sheet>
  );
}
