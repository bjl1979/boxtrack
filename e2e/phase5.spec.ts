import { expect, test, type Page } from '@playwright/test';
import { describeCamera, installFakeCamera, pointCameraAtLabel } from './camera';

test.beforeEach(async ({ page }) => installFakeCamera(page));

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
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
  await expect(label12.locator('[data-qr]')).toHaveAttribute('data-qr', /^BOXTRACK:\/\/MOVE\/[0-9A-F-]+\/BOX\/12$/);

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
  await pointCameraAtLabel(page, 12);
  await page.goto('/#/boxes');
  await page.getByRole('link', { name: 'Scan label' }).click();
  await expect(page.getByRole('dialog', { name: 'Scan box label' })).toBeVisible();
  try {
    await expect(page.getByTestId('box-number')).toHaveText('12', { timeout: 30_000 });
  } catch (e) {
    console.log('CAMDEBUG', await describeCamera(page, test.info().outputPath('frame.png')));
    throw e;
  }
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
