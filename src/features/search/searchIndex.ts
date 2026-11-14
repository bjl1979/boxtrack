import MiniSearch, { type SearchResult } from 'minisearch';
import { getSearchSources, onBoxesChanged, onDataReset, type SearchSources } from '../../db';

/** Where a match was found. */
export type MatchSource = 'item' | 'itemNote' | 'label' | 'boxNote' | 'room' | 'category' | 'photo';

export const SOURCE_LABEL: Record<MatchSource, string> = {
  item: 'Item',
  itemNote: 'Item note',
  label: 'Label',
  boxNote: 'Box note',
  room: 'Room',
  category: 'Category',
  photo: 'Photo text',
};

interface Doc {
  id: string; // "box:<id>", "item:<id>", "photo:<id>"
  boxId: string;
  moveId: string;
  photoId?: string;
  itemName?: string;
  itemNote?: string;
  label?: string;
  boxNote?: string;
  room?: string;
  category?: string;
  photo?: string;
}

const FIELDS = ['itemName', 'itemNote', 'label', 'boxNote', 'room', 'category', 'photo'] as const;
type Field = (typeof FIELDS)[number];
const FIELD_SOURCE: Record<Field, MatchSource> = {
  itemName: 'item',
  itemNote: 'itemNote',
  label: 'label',
  boxNote: 'boxNote',
  room: 'room',
  category: 'category',
  photo: 'photo',
};

export interface Match {
  source: MatchSource;
  text: string;
  /** Matched words from the index, for highlighting. */
  terms: string[];
  photoId?: string;
  itemId?: string;
  score: number;
}

export interface BoxHit {
  boxId: string;
  score: number;
  matches: Match[];
}

function docsFor(src: SearchSources): Doc[] {
  const moveOf = new Map(src.boxes.map((b) => [b.id, b.moveId]));
  const docs: Doc[] = [];
  for (const b of src.boxes) {
    const rooms = [...new Set([b.fromRoom, b.toRoom].filter(Boolean))].join(' → ');
    docs.push({
      id: `box:${b.id}`,
      boxId: b.id,
      moveId: b.moveId,
      label: b.label,
      boxNote: b.notes,
      room: rooms || undefined,
      category: b.category,
    });
  }
  for (const i of src.items) {
    const moveId = moveOf.get(i.boxId);
    if (moveId) docs.push({ id: `item:${i.id}`, boxId: i.boxId, moveId, itemName: i.name, itemNote: i.note });
  }
  for (const p of src.photos) {
    const moveId = moveOf.get(p.boxId);
    if (moveId) docs.push({ id: `photo:${p.id}`, boxId: p.boxId, moveId, photoId: p.id, photo: p.ocrText });
  }
  return docs;
}

function createMiniSearch() {
  return new MiniSearch<Doc>({
    fields: [...FIELDS],
    storeFields: ['boxId', 'moveId', 'photoId', ...FIELDS],
    searchOptions: {
      prefix: true,
      // Allow 1 typo in words of 5+ letters, 2 in long words ("passprt" → "passport").
      fuzzy: (term) => (term.length >= 8 ? 2 : term.length >= 5 ? 1 : 0),
      boost: { itemName: 3, label: 3, category: 1.5, room: 1.5, itemNote: 1, boxNote: 1, photo: 1 },
    },
  });
}

/**
 * Full-text index over every box, item and photo text, kept in memory. Rebuilt from IndexedDB at
 * startup and updated whenever the data layer reports a change.
 */
export class BoxSearchIndex {
  private ms = createMiniSearch();
  private docsByBox = new Map<string, string[]>();
  private listeners = new Set<() => void>();
  private queue: Promise<void> = Promise.resolve();
  version = 0;
  ready = false;

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  private bump() {
    this.version++;
    for (const l of this.listeners) l();
  }

  private addDocs(docs: Doc[]) {
    this.ms.addAll(docs);
    for (const d of docs) {
      const list = this.docsByBox.get(d.boxId) ?? [];
      list.push(d.id);
      this.docsByBox.set(d.boxId, list);
    }
  }

  private removeBox(boxId: string) {
    for (const id of this.docsByBox.get(boxId) ?? []) this.ms.discard(id);
    this.docsByBox.delete(boxId);
  }

  /** Rebuilds the whole index from the database. */
  rebuild(): Promise<void> {
    return this.enqueue(async () => {
      const src = await getSearchSources();
      this.ms = createMiniSearch();
      this.docsByBox.clear();
      this.addDocs(docsFor(src));
      this.ready = true;
    });
  }

  /** Re-reads the given boxes (with their items and photo text) and replaces their entries. */
  reindexBoxes(boxIds: string[]): Promise<void> {
    return this.enqueue(async () => {
      const src = await getSearchSources(boxIds);
      for (const id of boxIds) this.removeBox(id);
      this.addDocs(docsFor(src));
    });
  }

  /** Index updates run one after another so a slow read can't overwrite a newer one. */
  private enqueue(job: () => Promise<void>): Promise<void> {
    this.queue = this.queue.then(job).then(
      () => this.bump(),
      (e) => console.warn('Search index update failed', e),
    );
    return this.queue;
  }

  /** Waits until all pending index updates are applied. */
  idle(): Promise<void> {
    return this.queue;
  }

  /** Searches one move. Results are grouped by box, best box first, with up to `perBox` matches each. */
  search(query: string, moveId: string, perBox = 3): BoxHit[] {
    const q = query.trim();
    if (!q) return [];
    const filter = (r: SearchResult) => r.moveId === moveId;
    let results = this.ms.search(q, { combineWith: 'AND', filter });
    if (!results.length) results = this.ms.search(q, { combineWith: 'OR', filter });

    const byBox = new Map<string, BoxHit>();
    for (const r of results) {
      const boxId = r.boxId as string;
      const hit = byBox.get(boxId) ?? { boxId, score: 0, matches: [] };
      // One match line per matched field of this document.
      const fields = new Set(Object.values(r.match).flat() as Field[]);
      for (const f of FIELDS) {
        if (!fields.has(f) || !r[f]) continue;
        const terms = Object.entries(r.match)
          .filter(([, fs]) => (fs as string[]).includes(f))
          .map(([t]) => t);
        hit.matches.push({
          source: FIELD_SOURCE[f],
          text: r[f] as string,
          terms,
          photoId: r.photoId as string | undefined,
          itemId: String(r.id).startsWith('item:') ? String(r.id).slice(5) : undefined,
          score: r.score,
        });
      }
      hit.score = Math.max(hit.score, r.score);
      byBox.set(boxId, hit);
    }
    const hits = [...byBox.values()];
    for (const h of hits) {
      h.matches.sort((a, b) => b.score - a.score);
      // A box with several matching things ranks a little higher than one with a single match.
      h.score += Math.min(h.matches.length - 1, 4) * 0.05 * h.score;
      h.matches = h.matches.slice(0, perBox);
    }
    return hits.sort((a, b) => b.score - a.score);
  }
}

export const searchIndex = new BoxSearchIndex();

let started = false;
/** Builds the index and keeps it in sync with the database. Safe to call more than once. */
export function startSearchIndex(): void {
  if (started) return;
  started = true;
  onBoxesChanged((ids) => void searchIndex.reindexBoxes(ids));
  onDataReset(() => void searchIndex.rebuild());
  void searchIndex.rebuild();
}
