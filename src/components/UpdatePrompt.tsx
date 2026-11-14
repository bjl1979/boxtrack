import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './ui';

/** Toast shown when the app is ready offline, or when a new version is waiting. */
export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  // The "offline ready" note is informational: hide it on its own so it never covers buttons.
  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 4000);
    return () => clearTimeout(t);
  }, [offlineReady, setOfflineReady]);

  if (!offlineReady && !needRefresh) return null;
  return (
    <div role="status" className="card fixed inset-x-4 bottom-28 z-50 mx-auto flex max-w-md items-center gap-3 bg-surface-2 p-4">
      <p className="flex-1 text-sm">
        {needRefresh ? 'A new version of BoxTrack is ready.' : 'BoxTrack is ready to work offline.'}
      </p>
      {needRefresh && (
        <Button variant="primary" className="min-h-11 px-4" onClick={() => updateServiceWorker(true)}>
          Update
        </Button>
      )}
      <Button
        variant="ghost"
        className="min-h-11 px-3"
        onClick={() => {
          setOfflineReady(false);
          setNeedRefresh(false);
        }}
      >
        Close
      </Button>
    </div>
  );
}
