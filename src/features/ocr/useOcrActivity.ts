import { useSyncExternalStore } from 'react';
import { getOcrQueue } from './ocrQueue';

const noop = () => () => {};

/** Id of the photo being read right now (or null). */
export function useOcrCurrent(): string | null {
  const q = getOcrQueue();
  return useSyncExternalStore(q?.subscribe ?? noop, () => q?.current ?? null);
}
