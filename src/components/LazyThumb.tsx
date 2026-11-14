import { useEffect, useRef, useState } from 'react';
import { useObjectUrl } from '../lib/useObjectUrl';

/** Calls back once the element scrolls near the viewport (lazy loading for long lists). */
export function useNearViewport<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen || !ref.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setSeen(true), {
      rootMargin: '300px',
    });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}

export function BlobImage({ blob, alt, className }: { blob: Blob | null | undefined; alt: string; className?: string }) {
  const url = useObjectUrl(blob);
  if (!url) return <div className={className} aria-hidden />;
  return <img src={url} alt={alt} className={className} decoding="async" draggable={false} />;
}
