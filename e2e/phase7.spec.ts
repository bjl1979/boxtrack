import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function labelPhoto(page: Page, text: string): Promise<Buffer> {
  const b64 = await page.evaluate((text) => {
    const c = document.createElement('canvas');
    c.width = 1600;
    c.height = 1200;
    const g = c.getContext('2d')!;
    g.fillStyle = '#9a6a3a';
    g.fillRect(0, 0, 1600, 1200);
    g.fillStyle = '#fff';
    g.fillRect(250, 350, 1100, 400);
    g.fillStyle = '#111';
    g.font = 'bold 110px Arial';
    g.fillText(text, 320, 600);
    return c.toDataURL('image/jpeg', 0.9).split(',')[1];
  }, text);
  return Buffer.from(b64, 'base64');
}

async function download(page: Page, click: () => Promise<void>) {
  const [d] = await Promise.all([page.waitForEvent('download'), click()]);
  const path = test.info().outputPath(d.suggestedFilename());
  await d.saveAs(path);
  return { name: d.suggestedFilename(), bytes: readFileSync(path), path };
}

test('back up, delete everything, restore: every box, item and photo comes back', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trackConsoleErrors(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByLabel('Plan name').fill('Doha → Kochi');
  await page.getByRole('button', { name: 'Create plan' }).click();

  // 11 boxes.
  await page.getByRole('button', { name: 'New box' }).click();
  for (let n = 1; n <= 11; n++) {
    await page.getByLabel('Label', { exact: true }).fill(n === 1 ? 'Pantry' : `Box ${n}`);
    await page.getByRole('button', { name: 'Save & next box' }).click();
    await expect(page.getByText(`Box ${n} saved`)).toBeVisible();
  }
  // Box 1: items and a photo whose text is read.
  await page.goto('/#/boxes');
  await page.getByTestId('box-row').filter({ hasText: 'Pantry' }).click();
  for (const it of ['3x Rice bags', 'Passport', 'Tea']) {
    await page.getByLabel('New item').fill(it);
    await page.getByLabel('New item').press('Enter');
  }
  await expect(page.getByTestId('item-row')).toHaveCount(3);
  await page.getByRole('radio', { name: /Photos/ }).click();
  await page.getByTestId('gallery-input').setInputFiles([{ name: 'p.jpg', mimeType: 'image/jpeg', buffer: await labelPhoto(page, 'GARAM MASALA') }]);
  await expect(page.getByTestId('ocr-has-text')).toBeVisible({ timeout: 90_000 });

  // Reminder: more than 10 boxes and no backup.
  await page.goto('/#/boxes');
  await expect(page.getByTestId('backup-reminder')).toContainText('never made a backup');
  await page.getByRole('link', { name: 'Back up now' }).click();
  await expect(page.getByTestId('last-backup')).toHaveText('Last backup: never');

  const backup = await download(page, () => page.getByRole('button', { name: 'Download backup (.zip)' }).click());
  expect(backup.name).toMatch(/^BoxTrack-backup-\d{4}-\d{2}-\d{2}\.zip$/);
  expect(backup.bytes.subarray(0, 2).toString()).toBe('PK');
  await expect(page.getByTestId('last-backup')).not.toHaveText('Last backup: never');

  // Exports for the active plan.
  const pdf = await download(page, () => page.getByRole('button', { name: 'Inventory PDF' }).click());
  expect(pdf.name).toBe('BoxTrack-Doha-Kochi-inventory.pdf');
  expect(pdf.bytes.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.bytes.toString('latin1')).toContain('Rice bags');
  const xlsx = await download(page, () => page.getByRole('button', { name: 'Excel' }).click());
  expect(xlsx.name).toBe('BoxTrack-Doha-Kochi.xlsx');
  expect(xlsx.bytes.subarray(0, 2).toString()).toBe('PK');
  const csv = await download(page, () => page.getByRole('button', { name: 'CSV' }).click());
  const csvText = csv.bytes.toString('utf8');
  expect(csvText).toContain('Plan,Box,Box label');
  expect(csvText).toContain('Doha → Kochi,1,Pantry,,,,Packing,,,,,Rice bags,3,');
  expect(csvText.trim().split('\r\n')).toHaveLength(1 + 3 + 10); // header + 3 items + 10 empty boxes

  // The reminder is gone now.
  await page.goto('/#/boxes');
  await expect(page.getByTestId('box-row').first()).toBeVisible();
  await expect(page.getByTestId('backup-reminder')).toHaveCount(0);

  // Delete all data (asks twice).
  await page.goto('/#/settings?tab=backup');
  await page.getByRole('button', { name: 'Delete all data' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('Are you absolutely sure?');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete everything' }).click();
  await expect(page.getByRole('button', { name: 'Get started' })).toBeVisible();

  // A wrong file is refused politely.
  await page.goto('/#/settings?tab=backup');
  await page.getByTestId('restore-input').setInputFiles({ name: 'notes.zip', mimeType: 'application/zip', buffer: Buffer.from('not a zip') });
  await expect(page.getByRole('alert').filter({ hasText: 'not a BoxTrack backup' })).toBeVisible();

  // Restore.
  await page.getByTestId('restore-input').setInputFiles(backup.path);
  await expect(page.getByTestId('restore-summary')).toContainText('1 plans · 11 boxes · 3 items · 1 photos');
  await page.getByRole('button', { name: 'Replace all my data' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace' }).click();
  await expect(page.getByTestId('restore-result')).toContainText('Restored 1 plans, 11 boxes, 3 items and 1 photos.');
  await page.getByRole('button', { name: 'Done' }).click();

  // Everything is back.
  await page.getByTestId('plan-card').click();
  await expect(page.getByTestId('box-row')).toHaveCount(11);
  await page.getByTestId('box-row').filter({ hasText: 'Pantry' }).click();
  await expect(page.getByTestId('item-row')).toHaveText([/Rice bags/, /Passport/, /Tea/]);
  await page.getByRole('radio', { name: 'Photos (1)' }).click();
  const thumb = page.getByTestId('photo-thumb').locator('img');
  await expect(thumb).toBeVisible();
  expect(await thumb.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(100);
  await expect(page.getByTestId('ocr-has-text')).toBeVisible();
  // Search index rebuilt: the photo text is searchable again.
  await page.goto('/#/search');
  await page.getByLabel('Search boxes').fill('masala');
  await expect(page.getByTestId('search-result').first()).toContainText('Pantry');
  expect(errors).toEqual([]);
});
