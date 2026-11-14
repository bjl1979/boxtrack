import { expect, test, type Page } from '@playwright/test';

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** A photo-like JPEG with printed label text. */
async function labelPhoto(page: Page, lines: string[]): Promise<Buffer> {
  const b64 = await page.evaluate((lines) => {
    const c = document.createElement('canvas');
    c.width = 1600;
    c.height = 1200;
    const g = c.getContext('2d')!;
    g.fillStyle = '#9a6a3a'; // cardboard
    g.fillRect(0, 0, 1600, 1200);
    g.fillStyle = '#ffffff'; // paper label
    g.fillRect(250, 250, 1100, 700);
    g.fillStyle = '#111111';
    g.font = 'bold 110px Arial, sans-serif';
    lines.forEach((l, i) => g.fillText(l, 320, 430 + i * 170));
    return c.toDataURL('image/jpeg', 0.9).split(',')[1];
  }, lines);
  return Buffer.from(b64, 'base64');
}

async function startWithBox(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByLabel('Plan name').fill('Doha → Kochi');
  await page.getByRole('button', { name: 'Create plan' }).click();
  await page.getByRole('button', { name: 'New box' }).click();
  await page.getByLabel('Box number').fill('9');
  await page.getByLabel('Label', { exact: true }).fill('Pantry');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('box-number')).toHaveText('9');
}

test('a contents photo is read in the background, becomes searchable, and its lines become items', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackConsoleErrors(page);
  await startWithBox(page);
  await page.getByRole('radio', { name: /Photos/ }).click();
  await page.getByTestId('gallery-input').setInputFiles([
    { name: 'label.jpg', mimeType: 'image/jpeg', buffer: await labelPhoto(page, ['GARAM MASALA', 'BASMATI RICE']) },
  ]);
  await expect(page.getByTestId('photo-thumb')).toHaveCount(1);
  // The UI stays usable while OCR runs: add an item meanwhile.
  await page.getByRole('radio', { name: /Items/ }).click();
  await page.getByLabel('New item').fill('Tea');
  await page.getByLabel('New item').press('Enter');
  await expect(page.getByTestId('item-row')).toHaveCount(1);
  await page.getByRole('radio', { name: /Photos/ }).click();
  await expect(page.getByTestId('ocr-has-text')).toBeVisible({ timeout: 90_000 });

  // Search finds the box from the photo text alone.
  await page.goto('/#/search');
  await page.getByLabel('Search boxes').fill('masala');
  const first = page.getByTestId('search-result').first();
  await expect(first).toContainText('Pantry');
  await expect(first).toContainText('Photo text');

  // Open the photo, view the text, turn it into items.
  await first.getByRole('link', { name: /MASALA/i }).click();
  await page.getByTestId('photo-thumb').click();
  await page.getByRole('button', { name: 'Text in photo' }).click();
  const textBox = page.getByRole('dialog', { name: 'Text in photo' }).getByLabel('Text in photo');
  await expect(textBox).toHaveValue(/GARAM MASALA/);
  await page.getByRole('button', { name: 'Turn text into items' }).click();
  await expect(page.getByRole('checkbox', { name: 'Garam Masala' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Basmati Rice' })).toBeVisible();
  await page.getByRole('button', { name: /Add 2 items/ }).click();
  await expect(page.getByText('2 items added')).toBeVisible();
  await page.getByRole('button', { name: 'Close photo' }).click();
  await page.getByRole('radio', { name: /Items/ }).click();
  await expect(page.getByTestId('item-row')).toHaveText([/Tea/, /Garam Masala/, /Basmati Rice/]);

  // Edit the text by hand: search follows.
  await page.getByRole('radio', { name: /Photos/ }).click();
  await page.getByTestId('photo-thumb').click();
  await page.getByRole('button', { name: 'Text in photo' }).click();
  await textBox.fill('Garam Masala\nCardamom pods');
  await page.getByRole('button', { name: 'Save text' }).click();
  await page.goto('/#/search');
  await page.getByLabel('Search boxes').fill('cardamom');
  await expect(page.getByTestId('search-result').first()).toContainText('Pantry');

  // Settings shows OCR finished.
  await page.goto('/#/settings');
  await page.getByRole('radio', { name: 'Photo text' }).click();
  await expect(page.getByTestId('ocr-status')).toContainText('All photos are read');
  expect(errors).toEqual([]);
});

test('OCR works offline (engine and English language data are cached locally)', async ({ page, context }) => {
  test.setTimeout(120_000);
  const external: string[] = [];
  page.on('request', (r) => !r.url().startsWith('http://localhost') && !r.url().startsWith('blob:') && !r.url().startsWith('data:') && external.push(r.url()));
  await startWithBox(page);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 60_000 }).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('radio', { name: /Photos/ }).click();
  await page.getByTestId('gallery-input').setInputFiles([
    { name: 'drill.jpg', mimeType: 'image/jpeg', buffer: await labelPhoto(page, ['CORDLESS DRILL']) },
  ]);
  await expect(page.getByTestId('ocr-has-text')).toBeVisible({ timeout: 90_000 });
  await page.goto('/#/search');
  await page.getByLabel('Search boxes').fill('drill');
  await expect(page.getByTestId('search-result').first()).toContainText('Pantry');
  await context.setOffline(false);
  expect(external).toEqual([]); // no CDN or other network calls
});

test('switching OCR off skips new photos; the setting can be turned back on', async ({ page }) => {
  await startWithBox(page);
  await page.goto('/#/settings');
  await page.getByRole('radio', { name: 'Photo text' }).click();
  const toggle = page.getByRole('switch', { name: 'Read text from photos' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('button', { name: 'Read all photos again' })).toBeDisabled();
  await page.goto('/#/boxes');
  await page.getByTestId('box-row').click();
  await page.getByRole('radio', { name: /Photos/ }).click();
  await page.getByTestId('gallery-input').setInputFiles([
    { name: 'x.jpg', mimeType: 'image/jpeg', buffer: await labelPhoto(page, ['BOOKS']) },
  ]);
  await expect(page.getByTestId('photo-thumb')).toHaveCount(1);
  await expect(page.getByTestId('ocr-reading')).toHaveCount(0);
  await page.goto('/#/settings');
  await page.getByRole('radio', { name: 'Photo text' }).click();
  await page.getByRole('switch', { name: 'Read text from photos' }).click();
  await expect(page.getByRole('switch', { name: 'Read text from photos' })).toHaveAttribute('aria-checked', 'true');
});
