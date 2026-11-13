import { getNextPendingOcrPhoto, getSettings, onBoxesChanged, setPhotoOcrText, type Photo } from '../../db';
import { cleanOcrLines, type OcrLine } from './text';

export type Recognize = (image: Blob, lang: string) => Promise<OcrLine[]>;

/**
 * Background OCR queue: reads "pending" photos one at a time, oldest first. Stops while OCR is
 * switched off. A failure marks only that photo as "failed"; the photo itself is always kept.
 */
export class OcrQueue {
  private running = false;
  private again = false;
  private listeners = new Set<() => void>();
  /** Photo being read right now, for the UI. */
  current: string | null = null;
  constructor(private recognize: Recognize) {}

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  private emit() {
    for (const l of this.listeners) l();
  }

  /** Starts processing if idle; if busy, makes sure newly queued photos are picked up. */
  kick(): Promise<void> {
    if (this.running) {
      this.again = true;
      return Promise.resolve();
    }
    return this.run();
  }

  private async run(): Promise<void> {
    this.running = true;
    try {
      do {
        this.again = false;
        for (;;) {
          const settings = await getSettings();
          if (!settings.ocrEnabled) break;
          const photo = await getNextPendingOcrPhoto();
          if (!photo) break;
          await this.process(photo, settings.ocrLanguage);
        }
      } while (this.again);
    } finally {
      this.running = false;
      this.current = null;
      this.emit();
    }
  }

  private async process(photo: Photo, lang: string) {
    this.current = photo.id;
    this.emit();
    try {
      const text = cleanOcrLines(await this.recognize(photo.blob, lang));
      await setPhotoOcrText(photo.id, text, 'done');
    } catch (e) {
      console.warn('OCR failed for photo', photo.id, e);
      await setPhotoOcrText(photo.id, photo.ocrText, 'failed');
    }
  }
}

let queue: OcrQueue | null = null;

export function getOcrQueue(): OcrQueue | null {
  return queue;
}

/** Creates the app's OCR queue (loading Tesseract only when first needed) and starts it. */
export function startOcrQueue(): OcrQueue {
  if (queue) return queue;
  const q = new OcrQueue(async (blob, lang) => (await import('./engine')).recognizeLines(blob, lang));
  queue = q;
  onBoxesChanged(() => void q.kick());
  void q.kick();
  return q;
}
