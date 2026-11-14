import { useState } from 'react';
import { Link } from 'react-router';
import { useSettings, useTotalBoxCount } from '../../db';

const WEEK = 7 * 24 * 60 * 60 * 1000;
let dismissedThisSession = false;

/** Shown when there are more than 10 boxes and no backup from the last 7 days. */
export function BackupReminder() {
  const settings = useSettings();
  const boxes = useTotalBoxCount() ?? 0;
  const [hidden, setHidden] = useState(dismissedThisSession);
  if (!settings || hidden || boxes <= 10) return null;
  const last = settings.lastBackupAt;
  if (last && Date.now() - last < WEEK) return null;
  const days = last ? Math.floor((Date.now() - last) / (24 * 60 * 60 * 1000)) : null;
  return (
    <div role="alert" className="card mt-4 flex items-start gap-3 p-4 ring-1 ring-[var(--c-missing)]/60" data-testid="backup-reminder">
      <span className="text-2xl" aria-hidden>
        💾
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Back up your boxes</p>
        <p className="text-sm text-muted">
          {days === null ? 'You have never made a backup.' : `Your last backup was ${days} days ago.`} Everything is stored only on this
          phone.
        </p>
        <div className="mt-2 flex gap-4">
          <Link to="/settings?tab=backup" className="min-h-11 content-center font-semibold text-accent">
            Back up now
          </Link>
          <button
            type="button"
            className="min-h-11 text-sm text-muted"
            onClick={() => {
              dismissedThisSession = true;
              setHidden(true);
            }}
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
