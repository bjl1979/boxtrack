import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { BOX_STATUSES, deleteBox, deletePhoto, setBoxStatus, setPhotoKind, useBox, useItems, usePhotos, type Photo } from '../../db';
import { PageHeader } from '../../components/AppShell';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { IconEdit, IconTrash } from '../../components/Icons';
import { Button, Chip, EmptyState, Segmented } from '../../components/ui';
import { ItemsPanel } from '../items/ItemsPanel';
import { PhotosPanel } from '../photos/PhotosPanel';
import { PhotoViewer } from '../photos/PhotoViewer';
import { FlagIcons, roomsText } from './BoxRow';
import { STATUS_META } from './statusMeta';
import { StatusTrack } from '../../components/StatusTrack';

type Tab = 'items' | 'photos' | 'details';

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
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const box = useBox(id);
  const items = useItems(id);
  const photos = usePhotos(id);
  const [confirm, setConfirm] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState<Photo | null>(null);

  // Tab and open photo live in the URL, so the Android back button closes the viewer first.
  const tab = (params.get('tab') as Tab | null) ?? (params.get('photo') ? 'photos' : 'items');
  const openPhotoId = params.get('photo');
  const highlightId = params.get('highlight') ?? undefined;
  const viewerIndex = photos && openPhotoId ? photos.findIndex((p) => p.id === openPhotoId) : -1;

  const setTab = (t: Tab) =>
    setParams(
      (p) => {
        p.set('tab', t);
        return p;
      },
      { replace: true },
    );
  const openPhoto = (photoId: string) =>
    setParams((p) => {
      p.set('tab', 'photos');
      p.set('photo', photoId);
      return p;
    });
  const showPhoto = (photoId: string) =>
    setParams(
      (p) => {
        p.set('photo', photoId);
        return p;
      },
      { replace: true },
    );
  const closeViewer = () => {
    if (location.key !== 'default') navigate(-1);
    else
      setParams(
        (p) => {
          p.delete('photo');
          return p;
        },
        { replace: true },
      );
  };

  if (box === undefined) return <PageHeader title="Box" back="/boxes" />;
  if (box === null)
    return (
      <>
        <PageHeader title="Box" back="/boxes" />
        <main className="px-4">
          <EmptyState title="Box not found" body="It may have been deleted." />
        </main>
      </>
    );

  return (
    <>
      <PageHeader
        title={`Box ${box.number}`}
        back="/boxes"
        right={
          <Link to={`/boxes/${box.id}/edit`} aria-label="Edit box" className="card grid size-12 place-items-center">
            <IconEdit />
          </Link>
        }
      />
      <main className="px-4 pb-10">
        <div className="relative overflow-hidden rounded-3xl hero-card p-5 text-white shadow-xl">
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
          <StatusTrack status={box.status} onDark />
        </div>

        <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 py-1" role="group" aria-label="Status">
          {BOX_STATUSES.map((s) => (
            <Chip key={s} dot={STATUS_META[s].color} selected={box.status === s} onClick={() => void setBoxStatus([box.id], s)}>
              {STATUS_META[s].label}
            </Chip>
          ))}
        </div>

        <div className="mt-4 mb-4">
          <Segmented
            label="Box sections"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'items', label: `Items${items?.length ? ` (${items.length})` : ''}` },
              { value: 'photos', label: `Photos${photos?.length ? ` (${photos.length})` : ''}` },
              { value: 'details', label: 'Details' },
            ]}
          />
        </div>

        {tab === 'items' && <ItemsPanel box={box} />}
        {tab === 'photos' && photos && <PhotosPanel box={box} photos={photos} highlightId={highlightId} onOpen={openPhoto} />}
        {tab === 'details' && (
          <>
            <dl className="card px-4">
              <Row label="Notes" value={box.notes} />
              <Row label="Created" value={fmt(box.createdAt)} />
              <Row label="Updated" value={fmt(box.updatedAt)} />
            </dl>
            <Button variant="danger" className="mt-8 w-full" onClick={() => setConfirm(true)}>
              <IconTrash /> Delete box
            </Button>
          </>
        )}
      </main>

      {photos && viewerIndex >= 0 && (
        <PhotoViewer
          photos={photos}
          index={viewerIndex}
          onIndex={(i) => showPhoto(photos[i].id)}
          onClose={closeViewer}
          onKind={(p, k) => void setPhotoKind(p.id, k)}
          onDelete={(p) => setDeletingPhoto(p)}
        />
      )}

      <ConfirmDialog
        open={!!deletingPhoto}
        danger
        title="Delete this photo?"
        confirmLabel="Delete"
        onCancel={() => setDeletingPhoto(null)}
        onConfirm={async () => {
          const p = deletingPhoto;
          setDeletingPhoto(null);
          if (!p || !photos) return;
          const rest = photos.filter((x) => x.id !== p.id);
          await deletePhoto(p.id);
          if (rest.length) showPhoto(rest[Math.min(viewerIndex, rest.length - 1)].id);
          else closeViewer();
        }}
      />
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
          navigate('/boxes', { replace: true });
        }}
      />
    </>
  );
}
