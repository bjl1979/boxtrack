// React hooks for live data. Components use these instead of touching Dexie directly.
import { useLiveQuery } from 'dexie-react-hooks';
import { getActiveMove, listMoves } from './moves';
import { getBox, getItemCounts, listBoxes } from './boxes';
import { getSettings } from './settings';

/** `undefined` while loading, `null` when there is no active move. */
export function useActiveMove() {
  return useLiveQuery(async () => (await getActiveMove()) ?? null, []);
}

export function useMoves() {
  return useLiveQuery(() => listMoves(), []);
}

export function useBoxes(moveId: string | undefined) {
  return useLiveQuery(() => (moveId ? listBoxes(moveId) : []), [moveId]);
}

/** `undefined` while loading, `null` when not found. */
export function useBox(id: string | undefined) {
  return useLiveQuery(async () => (id ? ((await getBox(id)) ?? null) : null), [id]);
}

export function useItemCounts(moveId: string | undefined) {
  return useLiveQuery<Record<string, number>>(() => (moveId ? getItemCounts(moveId) : {}), [moveId]);
}

export function useSettings() {
  return useLiveQuery(() => getSettings(), []);
}
