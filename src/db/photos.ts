import { db } from './schema';
import { ValidationError } from './errors';
import { getSettings } from './settings';
import { touchBox } from './touch';
import type { Photo, PhotoKind } from './types';
import { newId } from '../lib/id';

export interface NewPhoto {
  kind: PhotoKind;
  blob: Blob;
  thumbBlob: Blob;
  width?: number;
  height?: number;
}

export async function listPhotos(boxId: string): Promise<Photo[]> {
  const photos = await db.photos.where('boxId').equals(boxId).toArray();
  return photos.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getPhoto(id: string): Promise<Photo | undefined> {
  return db.photos.get(id);
}

/**
 * Adds already-compressed photos to a box in one transaction.
 * Contents photos are queued for OCR ("pending") unless OCR is switched off.
 */
export async function addPhotos(boxId: string, photos: NewPhoto[]): Promise<Photo[]> {
  const { ocrEnabled } = await getSettings();
  return db.transaction('rw', db.photos, db.boxes, async () => {
    if (!(await db.boxes.get(boxId))) throw new ValidationError('Box not found');
    const now = Date.now();
    const rows: Photo[] = photos.map((p, i) => ({
      id: newId(),
      boxId,
      kind: p.kind,
      blob: p.blob,
      thumbBlob: p.thumbBlob,
      ...(p.width ? { width: p.width, height: p.height } : {}),
      createdAt: now + i,
      ocrStatus: p.kind === 'contents' && ocrEnabled ? 'pending' : 'skipped',
    }));
    await db.photos.bulkAdd(rows);
    await touchBox(boxId);
    return rows;
  });
}

export async function setPhotoKind(id: string, kind: PhotoKind): Promise<void> {
  const { ocrEnabled } = await getSettings();
  await db.transaction('rw', db.photos, db.boxes, async () => {
    const photo = await db.photos.get(id);
    if (!photo) throw new ValidationError('Photo not found');
    const patch: Partial<Photo> = { kind };
    // A photo switched to "contents" that was never read gets queued for OCR.
    if (kind === 'contents' && photo.ocrStatus === 'skipped' && photo.ocrText === undefined) {
      if (ocrEnabled) patch.ocrStatus = 'pending';
    }
    await db.photos.update(id, patch);
    await touchBox(photo.boxId);
  });
}

export async function deletePhoto(id: string): Promise<void> {
  await db.transaction('rw', db.photos, db.boxes, async () => {
    const photo = await db.photos.get(id);
    if (!photo) return;
    await db.photos.delete(id);
    await touchBox(photo.boxId);
  });
}

/** Thumbnail for the box list: the first "outside" photo, else the first photo. */
export async function getCoverThumb(boxId: string): Promise<Blob | null> {
  const photos = await listPhotos(boxId);
  const cover = photos.find((p) => p.kind === 'outside') ?? photos[0];
  return cover?.thumbBlob ?? null;
}
