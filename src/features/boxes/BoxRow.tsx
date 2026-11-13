import { Link } from 'react-router';
import { FLAG_KEYS, useCoverThumb, type Box } from '../../db';
import { BlobImage, useNearViewport } from '../../components/LazyThumb';
import { StatusTrack } from '../../components/StatusTrack';
import { FLAG_META, STATUS_META } from './statusMeta';

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

/** Box number badge with the cover photo behind it (photo loads once the row is near the screen). */
function NumberBadge({ box }: { box: Box }) {
  const [ref, near] = useNearViewport<HTMLDivElement>();
  const thumb = useCoverThumb(box.id, near);
  return (
    <div
      ref={ref}
      className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-bg-deep"
      style={{ boxShadow: `inset 0 -3px 0 ${STATUS_META[box.status].color}` }}
      aria-label={`Box ${box.number}`}
    >
      {thumb && (
        <>
          <BlobImage blob={thumb} alt="" className="absolute inset-0 size-full object-cover" />
          <span className="absolute inset-0 bg-black/45" aria-hidden />
        </>
      )}
      <span className="relative text-2xl font-bold tabular-nums text-white [text-shadow:0_1px_4px_rgb(0_0_0/0.6)]">
        {box.number}
      </span>
    </div>
  );
}

export function BoxRow({ box, itemCount }: { box: Box; itemCount: number }) {
  const rooms = roomsText(box);
  return (
    <Link
      to={`/boxes/${box.id}`}
      data-testid="box-row"
      className="card block p-3 [content-visibility:auto] [contain-intrinsic-size:auto_84px] active:scale-[0.99]"
    >
      <div className="flex items-center gap-3">
        <NumberBadge box={box} />
        <div className="min-w-0 flex-1">
          <p className={box.label ? 'truncate font-semibold' : 'truncate font-semibold text-muted'}>
            {box.label ?? 'No label'}
          </p>
          <p className="truncate text-sm text-muted">{[rooms, box.category].filter(Boolean).join(' · ') || '—'}</p>
          <FlagIcons box={box} className="mt-0.5 flex gap-1 text-sm" />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="text-xs text-muted">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
        </div>
      </div>
      <StatusTrack status={box.status} />
    </Link>
  );
}
