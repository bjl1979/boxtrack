import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { getBoxByNumber, getMove, setActiveMove, type Move } from '../../db';
import { IconX } from '../../components/Icons';
import { parseLabel } from './labelCode';
import { CameraError, startQrScanner } from './scanner';

/** Full-screen camera scanner: scanning a box label opens that box. */
export function ScanPage({ move }: { move: Move }) {
  const navigate = useNavigate();
  const location = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const handled = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [typed, setTyped] = useState('');

  const close = () => (location.key !== 'default' ? navigate(-1) : navigate('/boxes'));

  async function open(text: string): Promise<boolean> {
    const ref = parseLabel(text);
    if (!ref) {
      setMessage('That code is not a BoxTrack label.');
      return false;
    }
    let moveId = move.id;
    if (ref.moveId && ref.moveId !== move.id) {
      const other = await getMove(ref.moveId);
      if (!other) {
        setMessage('This label belongs to a packing plan that is not on this phone.');
        return false;
      }
      await setActiveMove(other.id);
      moveId = other.id;
    }
    navigator.vibrate?.(60);
    const box = await getBoxByNumber(moveId, ref.number);
    navigate(box ? `/boxes/${box.id}` : `/boxes/new?number=${ref.number}`, { replace: true });
    return true;
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    startQrScanner(video, (text) => {
      if (handled.current) return;
      handled.current = true;
      void open(text).then((ok) => {
        if (!ok) setTimeout(() => (handled.current = false), 1500);
      });
    })
      .then((s) => (cancelled ? s() : (stop = s)))
      .catch((e) => setError(e instanceof CameraError ? e.message : 'The camera could not be started.'));
    return () => {
      cancelled = true;
      stop?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitTyped(e: FormEvent) {
    e.preventDefault();
    if (typed.trim()) await open(typed);
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black text-white" role="dialog" aria-label="Scan box label">
      <div className="flex items-center gap-2 px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
        <button type="button" aria-label="Close scanner" onClick={close} className="grid size-12 place-items-center rounded-full bg-white/10">
          <IconX />
        </button>
        <p className="flex-1 text-center font-semibold">Scan a box label</p>
        <span className="size-12" />
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className="absolute inset-0 size-full object-cover" playsInline muted data-testid="scanner-video" />
        {!error && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
            <div className="size-64 rounded-3xl border-4 border-[var(--accent)] shadow-[0_0_0_9999px_rgb(0_0_0/0.45)]" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 grid place-items-center p-8 text-center">
            <p role="alert" className="text-white/90">
              {error}
            </p>
          </div>
        )}
      </div>

      <div className="px-4 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <p role="status" className="mb-3 min-h-5 text-center text-sm text-white/80">
          {message ?? 'Point the camera at the QR code on the label.'}
        </p>
        <form onSubmit={submitTyped} className="flex gap-2">
          <input
            className="min-h-12 min-w-0 flex-1 rounded-2xl bg-white/10 px-4 text-white outline-none placeholder:text-white/50 focus:ring-2 focus:ring-[var(--accent)]"
            inputMode="numeric"
            placeholder="Or type the box number"
            aria-label="Box number"
            value={typed}
            onChange={(e) => setTyped(e.target.value.replace(/\D/g, ''))}
          />
          <button type="submit" disabled={!typed} className="min-h-12 rounded-2xl bg-[var(--accent)] px-5 font-semibold disabled:opacity-40">
            Open
          </button>
        </form>
      </div>
    </div>
  );
}
