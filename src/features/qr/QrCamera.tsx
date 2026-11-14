import { useEffect, useRef, useState } from 'react';
import { CameraError, startQrScanner } from './scanner';

/** Live camera view that reports every QR code it sees. The camera stops when this unmounts. */
export function QrCamera({ onText, className }: { onText: (text: string) => void; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    startQrScanner(video, (t) => onTextRef.current(t))
      .then((s) => (cancelled ? s() : (stop = s)))
      .catch((e) => setError(e instanceof CameraError ? e.message : 'The camera could not be started.'));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return (
    <div className={`relative overflow-hidden bg-black ${className ?? ''}`}>
      <video ref={videoRef} className="absolute inset-0 size-full object-cover" playsInline muted data-testid="scanner-video" />
      {!error && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
          <div className="aspect-square h-3/4 max-h-64 rounded-3xl border-4 border-[var(--accent)] shadow-[0_0_0_9999px_rgb(0_0_0/0.45)]" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <p role="alert" className="text-sm text-white/90">
            {error}
          </p>
        </div>
      )}
    </div>
  );
}
