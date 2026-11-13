import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ');
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({
  variant = 'secondary',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-base font-semibold transition active:scale-[0.97] disabled:opacity-40',
        variant === 'primary' && 'bg-accent text-white shadow-[0_8px_20px_-8px_var(--accent)]',
        variant === 'secondary' && 'card text-text',
        variant === 'ghost' && 'text-muted',
        variant === 'danger' && 'bg-danger/15 text-danger',
        className,
      )}
    />
  );
}

/** Pill-shaped toggle chip with an optional coloured dot (the template's "BTC 29%" chips). */
export function Chip({
  selected,
  dot,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; dot?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      {...rest}
      className={cx(
        'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition active:scale-95',
        selected ? 'bg-surface-2 text-text ring-2 ring-accent' : 'inset text-muted',
        className,
      )}
    >
      {dot && <span className="size-2.5 rounded-full" style={{ background: dot }} />}
      {children}
    </button>
  );
}

/** Two-or-more option segmented control ("My icons | My Card"). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inset flex p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-11 flex-1 rounded-xl text-sm font-medium transition',
            value === o.value ? 'card text-text' : 'text-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-6 mb-2 flex items-center justify-between px-1">
      <h2 className="text-sm font-semibold tracking-wide text-muted">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card mt-6 flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div className="text-4xl">📦</div>
      <p className="text-lg font-semibold">{title}</p>
      {body && <p className="text-sm text-muted">{body}</p>}
      {action}
    </div>
  );
}
