import { getSettings, setSetting } from '../db';

/** Ask the browser not to evict our data (Android may clear storage otherwise). Runs once. */
export async function requestPersistentStorageOnce(): Promise<void> {
  try {
    const settings = await getSettings();
    if (settings.persistRequested || !navigator.storage?.persist) return;
    await navigator.storage.persist();
    await setSetting('persistRequested', true);
  } catch {
    /* not supported – ignore */
  }
}

export interface StorageInfo {
  usage: number;
  quota: number;
  persisted: boolean;
}

export async function getStorageInfo(): Promise<StorageInfo | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  const persisted = (await navigator.storage.persisted?.()) ?? false;
  return { usage, quota, persisted };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}
