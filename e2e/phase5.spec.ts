import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Chromium's fake camera plays this file; it is opened when the scanner asks for the camera,
// so the test writes it (from the printed label) before opening the scanner.
const CAMERA_FILE = join(process.cwd(), 'test-results', 'fake-camera', 'label.y4m');
test.use({
  permissions: ['camera'],
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${CAMERA_FILE}`],
  },
});

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

const W = 640;
const H = 480;

/** Renders the QR code shown on a printed label into a grey camera frame (luma bytes). */
async function labelAsCameraFrame(page: Page, number: number): Promise<Buffer> {
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

function writeY4m(luma: Buffer) {
  const chroma = Buffer.alloc((W / 2) * (H / 2), 128);
  const frame = Buffer.concat([Buffer.from('FRAME\n'), luma, chroma, chroma]);
  mkdirSync(dirname(CAMERA_FILE), { recursive: true });
  writeFileSync(CAMERA_FILE, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`), frame, frame]));
}

async function startPlan(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByLabel('Plan name').fill('Doha → Kochi');
  await page.getByRole('button', { name: 'Create plan' }).click();
  await expect(page.getByRole('heading', { name: 'Doha → Kochi' })).toBeVisible();
}

test('print labels 1–20 on A4, then scan label 12 to open box 12', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackConsoleErrors(page);
  await startPlan(page);

  // Boxes 1–20 with "Save & next box".
  await page.getByRole('button', { name: 'New box' }).click();
  for (let n = 1; n <= 20; n++) {
    await expect(page.getByLabel('Box number')).toHaveValue(String(n));
    await page.getByLabel('Label', { exact: true }).fill(n === 12 ? 'Books – novels' : `Box ${n}`);
    if (n === 12) {
      await page.getByRole('group', { name: 'To room' }).getByRole('button', { name: 'Study' }).click();
      await page.getByRole('button', { name: /Fragile/ }).click();
    }
    await page.getByRole('button', { name: 'Save & next box' }).click();
    await expect(page.getByText(`Box ${n} saved`)).toBeVisible();
  }

  // Print labels screen.
  await page.goto('/#/boxes');
  await page.getByRole('link', { name: 'Print labels' }).click();
  await expect(page.getByLabel('From box')).toHaveValue('1');
  await expect(page.getByLabel('To box')).toHaveValue('20');
  await expect(page.getByTestId('label-count')).toHaveText('20 labels on 3 A4 pages');
  await expect(page.getByTestId('sheet')).toHaveCount(3);
  const label12 = page.locator('[data-testid="label"][data-number="12"]');
  await expect(label12).toContainText('12');
  await expect(label12).toContainText('To: Study');
  await expect(label12).toContainText('FRAGILE');
  await expect(label12.locator('.label-qr svg')).toBeVisible();
  await expect(label12.locator('[data-qr]')).toHaveAttribute('data-qr', /^boxtrack:\/\/move\/[0-9a-f-]+\/box\/12$/);

  // Large labels and a smaller range.
  await page.getByRole('radio', { name: '4 per page (large)' }).click();
  await expect(page.getByTestId('label-count')).toHaveText('20 labels on 5 A4 pages');
  await page.getByRole('radio', { name: '8 per page' }).click();

  // The printed result: 3 A4 pages, app chrome hidden.
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('button', { name: /Print or save as PDF/ })).toBeHidden();
  const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(3);
  await page.emulateMedia({ media: 'screen' });

  // Scan label 12 with the (fake) camera.
  writeY4m(await labelAsCameraFrame(page, 12));
  await page.goto('/#/boxes');
  await page.getByRole('link', { name: 'Scan label' }).click();
  await expect(page.getByRole('dialog', { name: 'Scan box label' })).toBeVisible();
  await expect(page.getByTestId('box-number')).toHaveText('12', { timeout: 60_000 });
  await expect(page.getByText('Books – novels')).toBeVisible();
  expect(errors).toEqual([]);
});

test('typing a number in the scanner opens the box, or starts a new box for an unused sticker', async ({ page }) => {
  await startPlan(page);
  await page.getByRole('button', { name: 'New box' }).click();
  await page.getByLabel('Label', { exact: true }).fill('Kitchen');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('box-number')).toHaveText('1');

  await page.goto('/#/scan');
  const dialog = page.getByRole('dialog', { name: 'Scan box label' });
  await dialog.getByLabel('Box number').fill('1');
  await dialog.getByRole('button', { name: 'Open' }).click();
  await expect(page.getByTestId('box-number')).toHaveText('1');

  // Sticker 25 was printed in advance but has no box yet.
  await page.goto('/#/scan');
  await dialog.getByLabel('Box number').fill('25');
  await dialog.getByRole('button', { name: 'Open' }).click();
  await expect(page.getByRole('heading', { name: 'New box' })).toBeVisible();
  await expect(page.getByLabel('Box number')).toHaveValue('25');

  // Pre-printing: with "include numbers with no box", empty labels appear.
  await page.goto('/#/labels');
  await expect(page.getByTestId('label-count')).toHaveText('1 label on 1 A4 page');
  await page.getByRole('checkbox', { name: /Include numbers that have no box yet/ }).click();
  await page.getByLabel('To box').fill('16');
  await expect(page.getByTestId('label-count')).toHaveText('16 labels on 2 A4 pages');
  await expect(page.locator('[data-number="9"]')).toContainText('To: ____');
});
