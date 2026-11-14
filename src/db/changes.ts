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

const resetListeners = new Set<() => void>();

/** Called after the whole database was replaced (restore, "delete all data"). */
export function onDataReset(listener: () => void): () => void {
  resetListeners.add(listener);
  return () => resetListeners.delete(listener);
}

export function notifyDataReset(): void {
  for (const l of resetListeners) l();
}
