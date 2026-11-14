import { IconMinus, IconPlus } from './Icons';

export function Stepper({
  value,
  min = 1,
  max = 999,
  onChange,
  label,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="inset flex items-center rounded-full" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="grid size-11 place-items-center text-muted disabled:opacity-30"
      >
        <IconMinus width={18} height={18} />
      </button>
      <span className="min-w-6 text-center font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="grid size-11 place-items-center text-muted disabled:opacity-30"
      >
        <IconPlus width={18} height={18} />
      </button>
    </div>
  );
}
