import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { BOX_STATUSES, useBoxes, useItemCounts, useSettings, type BoxStatus, type Move } from '../../db';
import { PageHeader } from '../../components/AppShell';
import { StatusRing } from '../../components/StatusRing';
import { Chip, EmptyState, Segmented, SectionTitle, cx } from '../../components/ui';
import { IconFilter, IconFlag, IconSettings, IconTag, IconX } from '../../components/Icons';
import { useSessionState } from '../../lib/usePersistentState';
import { BoxRow } from './BoxRow';
import { FilterSheet } from './FilterSheet';
import { EMPTY_FILTERS, activeFilterCount, filterBoxes, sortBoxes, summarise, type BoxFilters, type SortKey } from './filters';
import { STATUS_META } from './statusMeta';

function ActionTile({ label, icon, badge, onClick }: { label: string; icon: ReactNode; badge?: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="card relative flex min-h-20 flex-1 flex-col items-center justify-center gap-1.5 text-xs text-muted active:scale-95">
      <span className="text-text">{icon}</span>
      {label}
      {!!badge && (
        <span className="absolute top-2 right-2 grid size-5 place-items-center rounded-full bg-accent text-[11px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xl font-semibold tabular-nums" style={{ color }}>
        {value}
      </span>
      <span className="text-[11px] text-muted">{label}</span>
    </div>
  );
}

export function BoxListPage({ move }: { move: Move }) {
  const boxes = useBoxes(move.id);
  const itemCounts = useItemCounts(move.id) ?? {};
  const settings = useSettings();
  const [sort, setSort] = useSessionState<SortKey>('bt.sort', 'number');
  const [filters, setFilters] = useSessionState<BoxFilters>(`bt.filters.${move.id}`, EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

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
        subtitle="BoxTrack"
        right={
          <Link to="/settings" aria-label="Settings" className="card grid size-12 place-items-center">
            <IconSettings />
          </Link>
        }
      />
      <main className="px-4">
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
            <Chip key={s} dot={STATUS_META[s].color} selected={filters.statuses.includes(s)} onClick={() => toggleStatus(s)}>
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
            <Stat label="Missing" value={summary.missing} color="var(--c-missing)" />
          </div>
        </section>

        <div className="mt-4 flex gap-3">
          <ActionTile label="Room" icon={<IconFilter />} badge={filters.rooms.length} onClick={() => setSheetOpen(true)} />
          <ActionTile label="Category" icon={<IconTag />} badge={filters.categories.length} onClick={() => setSheetOpen(true)} />
          <ActionTile label="Flags" icon={<IconFlag />} badge={filters.flags.length} onClick={() => setSheetOpen(true)} />
          <ActionTile label="Clear" icon={<IconX />} onClick={() => setFilters(EMPTY_FILTERS)} />
        </div>

        <SectionTitle
          action={
            nFilters > 0 && boxes ? (
              <span className="text-xs text-muted">
                {visible.length} of {boxes.length}
              </span>
            ) : undefined
          }
        >
          Boxes
        </SectionTitle>

        {boxes === undefined ? null : boxes.length === 0 ? (
          <EmptyState
            title="No boxes yet"
            body="Stick a numbered label on your first box, then tap the orange + button."
            action={
              <Link to="/boxes/new" className="mt-2 rounded-2xl bg-accent px-5 py-3 font-semibold text-white">
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
                <BoxRow box={b} itemCount={itemCounts[b.id] ?? 0} />
              </li>
            ))}
          </ul>
        )}
      </main>

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
