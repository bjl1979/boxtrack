import type { Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Chromium's fake camera plays a .y4m file that is opened when the app asks for the camera, so a
 * test can write the file (made from a printed label's QR code) before opening the scanner.
 */
export function fakeCameraFile(name: string): string {
  return join(process.cwd(), 'test-results', 'fake-camera', `${name}.y4m`);
}

export function fakeCameraOptions(file: string) {
  return {
    permissions: ['camera'],
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${file}`],
    },
  };
}

const W = 640;
const H = 480;

/** Renders the QR code of printed label `number` (on the Print labels screen) as a camera frame. */
export async function labelAsCameraFrame(page: Page, number: number): Promise<Buffer> {
  const b64 = await page.evaluate(
    async ({ number, W, H }) => {
      const svg = document.querySelector(`[data-number="${number}"] .label-qr svg`)!;
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d')!;
      g.fillStyle = '#fff';
      g.fillRect(0, 0, W, H);
      g.drawImage(img, (W - 340) / 2, (H - 340) / 2, 340, 340);
      const px = g.getImageData(0, 0, W, H).data;
      const y = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) y[i] = Math.round(0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]);
      let s = '';
      for (let i = 0; i < y.length; i += 0x8000) s += String.fromCharCode(...y.subarray(i, i + 0x8000));
      return btoa(s);
    },
    { number, W, H },
  );
  return Buffer.from(b64, 'base64');
}

export function writeCameraFile(file: string, luma: Buffer) {
  const chroma = Buffer.alloc((W / 2) * (H / 2), 128);
  const frame = Buffer.concat([Buffer.from('FRAME\n'), luma, chroma, chroma]);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`), frame, frame]));
}
