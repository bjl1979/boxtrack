import { FLAG_KEYS, type Box, type Item, type Move } from '../../db';
import { FLAG_META, STATUS_META } from '../boxes/statusMeta';

export const COLUMNS = [
  'Plan',
  'Box',
  'Box label',
  'From room',
  'To room',
  'Category',
  'Status',
  'Flags',
  'Size',
  'Weight (kg)',
  'Box notes',
  'Item',
  'Quantity',
  'Item note',
] as const;

export type Row = (string | number)[];

export function flagText(box: Box): string {
  return FLAG_KEYS.filter((k) => box.flags[k])
    .map((k) => FLAG_META[k].label)
    .join(', ');
}

/** One row per item (with its box's details). Boxes without items get one row with the item cells empty. */
export function inventoryRows(move: Move, boxes: Box[], items: Item[]): Row[] {
  const byBox = new Map<string, Item[]>();
  for (const i of items) byBox.set(i.boxId, [...(byBox.get(i.boxId) ?? []), i]);
  const rows: Row[] = [];
  for (const b of [...boxes].sort((a, c) => a.number - c.number)) {
    const boxCells: Row = [
      move.name,
      b.number,
      b.label ?? '',
      b.fromRoom ?? '',
      b.toRoom ?? '',
      b.category ?? '',
      STATUS_META[b.status].label,
      flagText(b),
      b.size ?? '',
      b.weightKg ?? '',
      b.notes ?? '',
    ];
    const its = (byBox.get(b.id) ?? []).sort((a, c) => a.position - c.position);
    if (!its.length) rows.push([...boxCells, '', '', '']);
    for (const i of its) rows.push([...boxCells, i.name, i.quantity, i.note ?? '']);
  }
  return rows;
}

function csvCell(v: string | number): string {
  const s = String(v);
  // Quote when needed; neutralise leading =,+,-,@ so spreadsheet apps don't run it as a formula.
  const safe = /^[=+\-@\t\r]/.test(s) && typeof v === 'string' ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** RFC 4180 CSV with a UTF-8 BOM so Excel shows non-English text correctly. */
export function toCsv(rows: Row[]): string {
  return '﻿' + [COLUMNS as readonly string[], ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export async function toXlsx(rows: Row[], sheetName: string): Promise<Blob> {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([[...COLUMNS], ...rows]);
  ws['!cols'] = COLUMNS.map((c) => ({ wch: c === 'Item' || c === 'Box label' || c === 'Box notes' ? 28 : c.length + 4 }));
  ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(COLUMNS.length - 1)}${rows.length + 1}` };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Inventory');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** File-name-safe version of a plan name. */
export function fileSlug(name: string): string {
  return name.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'plan';
}
