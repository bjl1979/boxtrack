import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { createMove, setActiveMove, useMoveStats, useMoves, type Move, type MoveStats } from '../../db';
import { HeroTruck } from '../../components/HeroTruck';
import { IconBoxes, IconSettings } from '../../components/Icons';
import { Sheet } from '../../components/Sheet';
import { SectionTitle, cx } from '../../components/ui';
import { MoveForm } from './MoveForm';

const EMPTY: MoveStats = { total: 0, packed: 0, shipped: 0, delivered: 0 };

/** Three-step progress (Packed → Shipped → Delivered) with counts, like a shipment tracker. */
function PlanTrack({ stats, onAccent }: { stats: MoveStats; onAccent: boolean }) {
  const steps = [
    { label: 'Packed', n: stats.packed },
    { label: 'Shipped', n: stats.shipped },
    { label: 'Delivered', n: stats.delivered },
  ];
  return (
    <ol className="mt-4 flex items-start">
      {steps.map((s, i) => {
        const done = stats.total > 0 && s.n === stats.total;
        const started = s.n > 0;
        return (
          <li key={s.label} className="relative flex flex-1 flex-col items-center gap-1">
            {i > 0 && (
              <span
                aria-hidden
                className={cx(
                  'absolute top-[6px] right-1/2 left-[-50%] border-t-2 border-dotted',
                  started ? (onAccent ? 'border-white' : 'border-accent') : onAccent ? 'border-white/40' : 'border-line',
                )}
              />
            )}
            <span
              className={cx(
                'relative z-10 size-3.5 rounded-full border-2',
                onAccent
                  ? done
                    ? 'border-white bg-white'
                    : started
                      ? 'border-white bg-[var(--accent)]'
                      : 'border-white/50 bg-[var(--accent)]'
                  : done
                    ? 'border-accent bg-accent'
                    : started
                      ? 'border-accent bg-bg-deep'
                      : 'border-line bg-bg-deep',
              )}
            />
            <span className={cx('text-[11px]', onAccent ? 'text-white' : started ? 'text-text' : 'text-muted')}>
              {s.label} {stats.total ? `${s.n}/${stats.total}` : ''}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function PlanCard({ move, stats, onOpen }: { move: Move; stats: MoveStats; onOpen: () => void }) {
  const hot = move.isActive;
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="plan-card"
      className={cx('w-full rounded-3xl p-4 text-left active:scale-[0.99]', hot ? 'bg-accent text-white' : 'card')}
    >
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 text-lg leading-tight font-semibold">{move.name}</p>
        <span
          className={cx(
            'shrink-0 rounded-full px-3 py-1 text-xs font-semibold',
            hot ? 'bg-white/25 text-white' : 'bg-bg-deep text-muted',
          )}
        >
          {hot ? 'Active' : `${stats.total} ${stats.total === 1 ? 'box' : 'boxes'}`}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className={hot ? 'text-white/70' : 'text-muted'}>From</p>
          <p className="truncate">{move.fromAddress || '—'}</p>
        </div>
        <div>
          <p className={hot ? 'text-white/70' : 'text-muted'}>To</p>
          <p className="truncate">{move.toAddress || '—'}</p>
        </div>
      </div>
      {hot && (
        <p className="mt-3 text-sm text-white/85">
          {stats.total} {stats.total === 1 ? 'box' : 'boxes'}
          {stats.total > stats.delivered && stats.shipped > stats.delivered
            ? ` · ${stats.shipped - stats.delivered} on the way`
            : ''}
        </p>
      )}
      <PlanTrack stats={stats} onAccent={hot} />
    </button>
  );
}

export function PlansHomePage() {
  const navigate = useNavigate();
  const moves = useMoves();
  const stats = useMoveStats();
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const live = (moves ?? []).filter((m) => !m.archived).sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.createdAt - a.createdAt);
  const archived = (moves ?? []).filter((m) => m.archived);
  const open = async (m: Move) => {
    await setActiveMove(m.id);
    navigate('/boxes');
  };

  return (
    <>
      <section className="relative">
        <HeroTruck className="h-[19rem] w-full" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
          <span className="flex items-center gap-2 rounded-full bg-black/30 px-3 py-1.5 text-sm font-semibold backdrop-blur">
            <IconBoxes width={18} height={18} /> BoxTrack
          </span>
          <Link to="/settings" aria-label="Settings" className="grid size-11 place-items-center rounded-full bg-black/30 backdrop-blur">
            <IconSettings />
          </Link>
        </div>
        <div className="relative z-10 -mt-10 px-5">
          <h1 className="text-[2rem] leading-tight font-semibold">
            Smart moving,
            <br />
            made simple
          </h1>
          <p className="mt-1 text-sm text-muted">Know what is in every box. Works offline, stays on your phone.</p>
        </div>
      </section>

      <main className="px-4">
        {moves && live.length === 0 && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="card mt-6 flex min-h-16 w-full items-center gap-4 rounded-full p-2 pr-6 text-left active:scale-[0.99]"
          >
            <span className="grid size-12 place-items-center rounded-full bg-accent text-white">
              <IconBoxes />
            </span>
            <span className="flex-1 text-center font-semibold">Get started</span>
            <span className="text-muted" aria-hidden>
              ›››
            </span>
          </button>
        )}

        {live.length > 0 && (
          <>
            <SectionTitle
              action={
                <button type="button" className="min-h-11 px-2 font-semibold text-accent" onClick={() => setCreating(true)}>
                  + New plan
                </button>
              }
            >
              Your packing plans
            </SectionTitle>
            <ul className="flex flex-col gap-3">
              {live.map((m) => (
                <li key={m.id}>
                  <PlanCard move={m} stats={stats?.[m.id] ?? EMPTY} onOpen={() => void open(m)} />
                </li>
              ))}
            </ul>
          </>
        )}

        {archived.length > 0 && (
          <>
            <button type="button" onClick={() => setShowArchived(!showArchived)} className="mt-6 min-h-11 px-1 text-sm text-muted">
              {showArchived ? 'Hide' : 'Show'} archived plans ({archived.length})
            </button>
            {showArchived && (
              <ul className="mt-2 flex flex-col gap-3 opacity-70">
                {archived.map((m) => (
                  <li key={m.id}>
                    <PlanCard move={m} stats={stats?.[m.id] ?? EMPTY} onOpen={() => void open(m)} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>

      <Sheet open={creating} title="New packing plan" onClose={() => setCreating(false)}>
        <MoveForm
          submitLabel="Create plan"
          onSubmit={async (input) => {
            await createMove(input);
            setCreating(false);
            navigate('/boxes');
          }}
        />
      </Sheet>
    </>
  );
}
