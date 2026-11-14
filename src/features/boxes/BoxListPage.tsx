import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { BOX_STATUSES, setBoxStatus, useBoxes, useItemCounts, useSettings, type BoxStatus, type Move } from '../../db';
import { useToast } from '../../components/Toast';
import { PageHeader } from '../../components/AppShell';
import { StatusRing } from '../../components/StatusRing';
import { Chip, EmptyState, Segmented, SectionTitle, cx } from '../../components/ui';
import { IconFilter, IconFlag, IconPrinter, IconQr, IconTag, IconX } from '../../components/Icons';
import { useSessionState } from '../../lib/usePersistentState';
import { BoxRow } from './BoxRow';
import { SearchBar } from '../search/SearchBar';
import { BackupReminder } from '../export/BackupReminder';
import { FilterSheet } from './FilterSheet';
import {
  EMPTY_FILTERS,
  activeFilterCount,
  filterBoxes,
  sortBoxes,
  summarise,
  type BoxFilters,
  type SortKey,
} from './filters';
import { STATUS_META } from './statusMeta';

function ActionTile({
  label,
  icon,
  badge,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card relative flex min-h-20 flex-1 flex-col items-center justify-center gap-1.5 text-xs text-muted active:scale-95"
    >
      <span className="text-text">{icon}</span>
      {label}
      {!!badge && (
        <span className="absolute top-2 right-2 grid size-5 place-items-center rounded-full bg-accent text-[11px] font-bold text-on-accent">
          {badge}
        </span>
      )}
    </button>
  );
}

function Stat({ label, value, color, onClick }: { label: string; value: number; color: string; onClick?: () => void }) {
  const inner = (
    <>
      <span className="text-xl font-semibold tabular-nums" style={{ color }}>
        {value}
      </span>
      <span className="text-[11px] text-muted">{label}</span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 flex-col items-center"
      aria-label={`${value} ${label}, show them`}
    >
      {inner}
    </button>
  ) : (
    <div className="flex flex-col items-center">{inner}</div>
  );
}

export function BoxListPage({ move }: { move: Move }) {
  const boxes = useBoxes(move.id);
  const itemCounts = useItemCounts(move.id) ?? {};
  const settings = useSettings();
  const [sort, setSort] = useSessionState<SortKey>('bt.sort', 'number');
  const [filters, setFilters] = useSessionState<BoxFilters>(`bt.filters.${move.id}`, EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string> | null>(null); // null = not selecting
  const toast = useToast(2500);

  const summary = useMemo(() => summarise(boxes ?? []), [boxes]);
  const visible = useMemo(() => sortBoxes(filterBoxes(boxes ?? [], filters), sort), [boxes, filters, sort]);
  const nFilters = activeFilterCount(filters);

  const toggleStatus = (s: BoxStatus) =>
    setFilters({
      ...filters,
      statuses: filters.statuses.includes(s) ? filters.statuses.filter((x) => x !== s) : [...filters.statuses, s],
    });

  return (
    <>
      <PageHeader
        title={move.name}
        subtitle="Packing plan"
        back="/"
        right={
          <Link to="/scan" aria-label="Scan label" className="card grid size-12 place-items-center">
            <IconQr />
          </Link>
        }
      />
      <main className={cx('px-4', selected && 'pb-40')}>
        <div className="mb-3">
          <SearchBar />
          <BackupReminder />
        </div>
        {!!boxes?.length && (
          <>
            <Segmented
              label="Sort boxes"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'number', label: 'By number' },
                { value: 'updated', label: 'Last updated' },
              ]}
            />

            <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 py-1" aria-label="Filter by status">
              {BOX_STATUSES.map((s) => (
                <Chip
                  key={s}
                  dot={STATUS_META[s].color}
                  selected={filters.statuses.includes(s)}
                  onClick={() => toggleStatus(s)}
                >
                  {STATUS_META[s].label}: {summary.byStatus[s]}
                </Chip>
              ))}
            </div>

            <section aria-label="Summary" className="mt-4">
              <StatusRing
                byStatus={summary.byStatus}
                total={summary.total}
                caption={summary.total ? `${summary.packed} packed` : 'Tap + to add a box'}
              />
              <div className="card mt-3 grid grid-cols-4 py-3">
                <Stat label="Packed" value={summary.packed} color={STATUS_META.packed.color} />
                <Stat label="Delivered" value={summary.delivered} color={STATUS_META.delivered.color} />
                <Stat label="Unpacked" value={summary.unpacked} color={STATUS_META.unpacked.color} />
                <Stat
                  label="Missing"
                  value={summary.missing}
                  color="var(--c-missing)"
                  onClick={summary.missing ? () => setFilters({ ...EMPTY_FILTERS, statuses: ['shipped'] }) : undefined}
                />
              </div>
              <Link
                to="/moving-day"
                className="mt-3 flex min-h-14 items-center gap-3 rounded-2xl bg-accent px-4 font-semibold text-on-accent active:scale-[0.99]"
              >
                <span className="text-xl" aria-hidden>
                  🚚
                </span>
                <span className="flex-1">Moving day: delivery check &amp; unpacking</span>
                <span aria-hidden>›</span>
              </Link>
            </section>

            <div className="mt-4 flex gap-3">
              <ActionTile
                label="Room"
                icon={<IconFilter />}
                badge={filters.rooms.length}
                onClick={() => setSheetOpen(true)}
              />
              <ActionTile
                label="Category"
                icon={<IconTag />}
                badge={filters.categories.length}
                onClick={() => setSheetOpen(true)}
              />
              <ActionTile
                label="Flags"
                icon={<IconFlag />}
                badge={filters.flags.length}
                onClick={() => setSheetOpen(true)}
              />
              <ActionTile label="Clear" icon={<IconX />} onClick={() => setFilters(EMPTY_FILTERS)} />
            </div>
          </>
        )}

        <SectionTitle
          action={
            <span className="flex items-center gap-3">
              {nFilters > 0 && boxes && (
                <span className="text-xs text-muted">
                  {visible.length} of {boxes.length}
                </span>
              )}
              <Link to="/labels" className="flex min-h-11 items-center gap-1.5 px-1 text-sm font-semibold text-accent">
                <IconPrinter width={18} height={18} /> Print labels
              </Link>
              {!!boxes?.length && (
                <button
                  type="button"
                  className="min-h-11 px-1 text-sm font-semibold text-accent"
                  onClick={() => setSelected(selected ? null : new Set())}
                >
                  {selected ? 'Cancel' : 'Select'}
                </button>
              )}
            </span>
          }
        >
          Boxes
        </SectionTitle>

        {boxes === undefined ? null : boxes.length === 0 ? (
          <EmptyState
            title="No boxes yet"
            body="Stick a numbered label on your first box, then tap the orange + button."
            action={
              <Link to="/boxes/new" className="mt-2 rounded-2xl bg-accent px-5 py-3 font-semibold text-on-accent">
                Add box 1
              </Link>
            }
          />
        ) : visible.length === 0 ? (
          <p className="card px-4 py-8 text-center text-muted">No boxes match these filters.</p>
        ) : (
          <ul className={cx('flex flex-col gap-3')}>
            {visible.map((b) => (
              <li key={b.id}>
                <BoxRow
                  box={b}
                  itemCount={itemCounts[b.id] ?? 0}
                  selection={
                    selected
                      ? {
                          selected: selected.has(b.id),
                          onToggle: () =>
                            setSelected((s) => {
                              const n = new Set(s);
                              if (n.has(b.id)) n.delete(b.id);
                              else n.add(b.id);
                              return n;
                            }),
                        }
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      {selected && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-3xl bg-surface px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[0_-12px_30px_-10px_rgb(0_0_0/0.7)]"
          role="region"
          aria-label="Change status of selected boxes"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold" data-testid="selected-count">
              {selected.size} selected
            </span>
            <button
              type="button"
              className="min-h-11 px-2 text-sm font-semibold text-accent"
              onClick={() =>
                setSelected(selected.size === visible.length ? new Set() : new Set(visible.map((b) => b.id)))
              }
            >
              {selected.size === visible.length && visible.length ? 'Select none' : `Select all (${visible.length})`}
            </button>
          </div>
          <p className="mt-1 text-xs text-muted">Set status to:</p>
          <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 py-1">
            {BOX_STATUSES.map((s) => (
              <Chip
                key={s}
                dot={STATUS_META[s].color}
                disabled={!selected.size}
                className="disabled:opacity-40"
                onClick={async () => {
                  const n = selected.size;
                  await setBoxStatus([...selected], s);
                  setSelected(null);
                  toast.show(`${n} ${n === 1 ? 'box' : 'boxes'} → ${STATUS_META[s].label}`);
                }}
              >
                {STATUS_META[s].label}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {toast.node}

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        onChange={setFilters}
        rooms={settings?.rooms ?? []}
        categories={settings?.categories ?? []}
      />
    </>
  );
}
