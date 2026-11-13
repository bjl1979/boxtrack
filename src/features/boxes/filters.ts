import { BOX_STATUSES, type Box, type BoxStatus, type FlagKey } from '../../db';

export type SortKey = 'number' | 'updated';

export interface BoxFilters {
  statuses: BoxStatus[];
  rooms: string[];
  categories: string[];
  flags: FlagKey[];
}

export const EMPTY_FILTERS: BoxFilters = { statuses: [], rooms: [], categories: [], flags: [] };

export function activeFilterCount(f: BoxFilters): number {
  return f.statuses.length + f.rooms.length + f.categories.length + f.flags.length;
}

/**
 * Within a group the choices are OR-ed; groups are AND-ed.
 * A room filter matches either the from- or the to-room. Flag filters require every chosen flag.
 */
export function filterBoxes(boxes: Box[], f: BoxFilters): Box[] {
  return boxes.filter(
    (b) =>
      (!f.statuses.length || f.statuses.includes(b.status)) &&
      (!f.rooms.length ||
        (b.fromRoom !== undefined && f.rooms.includes(b.fromRoom)) ||
        (b.toRoom !== undefined && f.rooms.includes(b.toRoom))) &&
      (!f.categories.length || (b.category !== undefined && f.categories.includes(b.category))) &&
      f.flags.every((k) => b.flags[k]),
  );
}

export function sortBoxes(boxes: Box[], key: SortKey): Box[] {
  const copy = [...boxes];
  if (key === 'number') copy.sort((a, b) => a.number - b.number);
  else copy.sort((a, b) => b.updatedAt - a.updatedAt || a.number - b.number);
  return copy;
}

export interface BoxSummary {
  total: number;
  byStatus: Record<BoxStatus, number>;
  /** Packed or further along. */
  packed: number;
  /** Delivered or unpacked. */
  delivered: number;
  unpacked: number;
  /** Shipped but not yet delivered. */
  missing: number;
}

export function summarise(boxes: Box[]): BoxSummary {
  const byStatus = Object.fromEntries(BOX_STATUSES.map((s) => [s, 0])) as Record<BoxStatus, number>;
  for (const b of boxes) byStatus[b.status]++;
  return {
    total: boxes.length,
    byStatus,
    packed: byStatus.packed + byStatus.shipped + byStatus.delivered + byStatus.unpacked,
    delivered: byStatus.delivered + byStatus.unpacked,
    unpacked: byStatus.unpacked,
    missing: byStatus.shipped,
  };
}
