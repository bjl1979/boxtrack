/** Photo compression on the device: canvas resize to JPEG, plus a small thumbnail. */

export const PHOTO_MAX_SIDE = 1600;
export const PHOTO_QUALITY = 0.75;
export const THUMB_MAX_SIDE = 300;
export const THUMB_QUALITY = 0.7;

/** Scales (w, h) down so the longest side is at most `maxSide`. Never scales up. */
export function fitWithin(w: number, h: number, maxSide: number): { width: number; height: number } {
  if (w <= 0 || h <= 0) throw new Error('Invalid image size');
  const scale = Math.min(1, maxSide / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

export interface CompressedPhoto {
  blob: Blob;
  thumbBlob: Blob;
  width: number;
  height: number;
}

async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    // Applies the EXIF rotation, so phone photos are the right way up.
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('This file could not be read as an image');
  }
}

async function render(bitmap: ImageBitmap, maxSide: number, quality: number) {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.fillStyle = '#fff'; // JPEG has no transparency
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
  canvas.width = canvas.height = 0; // release memory early on phones
  if (!blob) throw new Error('Could not compress the photo');
  return { blob, width, height };
}

export async function compressPhoto(file: Blob): Promise<CompressedPhoto> {
  const bitmap = await decode(file);
  try {
    const main = await render(bitmap, PHOTO_MAX_SIDE, PHOTO_QUALITY);
    const thumb = await render(bitmap, THUMB_MAX_SIDE, THUMB_QUALITY);
    return { blob: main.blob, thumbBlob: thumb.blob, width: main.width, height: main.height };
  } finally {
    bitmap.close();
  }
}
