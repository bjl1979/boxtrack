import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { BOX_STATUSES, deleteBox, setBoxStatus, useBox, useItemCounts } from '../../db';
import { PageHeader } from '../../components/AppShell';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { IconEdit, IconTrash } from '../../components/Icons';
import { Button, Chip, EmptyState, SectionTitle } from '../../components/ui';
import { FlagIcons, roomsText } from './BoxRow';
import { STATUS_META } from './statusMeta';

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 border-b border-line/40 py-3 last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

const fmt = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function BoxDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const box = useBox(id);
  const counts = useItemCounts(box?.moveId);
  const [confirm, setConfirm] = useState(false);

  if (box === undefined) return <PageHeader title="Box" back="/" />;
  if (box === null)
    return (
      <>
        <PageHeader title="Box" back="/" />
        <main className="px-4">
          <EmptyState title="Box not found" body="It may have been deleted." />
        </main>
      </>
    );

  const items = counts?.[box.id] ?? 0;
  return (
    <>
      <PageHeader
        title={`Box ${box.number}`}
        back="/"
        right={
          <Link to={`/boxes/${box.id}/edit`} aria-label="Edit box" className="card grid size-12 place-items-center">
            <IconEdit />
          </Link>
        }
      />
      <main className="px-4 pb-10">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#3b2a5c] via-[#7a2e6b] to-[var(--accent)] p-5 text-white shadow-xl">
          <div className="absolute -top-10 -right-10 size-40 rounded-full bg-white/10" aria-hidden />
          <p className="text-xs font-semibold tracking-[0.2em] text-white/70">BOX</p>
          <p className="text-7xl leading-none font-bold tabular-nums" data-testid="box-number">
            {box.number}
          </p>
          <p className="mt-3 text-xl font-semibold">{box.label ?? 'No label'}</p>
          <p className="text-white/80">{roomsText(box) || 'No room set'}</p>
          <div className="mt-4 flex items-end justify-between">
            <div className="text-sm text-white/80">
              {[box.category, box.size && `Size ${box.size}`, box.weightKg !== undefined && `${box.weightKg} kg`]
                .filter(Boolean)
                .join(' · ')}
            </div>
            <FlagIcons box={box} className="flex gap-1 text-xl" />
          </div>
        </div>

        <SectionTitle>Status</SectionTitle>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
          {BOX_STATUSES.map((s) => (
            <Chip
              key={s}
              dot={STATUS_META[s].color}
              selected={box.status === s}
              onClick={() => void setBoxStatus([box.id], s)}
            >
              {STATUS_META[s].label}
            </Chip>
          ))}
        </div>

        <SectionTitle>Details</SectionTitle>
        <dl className="card px-4">
          <Row label="Items" value={String(items)} />
          <Row label="Notes" value={box.notes} />
          <Row label="Created" value={fmt(box.createdAt)} />
          <Row label="Updated" value={fmt(box.updatedAt)} />
        </dl>

        <Button variant="danger" className="mt-8 w-full" onClick={() => setConfirm(true)}>
          <IconTrash /> Delete box
        </Button>
      </main>

      <ConfirmDialog
        open={confirm}
        danger
        title={`Delete box ${box.number}?`}
        body="Its items and photos will be deleted too. This cannot be undone."
        confirmLabel="Delete"
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setConfirm(false);
          await deleteBox(box.id);
          navigate('/', { replace: true });
        }}
      />
    </>
  );
}
