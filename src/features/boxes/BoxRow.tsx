import { Link } from 'react-router';
import { FLAG_KEYS, type Box } from '../../db';
import { FLAG_META, STATUS_META } from './statusMeta';

export function StatusPill({ status }: { status: Box['status'] }) {
  const m = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-deep px-2.5 py-1 text-xs font-medium">
      <span className="size-2 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

export function FlagIcons({ box, className }: { box: Box; className?: string }) {
  const on = FLAG_KEYS.filter((k) => box.flags[k]);
  if (!on.length) return null;
  return (
    <span className={className} aria-label={on.map((k) => FLAG_META[k].label).join(', ')}>
      {on.map((k) => (
        <span key={k} title={FLAG_META[k].label}>
          {FLAG_META[k].icon}
        </span>
      ))}
    </span>
  );
}

export function roomsText(box: Box): string {
  if (box.fromRoom && box.toRoom) return box.fromRoom === box.toRoom ? box.toRoom : `${box.fromRoom} → ${box.toRoom}`;
  return box.toRoom ? `→ ${box.toRoom}` : (box.fromRoom ?? '');
}

export function BoxRow({ box, itemCount }: { box: Box; itemCount: number }) {
  const color = STATUS_META[box.status].color;
  const rooms = roomsText(box);
  return (
    <Link
      to={`/boxes/${box.id}`}
      data-testid="box-row"
      className="card flex items-center gap-3 p-3 [content-visibility:auto] [contain-intrinsic-size:auto_84px] active:scale-[0.99]"
    >
      <div
        className="grid size-16 shrink-0 place-items-center rounded-2xl bg-bg-deep text-2xl font-bold tabular-nums"
        style={{ boxShadow: `inset 0 -3px 0 ${color}` }}
        aria-label={`Box ${box.number}`}
      >
        {box.number}
      </div>
      <div className="min-w-0 flex-1">
        <p className={box.label ? 'truncate font-semibold' : 'truncate font-semibold text-muted'}>{box.label ?? 'No label'}</p>
        <p className="truncate text-sm text-muted">{[rooms, box.category].filter(Boolean).join(' · ') || '—'}</p>
        <FlagIcons box={box} className="mt-0.5 flex gap-1 text-sm" />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <StatusPill status={box.status} />
        <span className="text-xs text-muted">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </span>
      </div>
    </Link>
  );
}
