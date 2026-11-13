import { BOX_STATUSES, type BoxStatus } from '../db';
import { STATUS_META } from '../features/boxes/statusMeta';
import { cx } from './ui';

/** Dotted progress tracker: Packing → Packed → Shipped → Delivered → Unpacked. */
export function StatusTrack({ status, onDark }: { status: BoxStatus; onDark?: boolean }) {
  const current = BOX_STATUSES.indexOf(status);
  return (
    <ol className="status-track mt-3 items-start" aria-label={`Status: ${STATUS_META[status].label}`}>
      {BOX_STATUSES.map((s, i) => {
        const done = i <= current;
        return (
          <li key={s} className="relative flex flex-1 flex-col items-center gap-1">
            {i > 0 && (
              <span
                aria-hidden
                className={cx(
                  'absolute top-[6px] right-1/2 left-[-50%] border-t-2 border-dotted',
                  i <= current ? (onDark ? 'border-white' : 'border-accent') : onDark ? 'border-white/40' : 'border-line',
                )}
              />
            )}
            <span
              className={cx(
                'relative z-10 size-3.5 rounded-full border-2',
                done
                  ? onDark
                    ? 'border-white bg-white'
                    : 'border-accent bg-accent'
                  : onDark
                    ? 'border-white/50 bg-transparent'
                    : 'border-line bg-bg-deep',
                i === current && 'ring-4 ' + (onDark ? 'ring-white/30' : 'ring-accent/30'),
              )}
            />
            <span className={cx('text-[10px]', onDark ? 'text-white/90' : done ? 'text-text' : 'text-muted')}>
              {STATUS_META[s].label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
