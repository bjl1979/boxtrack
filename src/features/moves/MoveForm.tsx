import { useState, type FormEvent } from 'react';
import type { MoveInput } from '../../db';
import { Button } from '../../components/ui';

export const inputClass =
  'inset w-full min-h-12 px-4 py-3 text-text placeholder:text-muted/60 outline-none focus:ring-2 focus:ring-accent';

export function MoveForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: MoveInput;
  submitLabel: string;
  onSubmit: (input: MoveInput) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [fromAddress, setFrom] = useState(initial?.fromAddress ?? '');
  const [toAddress, setTo] = useState(initial?.toAddress ?? '');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onSubmit({ name, fromAddress, toAddress });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm text-muted">
        Move name
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Doha → Kochi, Dec 2026"
          required
          autoFocus
        />
      </label>
      <label className="flex flex-col gap-2 text-sm text-muted">
        From (optional)
        <input className={inputClass} value={fromAddress} onChange={(e) => setFrom(e.target.value)} placeholder="Old address" />
      </label>
      <label className="flex flex-col gap-2 text-sm text-muted">
        To (optional)
        <input className={inputClass} value={toAddress} onChange={(e) => setTo(e.target.value)} placeholder="New address" />
      </label>
      <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
        {submitLabel}
      </Button>
    </form>
  );
}
