import { useState, useSyncExternalStore } from 'react';
import { Button } from '../../components/ui';
import { appVersion, checkForUpdate, pwaUpdate, type CheckResult } from '../../lib/pwaUpdate';

const MESSAGES: Record<CheckResult, string> = {
  available: 'A new version is ready.',
  latest: 'You have the latest version.',
  offline: 'You are offline. Updates are checked again when you are back online.',
  unsupported: 'Updates are not available in this browser.',
  error: 'Could not check for updates. Try again later.',
};

export function AboutSettings() {
  const { needRefresh, checking } = useSyncExternalStore(pwaUpdate.subscribe, pwaUpdate.get);
  const [result, setResult] = useState<CheckResult | null>(null);
  const built = new Date(appVersion.builtAt).toLocaleDateString(undefined, { dateStyle: 'medium' });
  return (
    <div className="card flex flex-col gap-3 p-4">
      <p data-testid="app-version">
        <span className="font-semibold">BoxTrack {appVersion.version}</span>
        <span className="text-sm text-muted">
          {' '}
          · build {appVersion.build} · {built}
        </span>
      </p>
      <p className="text-sm text-muted">
        New versions install themselves – no need to reinstall. BoxTrack checks when you open it; when an update is ready you
        see an <span className="font-semibold">Update</span> button. Your boxes, items and photos are never touched by an update.
      </p>
      {needRefresh ? (
        <Button variant="primary" onClick={() => void pwaUpdate.apply()}>
          Update now
        </Button>
      ) : (
        <Button disabled={checking} onClick={async () => setResult(await checkForUpdate())}>
          {checking ? 'Checking…' : 'Check for updates'}
        </Button>
      )}
      {result && !needRefresh && (
        <p role="status" className="text-sm" data-testid="update-result">
          {MESSAGES[result]}
        </p>
      )}
    </div>
  );
}
