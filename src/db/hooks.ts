// React hooks for live data. Components use these instead of touching Dexie directly.
import { useLiveQuery } from 'dexie-react-hooks';
import { getActiveMove, getMoveStats, listMoves } from './moves';
import { getBox, getItemCounts, listBoxes } from './boxes';
import { getSettings } from './settings';
import { listItems } from './items';
import { getCoverThumb, listPhotos } from './photos';

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

export function useItems(boxId: string | undefined) {
  return useLiveQuery(() => (boxId ? listItems(boxId) : []), [boxId]);
}

export function usePhotos(boxId: string | undefined) {
  return useLiveQuery(() => (boxId ? listPhotos(boxId) : []), [boxId]);
}

/** Cover thumbnail of a box; pass `enabled=false` to defer the query (e.g. until the row is on screen). */
export function useCoverThumb(boxId: string, enabled = true) {
  return useLiveQuery(() => (enabled ? getCoverThumb(boxId) : null), [boxId, enabled]);
}

export function useOtherBoxes(moveId: string | undefined, exceptBoxId: string | undefined) {
  return useLiveQuery(
    async () => (moveId ? (await listBoxes(moveId)).filter((b) => b.id !== exceptBoxId) : []),
    [moveId, exceptBoxId],
  );
}

export function useMoveStats() {
  return useLiveQuery(() => getMoveStats(), []);
}
