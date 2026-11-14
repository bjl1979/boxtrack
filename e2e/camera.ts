import type { Page } from '@playwright/test';

/**
 * A fake rear camera for tests: getUserMedia returns a canvas stream that shows whatever image the
 * test "points the camera at". The app's real scanner code (camera stream → <video> → QR decoder)
 * runs unchanged; only the physical camera is simulated. Survives same-tab reloads.
 */
export async function installFakeCamera(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const W = 640;
    const H = 480;
    let canvas: HTMLCanvasElement | null = null;
    let img: HTMLImageElement | null = null;
    const load = (src: string) => {
      const i = new Image();
      i.onload = () => (img = i);
      i.src = src;
    };
    const saved = sessionStorage.getItem('fakeCamera');
    if (saved) load(saved);
    (window as unknown as { __pointCamera: (src: string) => void }).__pointCamera = (src: string) => {
      sessionStorage.setItem('fakeCamera', src);
      load(src);
    };
    let frame = 0;
    const draw = () => {
      const g = canvas?.getContext('2d');
      if (!g) return;
      g.fillStyle = '#fff';
      g.fillRect(0, 0, W, H);
      // A hand-held phone never holds perfectly still: the label size wobbles slightly.
      const size = 340 + 30 * Math.sin(frame++ / 3);
      if (img) g.drawImage(img, (W - size) / 2, (H - size) / 2, size, size);
    };
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia = async () => {
        canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        draw();
        setInterval(draw, 100);
        return canvas.captureStream(10);
      };
    }
  });
}

/** Points the fake camera at the QR code of printed label `number` (on the Print labels screen). */
export async function pointCameraAtLabel(page: Page, number: number): Promise<void> {
  await page.evaluate((n) => {
    const svg = document.querySelector(`[data-number="${n}"] .label-qr svg`);
    if (!svg) throw new Error(`label ${n} not found`);
    const src = 'data:image/svg+xml;base64,' + btoa(new XMLSerializer().serializeToString(svg));
    (window as unknown as { __pointCamera: (src: string) => void }).__pointCamera(src);
  }, number);
}

/** Debug aid: describes the scanner's video and saves the current camera frame next to the test results. */
export async function describeCamera(page: Page, path: string): Promise<string> {
  const info = await page.evaluate(() => {
    const v = document.querySelector('video') as HTMLVideoElement | null;
    let frame = '';
    if (v && v.videoWidth) {
      const c = document.createElement('canvas');
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext('2d')!.drawImage(v, 0, 0);
      frame = c.toDataURL('image/png');
    }
    return {
      saved: (sessionStorage.getItem('fakeCamera') ?? '').length,
      readyState: v?.readyState,
      size: `${v?.videoWidth}x${v?.videoHeight}`,
      paused: v?.paused,
      decodeAttempts: v?.dataset.decodeAttempts,
      videos: document.querySelectorAll('video').length,
      tracks: (v?.srcObject as MediaStream | null)?.getTracks().map((t) => t.readyState),
      chunks: performance
        .getEntriesByType('resource')
        .filter((e) => /assets\/.*\.js/.test(e.name))
        .map((e) => `${e.name.split('/').pop()}:${Math.round((e as PerformanceResourceTiming).responseEnd)}`),
      now: Math.round(performance.now()),
      controlled: !!navigator.serviceWorker?.controller,
      frame,
    };
  });
  const { writeFileSync } = await import('node:fs');
  if (info.frame) writeFileSync(path, Buffer.from(info.frame.split(',')[1], 'base64'));
  return JSON.stringify({ ...info, frame: info.frame.length });
}
