import Dexie, { type EntityTable } from 'dexie';
import type { Box, Item, Move, Photo, SettingRow } from './types';

export class BoxTrackDB extends Dexie {
  moves!: EntityTable<Move, 'id'>;
  boxes!: EntityTable<Box, 'id'>;
  items!: EntityTable<Item, 'id'>;
  photos!: EntityTable<Photo, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;

  constructor(name = 'boxtrack') {
    super(name);
    // Schema history. NEVER edit a published version: add a new version() with an
    // upgrade() so existing data on the owner's phone is migrated, not lost.
    this.version(1).stores({
      moves: 'id, createdAt',
      // Box numbers are unique within a move (enforced by the compound unique index).
      boxes: 'id, moveId, &[moveId+number], [moveId+updatedAt], status',
      items: 'id, boxId, [boxId+position]',
      photos: 'id, boxId, [boxId+kind], ocrStatus',
      settings: 'key',
    });
  }
}

export const db = new BoxTrackDB();
