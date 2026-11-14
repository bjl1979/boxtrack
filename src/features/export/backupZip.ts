import JSZip from 'jszip';
import { BOX_SIZES, BOX_STATUSES, type AllData, type Box, type Item, type Move, type Photo, type SettingRow } from '../../db';

export const BACKUP_FORMAT = 'boxtrack-backup';
export const BACKUP_VERSION = 1;

type PhotoMeta = Omit<Photo, 'blob' | 'thumbBlob'> & { file: string; thumb: string };

interface BackupJson {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  counts: { moves: number; boxes: number; items: number; photos: number };
  moves: Move[];
  boxes: Box[];
  items: Item[];
  photos: PhotoMeta[];
  settings: SettingRow[];
}

/** Builds the full backup: data.json plus every photo and thumbnail as JPEG files. */
export async function buildBackupZip(data: AllData, now = new Date()): Promise<Blob> {
  const zip = new JSZip();
  const photos: PhotoMeta[] = [];
  for (const p of data.photos) {
    const { blob, thumbBlob, ...meta } = p;
    const file = `photos/${p.id}.jpg`;
    const thumb = `thumbs/${p.id}.jpg`;
    zip.file(file, blob, { compression: 'STORE' }); // JPEGs are already compressed
    zip.file(thumb, thumbBlob, { compression: 'STORE' });
    photos.push({ ...meta, file, thumb });
  }
  const json: BackupJson = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    counts: { moves: data.moves.length, boxes: data.boxes.length, items: data.items.length, photos: data.photos.length },
    moves: data.moves,
    boxes: data.boxes,
    items: data.items,
    photos,
    settings: data.settings,
  };
  zip.file('data.json', JSON.stringify(json, null, 1), { compression: 'DEFLATE' });
  return zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
}

export class BackupError extends Error {}

export interface ParsedBackup {
  data: AllData;
  exportedAt: string;
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const optStr = (v: unknown) => v === undefined || isStr(v);

function check(ok: boolean, what: string) {
  if (!ok) throw new BackupError(`This backup file is damaged (${what}).`);
}

/** Reads and validates a backup file. Throws BackupError with a readable message. */
export async function readBackupZip(file: Blob): Promise<ParsedBackup> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new BackupError('This is not a BoxTrack backup (.zip) file.');
  }
  const entry = zip.file('data.json');
  if (!entry) throw new BackupError('This is not a BoxTrack backup: data.json is missing.');
  let json: BackupJson;
  try {
    json = JSON.parse(await entry.async('string'));
  } catch {
    throw new BackupError('This backup file is damaged (data.json cannot be read).');
  }
  if (json?.format !== BACKUP_FORMAT) throw new BackupError('This is not a BoxTrack backup file.');
  if (!isNum(json.version) || json.version > BACKUP_VERSION)
    throw new BackupError('This backup was made by a newer version of BoxTrack. Update the app first.');
  for (const k of ['moves', 'boxes', 'items', 'photos', 'settings'] as const) check(Array.isArray(json[k]), k);

  for (const m of json.moves) check(isStr(m.id) && isStr(m.name) && isNum(m.createdAt), 'plan');
  const moveIds = new Set(json.moves.map((m) => m.id));
  for (const b of json.boxes)
    check(
      isStr(b.id) &&
        moveIds.has(b.moveId) &&
        Number.isInteger(b.number) &&
        BOX_STATUSES.includes(b.status) &&
        typeof b.flags === 'object' &&
        (b.size === undefined || BOX_SIZES.includes(b.size)) &&
        optStr(b.label) &&
        isNum(b.updatedAt),
      'box',
    );
  const boxIds = new Set(json.boxes.map((b) => b.id));
  for (const i of json.items) check(isStr(i.id) && boxIds.has(i.boxId) && isStr(i.name) && isNum(i.quantity) && isNum(i.position), 'item');

  const photos: Photo[] = [];
  for (const p of json.photos) {
    check(isStr(p.id) && boxIds.has(p.boxId) && (p.kind === 'outside' || p.kind === 'contents'), 'photo');
    const f = zip.file(p.file);
    const t = zip.file(p.thumb);
    check(!!f && !!t, `photo file ${p.file} missing`);
    const { file: _f, thumb: _t, ...meta } = p;
    void _f;
    void _t;
    photos.push({
      ...meta,
      blob: new Blob([await f!.async('arraybuffer')], { type: 'image/jpeg' }),
      thumbBlob: new Blob([await t!.async('arraybuffer')], { type: 'image/jpeg' }),
    });
  }
  for (const s of json.settings) check(isStr(s.key), 'setting');

  return {
    exportedAt: json.exportedAt,
    data: { moves: json.moves, boxes: json.boxes, items: json.items, photos, settings: json.settings },
  };
}

export function backupFileName(now = new Date()): string {
  const d = now.toISOString().slice(0, 10);
  return `BoxTrack-backup-${d}.zip`;
}
