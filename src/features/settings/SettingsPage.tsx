import { useEffect, useState } from 'react';
import {
  archiveMove,
  createMove,
  setActiveMove,
  setCategories,
  setRooms,
  unarchiveMove,
  updateMove,
  useMoves,
  useSettings,
  type Move,
} from '../../db';
import { PageHeader } from '../../components/AppShell';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Sheet } from '../../components/Sheet';
import { Button, SectionTitle, Segmented } from '../../components/ui';
import { formatBytes, getStorageInfo, type StorageInfo } from '../../lib/storage';
import { MoveForm } from '../moves/MoveForm';
import { ListEditor } from './ListEditor';

function MoveCard({ move, onRename, onArchive }: { move: Move; onRename: () => void; onArchive: () => void }) {
  return (
    <li className="card p-4" data-testid="move-card">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{move.name}</p>
          {(move.fromAddress || move.toAddress) && (
            <p className="truncate text-sm text-muted">{[move.fromAddress, move.toAddress].filter(Boolean).join(' → ')}</p>
          )}
        </div>
        {move.isActive && <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent">Active</span>}
        {move.archived && <span className="rounded-full bg-bg-deep px-3 py-1 text-xs text-muted">Archived</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {!move.isActive && (
          <Button className="min-h-11 px-4 text-sm" onClick={() => void setActiveMove(move.id)}>
            Switch to
          </Button>
        )}
        <Button className="min-h-11 px-4 text-sm" onClick={onRename}>
          Rename
        </Button>
        {move.archived ? (
          <Button className="min-h-11 px-4 text-sm" onClick={() => void unarchiveMove(move.id)}>
            Restore
          </Button>
        ) : (
          <Button className="min-h-11 px-4 text-sm" onClick={onArchive}>
            Archive
          </Button>
        )}
      </div>
    </li>
  );
}

export function SettingsPage() {
  const moves = useMoves();
  const settings = useSettings();
  const [tab, setTab] = useState<'moves' | 'lists' | 'storage'>('moves');
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Move | null>(null);
  const [archiving, setArchiving] = useState<Move | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);

  useEffect(() => {
    if (tab === 'storage') getStorageInfo().then(setStorage);
  }, [tab]);

  return (
    <>
      <PageHeader title="Settings" />
      <main className="px-4">
        <Segmented
          label="Settings section"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'moves', label: 'Plans' },
            { value: 'lists', label: 'Rooms & tags' },
            { value: 'storage', label: 'Storage' },
          ]}
        />

        {tab === 'moves' && (
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
              {moves?.map((m) => (
                <MoveCard key={m.id} move={m} onRename={() => setRenaming(m)} onArchive={() => setArchiving(m)} />
              ))}
            </ul>
          </>
        )}

        {tab === 'lists' && settings && (
          <>
            <SectionTitle>Rooms</SectionTitle>
            <ListEditor label="Rooms" values={settings.rooms} onChange={(v) => void setRooms(v)} />
            <SectionTitle>Categories</SectionTitle>
            <ListEditor label="Categories" values={settings.categories} onChange={(v) => void setCategories(v)} />
          </>
        )}

        {tab === 'storage' && (
          <>
            <SectionTitle>On this phone</SectionTitle>
            <div className="card p-4">
              {storage ? (
                <>
                  <p className="text-2xl font-semibold">{formatBytes(storage.usage)}</p>
                  <p className="text-sm text-muted">used of about {formatBytes(storage.quota)} available</p>
                  <div className="inset mt-3 h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.min(100, (storage.usage / Math.max(storage.quota, 1)) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-3 text-sm">
                    {storage.persisted
                      ? '✓ Storage is protected – the browser will not clear it automatically.'
                      : '⚠ Storage is not yet protected. Install BoxTrack to the home screen to improve this.'}
                  </p>
                </>
              ) : (
                <p className="text-muted">Storage information is not available in this browser.</p>
              )}
            </div>
            <p className="mt-4 px-1 text-sm text-muted">
              All data stays on this phone. Backup and restore arrive in a later update.
            </p>
          </>
        )}
      </main>

      <Sheet open={creating} title="New packing plan" onClose={() => setCreating(false)}>
        <MoveForm
          submitLabel="Create plan"
          onSubmit={async (input) => {
            await createMove(input);
            setCreating(false);
          }}
        />
      </Sheet>
      <Sheet open={!!renaming} title="Edit plan" onClose={() => setRenaming(null)}>
        {renaming && (
          <MoveForm
            initial={renaming}
            submitLabel="Save"
            onSubmit={async (input) => {
              await updateMove(renaming.id, input);
              setRenaming(null);
            }}
          />
        )}
      </Sheet>
      <ConfirmDialog
        open={!!archiving}
        title={`Archive "${archiving?.name}"?`}
        body="Its boxes are kept and you can restore the plan at any time."
        confirmLabel="Archive"
        onCancel={() => setArchiving(null)}
        onConfirm={async () => {
          if (archiving) await archiveMove(archiving.id);
          setArchiving(null);
        }}
      />
    </>
  );
}
