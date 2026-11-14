import { createWorker, OEM, type Worker } from 'tesseract.js';
import type { OcrLine } from './text';

/**
 * Tesseract.js wrapper. Tesseract runs inside its own Web Worker, so recognition never blocks the
 * UI. All files (worker script, WASM engine, language data) come from /ocr on our own origin and
 * are precached by the service worker, so OCR works offline.
 */

const IDLE_MS = 60_000; // free the worker's memory (~100 MB) when not used for a minute

// Standard feature probe: a tiny module using a SIMD instruction.
const SIMD_PROBE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
]);

function assetUrl(file: string): string {
  return new URL(`${import.meta.env.BASE_URL}ocr/${file}`, location.href).href;
}

let workerPromise: Promise<Worker> | null = null;
let workerLang = '';
let idleTimer: ReturnType<typeof setTimeout> | undefined;

async function getWorker(lang: string): Promise<Worker> {
  if (workerPromise && workerLang !== lang) await terminateOcr();
  if (!workerPromise) {
    workerLang = lang;
    const simd = WebAssembly.validate(SIMD_PROBE);
    workerPromise = createWorker(lang, OEM.LSTM_ONLY, {
      workerPath: assetUrl('worker.min.js'),
      corePath: assetUrl(simd ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js'),
      langPath: assetUrl('').replace(/\/$/, ''),
      gzip: false,
      cacheMethod: 'none', // the service worker already caches the language file
      workerBlobURL: false,
    }).catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

export async function terminateOcr(): Promise<void> {
  clearTimeout(idleTimer);
  const w = workerPromise;
  workerPromise = null;
  if (w) await (await w.catch(() => null))?.terminate();
}

/** Reads the text lines in an image. */
export async function recognizeLines(image: Blob, lang = 'eng'): Promise<OcrLine[]> {
  clearTimeout(idleTimer);
  const worker = await getWorker(lang);
  try {
    const { data } = await worker.recognize(image, {}, { text: true, blocks: true });
    const lines: OcrLine[] = [];
    for (const b of data.blocks ?? [])
      for (const p of b.paragraphs) for (const l of p.lines) lines.push({ text: l.text, confidence: l.confidence });
    return lines;
  } finally {
    idleTimer = setTimeout(() => void terminateOcr(), IDLE_MS);
  }
}
