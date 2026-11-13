import { BOX_STATUSES, type BoxStatus } from '../db';
import { STATUS_META } from '../features/boxes/statusMeta';

/** The template's segmented gradient ring, one arc per status. */
export function StatusRing({
  byStatus,
  total,
  caption,
}: {
  byStatus: Record<BoxStatus, number>;
  total: number;
  caption: string;
}) {
  const r = 84;
  const c = 2 * Math.PI * r;
  const gap = total > 1 ? 6 : 0;
  let offset = 0;
  const arcs = BOX_STATUSES.filter((s) => byStatus[s] > 0).map((s) => {
    const len = (byStatus[s] / Math.max(total, 1)) * c;
    const arc = { s, len: Math.max(len - gap, 2), offset };
    offset += len;
    return arc;
  });

  return (
    <div className="relative mx-auto size-48">
      <svg viewBox="0 0 200 200" className="size-full -rotate-90">
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--bg-deep)" strokeWidth="14" />
        <circle cx="100" cy="100" r={r - 16} fill="none" stroke="var(--line)" strokeWidth="1" strokeDasharray="2 6" />
        {arcs.map((a) => (
          <circle
            key={a.s}
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke={STATUS_META[a.s].color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${a.len} ${c}`}
            strokeDashoffset={-a.offset}
            style={{ filter: `drop-shadow(0 0 6px ${STATUS_META[a.s].color})` }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm text-muted">Total boxes</span>
        <span className="text-4xl font-semibold tabular-nums" data-testid="total-boxes">
          {total}
        </span>
        <span className="mt-1 text-xs text-muted">{caption}</span>
      </div>
    </div>
  );
}
