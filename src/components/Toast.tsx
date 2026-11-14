import { useCallback, useEffect, useState } from 'react';

/** Small transient confirmation pill. */
export function useToast(ms = 2000) {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), ms);
    return () => clearTimeout(t);
  }, [msg, ms]);
  const show = useCallback((m: string) => setMsg(m), []);
  const node = msg ? (
    <div
      role="status"
      className="fixed inset-x-0 top-20 z-[70] mx-auto w-fit max-w-[90vw] rounded-full bg-[var(--c-delivered)] px-5 py-2 font-semibold text-bg-deep shadow-lg"
    >
      ✓ {msg}
    </div>
  ) : null;
  return { show, node };
}
