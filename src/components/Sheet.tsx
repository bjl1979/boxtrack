import { useEffect, type ReactNode } from 'react';
import { IconX } from './Icons';

/** Bottom sheet modal. */
export function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
  onTop,
}: {
  /** Show above full-screen overlays such as the photo viewer. */
  onTop?: boolean;
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={`fixed inset-0 flex flex-col justify-end ${onTop ? 'z-[85]' : 'z-50'}`}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative mx-auto flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl bg-bg pb-safe shadow-2xl"
      >
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-line" />
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-11 place-items-center text-muted">
            <IconX />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-line/50 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
