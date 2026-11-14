import { useEffect, useSyncExternalStore } from 'react';
import { pwaUpdate } from '../lib/pwaUpdate';
import { Button } from './ui';

/** Toast shown when the app is ready offline, or when a new version is waiting. */
export function UpdatePrompt() {
  const { needRefresh, offlineReady } = useSyncExternalStore(pwaUpdate.subscribe, pwaUpdate.get);

  // The "offline ready" note is informational: hide it on its own so it never covers buttons.
  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => pwaUpdate.dismissOfflineReady(), 4000);
    return () => clearTimeout(t);
  }, [offlineReady]);

  if (!offlineReady && !needRefresh) return null;
  return (
    <div role="status" className="card fixed inset-x-4 bottom-28 z-50 mx-auto flex max-w-md items-center gap-3 bg-surface-2 p-4" data-testid="update-prompt">
      <p className="flex-1 text-sm">
        {needRefresh ? 'A new version of BoxTrack is ready. Your boxes and photos are kept.' : 'BoxTrack is ready to work offline.'}
      </p>
      {needRefresh && (
        <Button variant="primary" className="min-h-11 px-4" onClick={() => void pwaUpdate.apply()}>
          Update
        </Button>
      )}
      <Button
        variant="ghost"
        className="min-h-11 px-3"
        onClick={() => (needRefresh ? pwaUpdate.dismissUpdate() : pwaUpdate.dismissOfflineReady())}
      >
        {needRefresh ? 'Later' : 'Close'}
      </Button>
    </div>
  );
}
