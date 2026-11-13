import { useEffect, useRef, useState } from 'react';
import {
  BOX_SIZES,
  BOX_STATUSES,
  DuplicateBoxNumberError,
  FLAG_KEYS,
  NO_FLAGS,
  ValidationError,
  isBoxNumberTaken,
  type Box,
  type BoxInput,
  type BoxSize,
  type FlagKey,
} from '../../db';
import { Button, Chip } from '../../components/ui';
import { inputClass } from '../moves/MoveForm';
import { FLAG_META, STATUS_META } from './statusMeta';

export interface BoxFormValues {
  number: string;
  label: string;
  fromRoom?: string;
  toRoom?: string;
  category?: string;
  flags: Record<FlagKey, boolean>;
  status: Box['status'];
  size?: BoxSize;
  weightKg: string;
  notes: string;
}

export function valuesFromBox(box: Box): BoxFormValues {
  return {
    number: String(box.number),
    label: box.label ?? '',
    fromRoom: box.fromRoom,
    toRoom: box.toRoom,
    category: box.category,
    flags: { ...NO_FLAGS, ...box.flags },
    status: box.status,
    size: box.size,
    weightKg: box.weightKg === undefined ? '' : String(box.weightKg),
    notes: box.notes ?? '',
  };
}

export function emptyValues(number: number, keep?: Partial<BoxFormValues>): BoxFormValues {
  return {
    number: String(number),
    label: '',
    flags: { ...NO_FLAGS },
    status: 'packing',
    weightKg: '',
    notes: '',
    ...keep,
  };
}

export function toInput(moveId: string, v: BoxFormValues): BoxInput {
  const weight = v.weightKg.trim() === '' ? undefined : Number(v.weightKg.replace(',', '.'));
  return {
    moveId,
    number: Number(v.number),
    label: v.label,
    fromRoom: v.fromRoom,
    toRoom: v.toRoom,
    category: v.category,
    flags: v.flags,
    status: v.status,
    size: v.size,
    weightKg: weight,
    notes: v.notes,
  };
}

function ChipPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value?: string;
  onChange: (v?: string) => void;
}) {
  // Keep a value that was removed from the editable list visible so it isn't silently lost.
  const all = value && !options.includes(value) ? [...options, value] : options;
  return (
    <fieldset>
      <legend className="mb-2 text-sm text-muted">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {all.map((o) => (
          <Chip key={o} selected={value === o} onClick={() => onChange(value === o ? undefined : o)}>
            {o}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}

export function BoxForm({
  moveId,
  editingId,
  initial,
  rooms,
  categories,
  onSave,
  onSaveNext,
}: {
  moveId: string;
  editingId?: string;
  initial: BoxFormValues;
  rooms: string[];
  categories: string[];
  /** Persist the box. Throw DuplicateBoxNumberError / ValidationError to show an error. */
  onSave: (input: BoxInput) => Promise<void>;
  /** When set, a "Save & next box" button is shown. */
  onSaveNext?: (input: BoxInput) => Promise<BoxFormValues>;
}) {
  const [v, setV] = useState<BoxFormValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [dupe, setDupe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const labelRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof BoxFormValues>(k: K, val: BoxFormValues[K]) => setV((p) => ({ ...p, [k]: val }));

  const num = Number(v.number);
  const numberValid = Number.isInteger(num) && num >= 1;

  // Live duplicate check as the number is typed.
  useEffect(() => {
    let cancelled = false;
    if (!numberValid) {
      setDupe(false);
      return;
    }
    isBoxNumberTaken(moveId, num, editingId).then((taken) => !cancelled && setDupe(taken));
    return () => {
      cancelled = true;
    };
  }, [moveId, num, numberValid, editingId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  async function run(next: boolean) {
    setError(null);
    setBusy(true);
    try {
      const input = toInput(moveId, v);
      if (next && onSaveNext) {
        const fresh = await onSaveNext(input);
        setV(fresh);
        setToast(`Box ${input.number} saved`);
        window.scrollTo({ top: 0 });
        labelRef.current?.focus();
      } else {
        await onSave(input);
      }
    } catch (e) {
      if (e instanceof DuplicateBoxNumberError) {
        setDupe(true);
        setError(e.message);
      } else if (e instanceof ValidationError) setError(e.message);
      else setError('Could not save the box. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const canSave = numberValid && !dupe && !busy;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) void run(false);
      }}
      className="flex flex-col gap-5 px-4 pb-32"
    >
      <div className="relative overflow-hidden rounded-3xl hero-card p-5 shadow-xl">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold tracking-[0.2em] text-white/70">BOX NUMBER</span>
          <input
            aria-label="Box number"
            inputMode="numeric"
            pattern="[0-9]*"
            value={v.number}
            onChange={(e) => set('number', e.target.value.replace(/\D/g, ''))}
            className="w-full bg-transparent text-6xl font-bold tabular-nums text-white outline-none"
          />
        </label>
        <p role={dupe || (!numberValid && v.number !== '') ? 'alert' : undefined} className="min-h-5 text-sm text-white">
          {dupe ? `⚠ Box ${num} already exists in this move` : !numberValid ? 'Enter a number of 1 or more' : ''}
        </p>
      </div>

      <label className="flex flex-col gap-2 text-sm text-muted">
        Label
        <input
          ref={labelRef}
          className={inputClass}
          value={v.label}
          onChange={(e) => set('label', e.target.value)}
          placeholder="e.g. Kitchen – plates"
          enterKeyHint="done"
        />
      </label>

      <ChipPicker label="From room" options={rooms} value={v.fromRoom} onChange={(x) => set('fromRoom', x)} />
      <ChipPicker label="To room" options={rooms} value={v.toRoom} onChange={(x) => set('toRoom', x)} />
      <ChipPicker label="Category" options={categories} value={v.category} onChange={(x) => set('category', x)} />

      <fieldset>
        <legend className="mb-2 text-sm text-muted">Flags</legend>
        <div className="grid grid-cols-2 gap-2">
          {FLAG_KEYS.map((k) => (
            <Chip key={k} selected={v.flags[k]} onClick={() => set('flags', { ...v.flags, [k]: !v.flags[k] })} className="justify-center">
              {FLAG_META[k].icon} {FLAG_META[k].label}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm text-muted">Status</legend>
        <div className="flex flex-wrap gap-2">
          {BOX_STATUSES.map((s) => (
            <Chip key={s} dot={STATUS_META[s].color} selected={v.status === s} onClick={() => set('status', s)}>
              {STATUS_META[s].label}
            </Chip>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-[1fr_8rem] gap-3">
        <fieldset>
          <legend className="mb-2 text-sm text-muted">Size</legend>
          <div className="flex gap-2">
            {BOX_SIZES.map((s) => (
              <Chip key={s} selected={v.size === s} onClick={() => set('size', v.size === s ? undefined : s)} className="flex-1 justify-center px-0">
                {s}
              </Chip>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-2 text-sm text-muted">
          Weight (kg)
          <input
            className={inputClass}
            inputMode="decimal"
            value={v.weightKg}
            onChange={(e) => set('weightKg', e.target.value.replace(/[^\d.,]/g, ''))}
            placeholder="—"
          />
        </label>
      </div>

      <label className="flex flex-col gap-2 text-sm text-muted">
        Notes
        <textarea className={`${inputClass} min-h-24`} value={v.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>

      {error && (
        <p role="alert" className="rounded-2xl bg-danger/15 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-lg gap-3 bg-bg/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur">
        <Button type="submit" variant={onSaveNext ? 'secondary' : 'primary'} className="flex-1" disabled={!canSave}>
          Save
        </Button>
        {onSaveNext && (
          <Button variant="primary" className="flex-[1.4]" disabled={!canSave} onClick={() => void run(true)}>
            Save &amp; next box
          </Button>
        )}
      </div>

      {toast && (
        <div role="status" className="fixed inset-x-0 top-20 z-50 mx-auto w-fit rounded-full bg-[var(--c-delivered)] px-5 py-2 font-semibold text-bg-deep shadow-lg">
          ✓ {toast}
        </div>
      )}
    </form>
  );
}
