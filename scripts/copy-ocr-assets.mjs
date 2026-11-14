// Copies the Tesseract.js worker, WASM core and English language data into public/ocr so OCR
// runs fully offline from the app's own origin (no CDN). Runs before `dev` and `build`.
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const out = new URL('../public/ocr/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const tesseractDir = dirname(require.resolve('tesseract.js/package.json'));
const coreDir = dirname(require.resolve('tesseract.js-core/package.json'));
const engDir = dirname(require.resolve('@tesseract.js-data/eng/package.json'));

const copies = [
  [join(tesseractDir, 'dist/worker.min.js'), 'worker.min.js'],
  [join(coreDir, 'tesseract-core-simd-lstm.wasm.js'), 'tesseract-core-simd-lstm.wasm.js'],
  [join(coreDir, 'tesseract-core-lstm.wasm.js'), 'tesseract-core-lstm.wasm.js'],
];
for (const [from, name] of copies) {
  const to = join(out, name);
  if (!existsSync(to) || statSync(to).size !== statSync(from).size) copyFileSync(from, to);
}

// Stored uncompressed: some static hosts add Content-Encoding to .gz files, which breaks loading.
const lang = join(out, 'eng.traineddata');
if (!existsSync(lang)) writeFileSync(lang, gunzipSync(readFileSync(join(engDir, '4.0.0_best_int/eng.traineddata.gz'))));
console.log('OCR assets ready in public/ocr');
