import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { addPhotos, useSettings, type Box, type Photo, type PhotoKind } from '../../db';
import { useOcrCurrent } from '../ocr/useOcrActivity';
import { compressPhoto } from '../../lib/image';
import { BlobImage } from '../../components/LazyThumb';
import { IconCamera, IconImage } from '../../components/Icons';
import { Segmented, cx } from '../../components/ui';

export function PhotosPanel({
  box,
  photos,
  highlightId,
  onOpen,
}: {
  box: Box;
  photos: Photo[];
  highlightId?: string;
  onOpen: (photoId: string) => void;
}) {
  const [kind, setKind] = useState<PhotoKind>('contents');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const settings = useSettings();
  const ocrCurrent = useOcrCurrent();
  const hasPhotos = photos.length > 0;
  useEffect(() => {
    if (highlightId && hasPhotos) document.getElementById(`photo-${highlightId}`)?.scrollIntoView({ block: 'center' });
  }, [highlightId, hasPhotos]);

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = ''; // allow picking the same file again
    if (!files.length) return;
    setError(null);
    setProgress({ done: 0, total: files.length });
    let failed = 0;
    // One photo at a time keeps memory low on phones; each is saved as soon as it is ready.
    for (const [i, file] of files.entries()) {
      try {
        const c = await compressPhoto(file);
        await addPhotos(box.id, [{ kind, ...c }]);
      } catch {
        failed++;
      }
      setProgress({ done: i + 1, total: files.length });
    }
    setProgress(null);
    if (failed) setError(`${failed} ${failed === 1 ? 'file was' : 'files were'} not an image that could be read.`);
  }

  return (
    <div>
      <Segmented
        label="Type of new photos"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'contents', label: 'Contents' },
          { value: 'outside', label: 'Outside' },
        ]}
      />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={!!progress}
          className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl bg-accent font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent)] active:scale-95 disabled:opacity-50"
        >
          <IconCamera /> Take photo
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          disabled={!!progress}
          className="card flex min-h-20 flex-col items-center justify-center gap-1 font-semibold active:scale-95 disabled:opacity-50"
        >
          <IconImage /> From gallery
        </button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFiles} data-testid="camera-input" />
      <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={onFiles} data-testid="gallery-input" />

      {progress && (
        <p role="status" className="mt-3 text-center text-sm text-muted">
          Saving photo {Math.min(progress.done + 1, progress.total)} of {progress.total}…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-2xl bg-danger/15 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {photos.length === 0 && !progress && (
        <p className="mt-6 text-center text-sm text-muted">No photos yet. Snap the open box before you tape it, and the outside with its label.</p>
      )}

      <ul className="mt-4 grid grid-cols-3 gap-2" aria-label="Photos">
        {photos.map((p, i) => (
          <li key={p.id} id={`photo-${p.id}`}>
            <button
              type="button"
              onClick={() => onOpen(p.id)}
              aria-label={`Open ${p.kind} photo ${i + 1}`}
              data-testid="photo-thumb"
              className={cx(
                'relative block aspect-square w-full overflow-hidden rounded-2xl bg-bg-deep',
                highlightId === p.id && 'ring-4 ring-accent',
              )}
            >
              <BlobImage blob={p.thumbBlob} alt="" className="size-full object-cover" />
              <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                {p.kind === 'outside' ? 'Outside' : 'Contents'}
              </span>
              {p.ocrStatus === 'pending' && settings?.ocrEnabled && (
                <span
                  className="absolute top-1 left-1 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-white"
                  data-testid="ocr-reading"
                >
                  <span className={`size-1.5 rounded-full bg-[var(--accent)] ${ocrCurrent === p.id ? 'animate-pulse' : ''}`} />
                  {ocrCurrent === p.id ? 'Reading text…' : 'Queued'}
                </span>
              )}
              {p.ocrText && p.ocrStatus !== 'pending' && (
                <span className="absolute top-1 right-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white" title="Has text" data-testid="ocr-has-text">
                  Aa
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
