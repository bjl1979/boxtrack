import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { Photo, PhotoKind } from '../../db';
import { useObjectUrl } from '../../lib/useObjectUrl';
import { IconBack, IconTrash, IconX } from '../../components/Icons';
import { cx } from '../../components/ui';

const MAX_SCALE = 5;
const SWIPE_PX = 60;

interface View {
  scale: number;
  x: number;
  y: number;
}
const RESET: View = { scale: 1, x: 0, y: 0 };

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Full-screen photo viewer: swipe between photos, pinch or double-tap to zoom, drag to pan. */
export function PhotoViewer({
  photos,
  index,
  onIndex,
  onClose,
  onKind,
  onDelete,
  onText,
}: {
  onText: (photo: Photo) => void;
  photos: Photo[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onKind: (photo: Photo, kind: PhotoKind) => void;
  onDelete: (photo: Photo) => void;
}) {
  const photo = photos[index];
  const url = useObjectUrl(photo?.blob);
  const [view, setView] = useState<View>(RESET);
  const [swipe, setSwipe] = useState(0);
  const [animating, setAnimating] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startDist: number; start: View; mid: { x: number; y: number }; downX: number; downY: number; moved: boolean; t: number }>(null);
  const lastTap = useRef(0);

  useEffect(() => setView(RESET), [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && index < photos.length - 1) onIndex(index + 1);
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, photos.length, onClose, onIndex]);

  if (!photo) return null;

  function clamp(v: View): View {
    const el = box.current;
    if (!el) return v;
    const maxX = ((v.scale - 1) * el.clientWidth) / 2;
    const maxY = ((v.scale - 1) * el.clientHeight) / 2;
    return { scale: v.scale, x: Math.max(-maxX, Math.min(maxX, v.x)), y: Math.max(-maxY, Math.min(maxY, v.y)) };
  }

  function down(e: RPointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setAnimating(false);
    const pts = [...pointers.current.values()];
    gesture.current = {
      startDist: pts.length === 2 ? dist(pts[0], pts[1]) : 0,
      start: view,
      mid: pts.length === 2 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : pts[0],
      downX: e.clientX,
      downY: e.clientY,
      moved: pts.length > 1,
      t: Date.now(),
    };
  }

  function move(e: RPointerEvent) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    if (pts.length === 2 && g.startDist > 0) {
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const scale = Math.max(1, Math.min(MAX_SCALE, (g.start.scale * dist(pts[0], pts[1])) / g.startDist));
      setView(clamp({ scale, x: g.start.x + (mid.x - g.mid.x), y: g.start.y + (mid.y - g.mid.y) }));
      return;
    }
    const dx = e.clientX - g.downX;
    const dy = e.clientY - g.downY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) g.moved = true;
    if (view.scale > 1) setView(clamp({ scale: g.start.scale, x: g.start.x + dx, y: g.start.y + dy }));
    else setSwipe(dx);
  }

  function up(e: RPointerEvent) {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (pointers.current.size > 0) {
      // One finger lifted after a pinch: restart from the remaining finger.
      const [p] = [...pointers.current.values()];
      gesture.current = { ...g, start: view, downX: p.x, downY: p.y, startDist: 0, moved: true };
      return;
    }
    gesture.current = null;
    setAnimating(true);
    if (!g.moved && Date.now() - g.t < 300) {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        lastTap.current = 0;
        setView(view.scale > 1 ? RESET : { scale: 2.5, x: 0, y: 0 });
        return;
      }
      lastTap.current = now;
    }
    if (view.scale === 1) {
      if (swipe < -SWIPE_PX && index < photos.length - 1) onIndex(index + 1);
      else if (swipe > SWIPE_PX && index > 0) onIndex(index - 1);
      setSwipe(0);
    }
  }

  const kindBtn = (k: PhotoKind, label: string) => (
    <button
      type="button"
      aria-pressed={photo.kind === k}
      onClick={() => onKind(photo, k)}
      className={cx('min-h-11 flex-1 rounded-xl text-sm font-medium', photo.kind === k ? 'bg-white/20 text-white' : 'text-white/60')}
    >
      {label}
    </button>
  );

  return (
    <div role="dialog" aria-modal="true" aria-label="Photo viewer" className="fixed inset-0 z-[80] flex flex-col bg-black text-white">
      <div className="flex items-center gap-2 px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
        <button type="button" aria-label="Close photo" onClick={onClose} className="grid size-12 place-items-center rounded-full bg-white/10">
          <IconX />
        </button>
        <span className="flex-1 text-center text-sm tabular-nums" data-testid="photo-position">
          {index + 1} / {photos.length}
        </span>
        <button type="button" aria-label="Delete photo" onClick={() => onDelete(photo)} className="grid size-12 place-items-center rounded-full bg-white/10 text-[var(--danger)]">
          <IconTrash />
        </button>
      </div>

      <div
        ref={box}
        className="relative flex-1 touch-none overflow-hidden select-none"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {url && (
          <img
            src={url}
            alt={`${photo.kind === 'outside' ? 'Outside' : 'Contents'} photo ${index + 1}`}
            draggable={false}
            data-testid="viewer-image"
            className="absolute inset-0 m-auto max-h-full max-w-full object-contain"
            style={{
              transform: `translate(${view.x + swipe}px, ${view.y}px) scale(${view.scale})`,
              transition: animating ? 'transform 200ms ease-out' : 'none',
            }}
          />
        )}
        {index > 0 && (
          <button type="button" aria-label="Previous photo" onClick={() => onIndex(index - 1)} className="absolute top-1/2 left-2 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 sm:grid">
            <IconBack />
          </button>
        )}
        {index < photos.length - 1 && (
          <button type="button" aria-label="Next photo" onClick={() => onIndex(index + 1)} className="absolute top-1/2 right-2 hidden size-12 -translate-y-1/2 rotate-180 place-items-center rounded-full bg-white/10 sm:grid">
            <IconBack />
          </button>
        )}
      </div>

      <div className="px-4 pt-2 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <div className="flex gap-2">
          <div className="flex flex-1 rounded-2xl bg-white/10 p-1" role="group" aria-label="Photo type">
            {kindBtn('contents', 'Contents')}
            {kindBtn('outside', 'Outside')}
          </div>
          <button
            type="button"
            onClick={() => onText(photo)}
            className="relative min-h-13 rounded-2xl bg-[var(--accent)] px-4 text-sm font-semibold text-white"
          >
            Text in photo
            {photo.ocrStatus === 'pending' && (
              <span className="absolute -top-1 -right-1 size-3 animate-pulse rounded-full bg-white" aria-label="reading text" />
            )}
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-white/50">Swipe for next photo · pinch or double-tap to zoom</p>
      </div>
    </div>
  );
}
