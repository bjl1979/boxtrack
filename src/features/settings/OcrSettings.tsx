import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { countPendingOcr, requeueOcrForAllPhotos, setSetting, type AppSettings } from '../../db';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Button, cx } from '../../components/ui';
import { getOcrQueue } from '../ocr/ocrQueue';
import { useOcrCurrent } from '../ocr/useOcrActivity';

export function OcrSettings({ settings }: { settings: AppSettings }) {
  const pending = useLiveQuery(() => countPendingOcr(), []) ?? 0;
  const current = useOcrCurrent();
  const [confirm, setConfirm] = useState(false);
  const on = settings.ocrEnabled;

  return (
    <div className="flex flex-col gap-3">
      <div className="card flex items-center gap-4 p-4">
        <div className="flex-1">
          <p className="font-semibold">Read text from photos</p>
          <p className="text-sm text-muted">Labels and writing in contents photos become searchable. Runs on the phone, offline.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Read text from photos"
          onClick={async () => {
            await setSetting('ocrEnabled', !on);
            if (!on) void getOcrQueue()?.kick();
          }}
          className={cx('relative h-8 w-14 shrink-0 rounded-full transition', on ? 'bg-accent' : 'bg-bg-deep')}
        >
          <span className={cx('absolute top-1 size-6 rounded-full bg-white transition-all', on ? 'left-7' : 'left-1')} />
        </button>
      </div>

      <div className="card flex items-center justify-between p-4">
        <span>Language</span>
        <span className="text-muted">English</span>
      </div>

      <div className="card p-4" role="status" data-testid="ocr-status">
        {pending === 0 ? (
          <p className="text-sm text-muted">All photos are read.</p>
        ) : on ? (
          <p className="text-sm">
            {current ? 'Reading text…' : 'Starting…'} {pending} {pending === 1 ? 'photo' : 'photos'} left.
          </p>
        ) : (
          <p className="text-sm">
            {pending} {pending === 1 ? 'photo is' : 'photos are'} waiting. Switch text reading on to read them.
          </p>
        )}
      </div>

      <Button disabled={!on} onClick={() => setConfirm(true)}>
        Read all photos again
      </Button>
      <p className="px-1 text-xs text-muted">
        Re-reading replaces text you have corrected by hand. It runs in the background; large collections take a while.
      </p>

      <ConfirmDialog
        open={confirm}
        title="Read all contents photos again?"
        body="Text you corrected by hand will be replaced."
        confirmLabel="Read again"
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setConfirm(false);
          await requeueOcrForAllPhotos();
          void getOcrQueue()?.kick();
        }}
      />
    </div>
  );
}
