import { Button } from './ui';

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center p-6">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} aria-hidden />
      <div role="alertdialog" aria-modal="true" aria-label={title} className="card relative w-full max-w-sm bg-surface p-6">
        <h2 className="text-lg font-semibold">{title}</h2>
        {body && <p className="mt-2 text-sm text-muted">{body}</p>}
        <div className="mt-6 flex gap-3">
          <Button className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button className="flex-1" variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
