import { expect, test, type Page } from '@playwright/test';

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function jpeg(page: Page, w: number, h: number, text: string): Promise<Buffer> {
  const b64 = await page.evaluate(
    ({ w, h, text }) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d')!;
      g.fillStyle = '#c96';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff';
      g.font = `bold ${h / 8}px sans-serif`;
      g.fillText(text, 20, h / 2);
      return c.toDataURL('image/jpeg', 0.9).split(',')[1];
    },
    { w, h, text },
  );
  return Buffer.from(b64, 'base64');
}

async function setupBoxes(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByLabel('Plan name').fill('Move');
  await page.getByRole('button', { name: 'Create plan' }).click();
  await page.getByRole('button', { name: 'New box' }).click();
  await page.getByLabel('Label').fill('Kitchen');
  await page.getByRole('button', { name: 'Save & next box' }).click();
  await expect(page.getByLabel('Box number')).toHaveValue('2');
  await page.getByLabel('Label').fill('Study');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('box-number')).toHaveText('2');
}

test('typed items: fast add, quantity, edit, reorder, move and delete', async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await setupBoxes(page);

  const input = page.getByLabel('New item');
  for (const name of ['Passport', '3x Notebooks', 'Drill', 'Lamp', 'Charger']) {
    await input.fill(name);
    await input.press('Enter');
    await expect(input).toBeFocused(); // ready for the next item
  }
  const rows = page.getByTestId('item-row');
  await expect(rows).toHaveCount(5);
  await expect(page.getByTestId('item-summary')).toHaveText('5 items · 7 pieces');
  await expect(page.getByRole('radio', { name: 'Items (5)' })).toBeVisible();

  // Quantity stepper.
  await page.getByRole('button', { name: 'Increase quantity of Drill' }).click();
  await expect(page.getByTestId('item-summary')).toHaveText('5 items · 8 pieces');

  // Edit name + note.
  await page.getByRole('button', { name: 'Lamp', exact: true }).click();
  await page.getByRole('dialog', { name: 'Edit item' }).getByLabel('Name').fill('Desk lamp');
  await page.getByRole('dialog', { name: 'Edit item' }).getByLabel('Note').fill('bulb removed');
  await page.getByRole('dialog', { name: 'Edit item' }).getByRole('button', { name: 'Save' }).click();
  await expect(rows.nth(3)).toContainText('Desk lamp');
  await expect(rows.nth(3)).toContainText('bulb removed');

  // Reorder.
  await page.getByRole('button', { name: 'Edit list' }).click();
  await page.getByRole('button', { name: 'Move Charger up' }).click();
  await expect(rows.nth(3)).toContainText('Charger');

  // Move two items to box 1.
  await page.getByRole('checkbox', { name: 'Select Drill' }).click();
  await page.getByRole('checkbox', { name: 'Select Charger' }).click();
  await page.getByRole('button', { name: 'Move to box…' }).click();
  await page.getByRole('button', { name: 'Box 1 Kitchen' }).click();
  await expect(page.getByText('Moved to box 1')).toBeVisible();
  await expect(rows).toHaveCount(3);

  // Delete one.
  await page.getByRole('checkbox', { name: 'Select Desk lamp' }).click();
  await page.getByRole('button', { name: 'Delete (1)' }).click();
  await expect(rows).toHaveCount(2);

  // Item counts on the list.
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByTestId('box-row').filter({ hasText: 'Kitchen' })).toContainText('2 items');
  await expect(page.getByTestId('box-row').filter({ hasText: 'Study' })).toContainText('2 items');
  expect(errors).toEqual([]);
});

test('photos: compress on device, tag, view full screen, back button closes viewer, delete', async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await setupBoxes(page);
  await page.getByRole('radio', { name: 'Photos' }).click();

  await page.getByTestId('gallery-input').setInputFiles([
    { name: 'big.jpg', mimeType: 'image/jpeg', buffer: await jpeg(page, 4000, 3000, 'GARAM MASALA') },
    { name: 'small.jpg', mimeType: 'image/jpeg', buffer: await jpeg(page, 800, 600, 'BOOKS') },
  ]);
  await expect(page.getByTestId('photo-thumb')).toHaveCount(2);
  await page.getByRole('radio', { name: 'Outside' }).click();
  await page.getByTestId('camera-input').setInputFiles([
    { name: 'out.jpg', mimeType: 'image/jpeg', buffer: await jpeg(page, 1200, 1600, 'BOX 2') },
  ]);
  await expect(page.getByTestId('photo-thumb')).toHaveCount(3);
  await expect(page.getByRole('radio', { name: 'Photos (3)' })).toBeVisible();

  // A non-image file is rejected without breaking anything.
  await page.getByTestId('gallery-input').setInputFiles([{ name: 'x.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('nope') }]);
  await expect(page.getByRole('alert')).toContainText('not an image');
  await expect(page.getByTestId('photo-thumb')).toHaveCount(3);

  // Stored sizes: longest side 1600 (never upscaled), thumbnails ~300, JPEG blobs.
  const stored = await page.evaluate(
    () =>
      new Promise<{ w: number; h: number; type: string; thumb: number; ocr: string }[]>((resolve) => {
        const req = indexedDB.open('boxtrack');
        req.onsuccess = () => {
          const all = req.result.transaction('photos').objectStore('photos').getAll();
          all.onsuccess = async () => {
            const rows = all.result.sort((a: { createdAt: number }, b: { createdAt: number }) => a.createdAt - b.createdAt);
            const out = [];
            for (const p of rows) {
              const bmp = await createImageBitmap(p.thumbBlob);
              out.push({ w: p.width, h: p.height, type: p.blob.type, thumb: Math.max(bmp.width, bmp.height), ocr: p.ocrStatus });
            }
            resolve(out);
          };
        };
      }),
  );
  expect(stored).toEqual([
    { w: 1600, h: 1200, type: 'image/jpeg', thumb: 300, ocr: 'pending' },
    { w: 800, h: 600, type: 'image/jpeg', thumb: 300, ocr: 'pending' },
    { w: 1200, h: 1600, type: 'image/jpeg', thumb: 300, ocr: 'skipped' },
  ]);

  // Viewer: open, swipe to next, back button closes it.
  await page.getByTestId('photo-thumb').first().click();
  const viewer = page.getByRole('dialog', { name: 'Photo viewer' });
  await expect(viewer).toBeVisible();
  await expect(page.getByTestId('photo-position')).toHaveText('1 / 3');
  const img = page.getByTestId('viewer-image');
  const box = (await img.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId('photo-position')).toHaveText('2 / 3');

  // Double-tap zooms in.
  await img.dblclick();
  await expect(img).toHaveAttribute('style', /scale\(2\.5\)/);

  // Change the tag inside the viewer.
  await page.getByRole('group', { name: 'Photo type' }).getByRole('button', { name: 'Outside' }).click();
  await expect(page.getByRole('group', { name: 'Photo type' }).getByRole('button', { name: 'Outside' })).toHaveAttribute('aria-pressed', 'true');

  await page.goBack();
  await expect(viewer).toBeHidden();
  await expect(page.getByTestId('box-number')).toHaveText('2'); // still on the box

  // Delete from the viewer.
  await page.getByTestId('photo-thumb').first().click();
  await page.getByRole('button', { name: 'Delete photo' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByTestId('photo-position')).toHaveText('1 / 2');
  await page.getByRole('button', { name: 'Close photo' }).click();
  await expect(page.getByTestId('photo-thumb')).toHaveCount(2);

  // Cover photo shows behind the number on the list.
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByTestId('box-row').filter({ hasText: 'Study' }).locator('img')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('items and photos work offline', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByLabel('Plan name').fill('Offline');
  await page.getByRole('button', { name: 'Create plan' }).click();
  await expect(page.getByRole('heading', { name: 'Offline' })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 60_000 }).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'New box' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByLabel('New item').fill('Passport');
  await page.getByLabel('New item').press('Enter');
  await page.getByRole('radio', { name: /Photos/ }).click();
  await page.getByTestId('gallery-input').setInputFiles([{ name: 'a.jpg', mimeType: 'image/jpeg', buffer: await jpeg(page, 2000, 1500, 'X') }]);
  await expect(page.getByTestId('photo-thumb')).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Items (1)' })).toBeVisible();
  await expect(page.getByTestId('photo-thumb')).toHaveCount(1);
  await context.setOffline(false);
});
