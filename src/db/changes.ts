/**
 * Change notifications from the data layer. Every write that affects searchable text calls
 * `notifyBoxesChanged` after its transaction commits, with the ids of the boxes whose box/item/photo
 * data changed. The search index subscribes to keep itself in sync.
 */
type Listener = (boxIds: string[]) => void;
const listeners = new Set<Listener>();

export function onBoxesChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyBoxesChanged(boxIds: Iterable<string>): void {
  const ids = [...new Set(boxIds)];
  if (!ids.length) return;
  for (const l of listeners) l(ids);
}

/** Notify that every box may have changed (e.g. after a restore or "delete all"). */
export const ALL_BOXES = '*';
