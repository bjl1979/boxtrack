import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import {
  deleteAllData,
  exportAllData,
  restoreAllData,
  setSetting,
  useActiveMove,
  useSettings,
  type RestoreMode,
  type RestoreResult,
} from '../../db';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Sheet } from '../../components/Sheet';
import { Button, SectionTitle } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { formatBytes, getStorageInfo, type StorageInfo } from '../../lib/storage';
import { BackupError, backupFileName, buildBackupZip, readBackupZip, type ParsedBackup } from './backupZip';
import { buildInventoryPdf } from './inventoryPdf';
import { fileSlug, inventoryRows, toCsv, toXlsx } from './rows';
import { canShareFiles, downloadBlob, shareBlob } from './saveFile';

function Card({ children }: { children: ReactNode }) {
  return <div className="card flex flex-col gap-3 p-4">{children}</div>;
}

const fmtDate = (t: number | string) => new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function BackupSettings() {
  const navigate = useNavigate();
  const settings = useSettings();
  const move = useActiveMove();
  const toast = useToast(3000);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [restored, setRestored] = useState<RestoreResult | null>(null);
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const share = canShareFiles();

  useEffect(() => {
    getStorageInfo().then(setStorage);
  }, [restored, deleteStep]);

  async function run(label: string, job: () => Promise<void>) {
    setError(null);
    setBusy(label);
    try {
      await job();
    } catch (e) {
      setError(e instanceof BackupError ? e.message : 'Something went wrong. Please try again.');
      console.warn(e);
    } finally {
      setBusy(null);
    }
  }

  async function makeBackup(how: 'download' | 'share') {
    await run('backup', async () => {
      const blob = await buildBackupZip(await exportAllData());
      const name = backupFileName();
      if (how === 'share') {
        if (!(await shareBlob(blob, name, 'BoxTrack backup'))) return;
      } else downloadBlob(blob, name);
      await setSetting('lastBackupAt', Date.now());
      toast.show(how === 'share' ? 'Backup shared' : `Backup saved: ${name}`);
    });
  }

  async function exportPlan(kind: 'pdf' | 'xlsx' | 'csv') {
    if (!move) return;
    await run(kind, async () => {
      const all = await exportAllData();
      const boxes = all.boxes.filter((b) => b.moveId === move.id);
      const ids = new Set(boxes.map((b) => b.id));
      const items = all.items.filter((i) => ids.has(i.boxId));
      const base = `BoxTrack-${fileSlug(move.name)}`;
      if (kind === 'pdf') downloadBlob(await buildInventoryPdf(move, boxes, items), `${base}-inventory.pdf`);
      else {
        const rows = inventoryRows(move, boxes, items);
        if (kind === 'csv') downloadBlob(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }), `${base}.csv`);
        else downloadBlob(await toXlsx(rows, move.name), `${base}.xlsx`);
      }
      toast.show('Export saved to Downloads');
    });
  }

  async function restore(mode: RestoreMode) {
    if (!pending) return;
    const data = pending.data;
    setPending(null);
    setConfirmReplace(false);
    await run('restore', async () => setRestored(await restoreAllData(data, mode)));
  }

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Full backup</SectionTitle>
      <Card>
        <p className="text-sm text-muted">
          One .zip file with every plan, box, item and photo. Keep it somewhere other than this phone (Google Drive, email, a PC).
        </p>
        <p className="text-sm" data-testid="last-backup">
          Last backup: {settings?.lastBackupAt ? fmtDate(settings.lastBackupAt) : 'never'}
        </p>
        <Button variant="primary" disabled={!!busy} onClick={() => void makeBackup('download')}>
          {busy === 'backup' ? 'Preparing backup…' : 'Download backup (.zip)'}
        </Button>
        {share && (
          <Button disabled={!!busy} onClick={() => void makeBackup('share')}>
            Share backup (Drive, WhatsApp…)
          </Button>
        )}
      </Card>

      <SectionTitle>Restore</SectionTitle>
      <Card>
        <p className="text-sm text-muted">Bring back data from a BoxTrack backup file.</p>
        <Button disabled={!!busy} onClick={() => fileRef.current?.click()}>
          {busy === 'restore' ? 'Restoring…' : 'Choose backup file'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".zip,application/zip"
          hidden
          data-testid="restore-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void run('read', async () => setPending(await readBackupZip(f)));
          }}
        />
      </Card>

      {move && (
        <>
          <SectionTitle>Export “{move.name}”</SectionTitle>
          <Card>
            <p className="text-sm text-muted">For the movers or an insurance claim.</p>
            <Button disabled={!!busy} onClick={() => void exportPlan('pdf')}>
              {busy === 'pdf' ? 'Making PDF…' : 'Inventory PDF'}
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button disabled={!!busy} onClick={() => void exportPlan('xlsx')}>
                Excel
              </Button>
              <Button disabled={!!busy} onClick={() => void exportPlan('csv')}>
                CSV
              </Button>
            </div>
          </Card>
        </>
      )}

      {error && (
        <p role="alert" className="rounded-2xl bg-danger/15 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <SectionTitle>Storage on this phone</SectionTitle>
      <Card>
        {storage ? (
          <>
            <p className="text-2xl font-semibold">{formatBytes(storage.usage)}</p>
            <p className="text-sm text-muted">used of about {formatBytes(storage.quota)} available</p>
            <div className="inset h-2 overflow-hidden">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (storage.usage / Math.max(storage.quota, 1)) * 100)}%` }} />
            </div>
            <p className="text-sm">
              {storage.persisted
                ? '✓ Protected – the browser will not clear this data on its own.'
                : '⚠ Not yet protected. Install BoxTrack to the home screen to improve this, and keep backups.'}
            </p>
          </>
        ) : (
          <p className="text-muted">Storage information is not available in this browser.</p>
        )}
      </Card>

      <SectionTitle>Danger zone</SectionTitle>
      <Button variant="danger" onClick={() => setDeleteStep(1)}>
        Delete all data
      </Button>

      <Sheet open={!!pending} title="Restore backup" onClose={() => setPending(null)}>
        {pending && (
          <div className="flex flex-col gap-3" data-testid="restore-summary">
            <p className="text-sm text-muted">Backup from {fmtDate(pending.exportedAt)}:</p>
            <p>
              {pending.data.moves.length} plans · {pending.data.boxes.length} boxes · {pending.data.items.length} items ·{' '}
              {pending.data.photos.length} photos
            </p>
            <Button variant="primary" onClick={() => void restore('merge')}>
              Merge into my data
            </Button>
            <p className="-mt-1 text-xs text-muted">Keeps everything on this phone and adds what is missing.</p>
            <Button variant="danger" onClick={() => setConfirmReplace(true)}>
              Replace all my data
            </Button>
            <p className="-mt-1 text-xs text-muted">Deletes what is on this phone now and puts the backup in its place.</p>
          </div>
        )}
      </Sheet>
      <ConfirmDialog
        open={confirmReplace}
        danger
        title="Replace all data with this backup?"
        body="Everything currently on this phone will be deleted first."
        confirmLabel="Replace"
        onCancel={() => setConfirmReplace(false)}
        onConfirm={() => void restore('replace')}
      />
      <Sheet open={!!restored} title="Backup restored" onClose={() => setRestored(null)}>
        {restored && (
          <div className="flex flex-col gap-3" data-testid="restore-result">
            <p>
              Restored {restored.moves} plans, {restored.boxes} boxes, {restored.items} items and {restored.photos} photos.
            </p>
            {restored.skippedBoxes > 0 && (
              <p className="text-sm text-danger">
                {restored.skippedBoxes} {restored.skippedBoxes === 1 ? 'box was' : 'boxes were'} skipped because that box number is already used
                on this phone.
              </p>
            )}
            <Button
              variant="primary"
              onClick={() => {
                setRestored(null);
                navigate('/');
              }}
            >
              Done
            </Button>
          </div>
        )}
      </Sheet>
      <ConfirmDialog
        open={deleteStep === 1}
        danger
        title="Delete all data?"
        body="Every plan, box, item and photo on this phone will be deleted."
        confirmLabel="Continue"
        onCancel={() => setDeleteStep(0)}
        onConfirm={() => setDeleteStep(2)}
      />
      <ConfirmDialog
        open={deleteStep === 2}
        danger
        title="Are you absolutely sure?"
        body={settings?.lastBackupAt ? `Your last backup is from ${fmtDate(settings.lastBackupAt)}. This cannot be undone.` : 'You have no backup. This cannot be undone.'}
        confirmLabel="Delete everything"
        onCancel={() => setDeleteStep(0)}
        onConfirm={async () => {
          setDeleteStep(0);
          await deleteAllData();
          navigate('/');
        }}
      />
      {toast.node}
    </div>
  );
}
