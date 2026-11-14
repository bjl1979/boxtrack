import { useMemo, useSyncExternalStore } from 'react';
import { searchIndex, type BoxHit } from './searchIndex';

/** Live search results for the active move; re-runs when the index changes. */
export function useSearch(query: string, moveId: string): { hits: BoxHit[]; ready: boolean } {
  const version = useSyncExternalStore(searchIndex.subscribe, () => searchIndex.version);
  return useMemo(
    () => ({ hits: searchIndex.search(query, moveId), ready: searchIndex.ready }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, moveId, version],
  );
}
