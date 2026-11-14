import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  archiveMove,
  createMove,
  deleteMove,
  setActiveMove,
  setCategories,
  setRooms,
  setSetting,
  unarchiveMove,
  updateMove,
  useMoveStats,
  useMoves,
  useSettings,
  type Move,
} from '../../db';
import { PageHeader } from '../../components/AppShell';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Sheet } from '../../components/Sheet';
import { Button, SectionTitle, Segmented } from '../../components/ui';
import { MoveForm } from '../moves/MoveForm';
import { ListEditor } from './ListEditor';
import { AboutSettings } from './AboutSettings';
import { OcrSettings } from './OcrSettings';
import { BackupSettings } from '../export/BackupSettings';
import { useSearchParams } from 'react-router';

function MoveCard({
  move,
  onRename,
  onArchive,
  onDelete,
}: {
  move: Move;
  onRename: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
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
        <Button variant="danger" className="min-h-11 px-4 text-sm" onClick={onDelete} aria-label={`Delete plan ${move.name}`}>
          Delete
        </Button>
      </div>
    </li>
  );
}

export function SettingsPage() {
  const moves = useMoves();
  const settings = useSettings();
  const [params, setParams] = useSearchParams();
  type Tab = 'moves' | 'lists' | 'ocr' | 'backup';
  const tab = (params.get('tab') as Tab | null) ?? 'moves';
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true });
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Move | null>(null);
  const [archiving, setArchiving] = useState<Move | null>(null);
  const [deleting, setDeleting] = useState<{ move: Move; step: 1 | 2 } | null>(null);
  const stats = useMoveStats();
  const navigate = useNavigate();
  const deletingBoxes = deleting ? (stats?.[deleting.move.id]?.total ?? 0) : 0;

  return (
    <>
      <PageHeader title="Settings" />
      <main className="px-4 pb-28">
        <Segmented
          label="Settings section"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'moves', label: 'Plans' },
            { value: 'lists', label: 'General' },
            { value: 'ocr', label: 'Photo text' },
            { value: 'backup', label: 'Backup' },
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
                <MoveCard
                  key={m.id}
                  move={m}
                  onRename={() => setRenaming(m)}
                  onArchive={() => setArchiving(m)}
                  onDelete={() => setDeleting({ move: m, step: 1 })}
                />
              ))}
            </ul>
          </>
        )}

        {tab === 'lists' && settings && (
          <>
            <SectionTitle>Appearance</SectionTitle>
            <Segmented
              label="Theme"
              value={settings.theme}
              onChange={(t) => void setSetting('theme', t)}
              options={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
            <SectionTitle>Rooms</SectionTitle>
            <ListEditor label="Rooms" values={settings.rooms} onChange={(v) => void setRooms(v)} />
            <SectionTitle>Categories</SectionTitle>
            <ListEditor label="Categories" values={settings.categories} onChange={(v) => void setCategories(v)} />
            <SectionTitle>About &amp; updates</SectionTitle>
            <AboutSettings />
          </>
        )}

        {tab === 'ocr' && settings && (
          <>
            <SectionTitle>Photo text (OCR)</SectionTitle>
            <OcrSettings settings={settings} />
          </>
        )}

        {tab === 'backup' && <BackupSettings />}
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
      <ConfirmDialog
        open={deleting?.step === 1}
        danger
        title={`Delete "${deleting?.move.name}"?`}
        body={`Its ${deletingBoxes} ${deletingBoxes === 1 ? 'box' : 'boxes'} with all items and photos will be deleted from this phone. If you might need them later, cancel and make a backup first (Settings → Backup), or use Archive instead.`}
        confirmLabel="Continue"
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && setDeleting({ ...deleting, step: 2 })}
      />
      <ConfirmDialog
        open={deleting?.step === 2}
        danger
        title="Are you absolutely sure?"
        body={`“${deleting?.move.name}” cannot be brought back unless you have a backup.`}
        confirmLabel="Delete plan"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          const d = deleting;
          setDeleting(null);
          if (!d) return;
          await deleteMove(d.move.id);
          if (!moves?.some((m) => m.id !== d.move.id)) navigate('/');
        }}
      />
    </>
  );
}
