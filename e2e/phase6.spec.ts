import { expect, test, type Page } from '@playwright/test';
import { describeCamera, installFakeCamera, pointCameraAtLabel } from './camera';

test.beforeEach(async ({ page }) => installFakeCamera(page));

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('moving day: bulk ship, delivery check by tap and by scan, missing list, unpacking', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackConsoleErrors(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByLabel('Plan name').fill('Doha → Kochi');
  await page.getByRole('button', { name: 'Create plan' }).click();

  // Boxes 1–6; box 1 is "open first".
  const rooms = ['Kitchen', 'Study', 'Kitchen', 'Living', 'Study', 'Garage'];
  await page.getByRole('button', { name: 'New box' }).click();
  for (let n = 1; n <= 6; n++) {
    await page.getByLabel('Label', { exact: true }).fill(`Box ${n} stuff`);
    const room = page.getByRole('group', { name: 'To room' }).getByRole('button', { name: rooms[n - 1], exact: true });
    if ((await room.getAttribute('aria-pressed')) !== 'true') await room.click();
    if (n === 1) await page.getByRole('button', { name: /Open first/ }).click();
    await page.getByRole('button', { name: 'Save & next box' }).click();
    await expect(page.getByText(`Box ${n} saved`)).toBeVisible();
  }

  // Bulk: select boxes 1–5 and set them to Shipped.
  await page.goto('/#/boxes');
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  for (let n = 1; n <= 5; n++) await page.getByRole('checkbox', { name: new RegExp(`^Box ${n} `) }).click();
  await expect(page.getByTestId('selected-count')).toHaveText('5 selected');
  await page.getByRole('region', { name: 'Change status of selected boxes' }).getByRole('button', { name: 'Shipped', exact: true }).click();
  await expect(page.getByText('5 boxes → Shipped')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Change status of selected boxes' })).toBeHidden();

  // "Missing" shows the shipped boxes.
  await page.getByRole('button', { name: '5 Missing, show them' }).click();
  await expect(page.getByTestId('box-row')).toHaveCount(5);
  await page.getByRole('button', { name: 'Clear' }).click();

  // Get label 3's QR (as printed) for the camera.
  await page.goto('/#/labels');
  await expect(page.locator('[data-number="3"] .label-qr svg')).toBeVisible();
  await pointCameraAtLabel(page, 3);

  // Delivery check.
  await page.goto('/#/boxes');
  await page.getByRole('link', { name: /Moving day/ }).click();
  await expect(page.getByRole('radio', { name: 'Delivery check (5)' })).toBeVisible();
  await expect(page.getByTestId('delivery-progress')).toContainText('0 of 6 arrived');
  await expect(page.getByTestId('missing-box')).toHaveCount(5);

  // Tap: box 1 arrived, undo, then arrived again.
  await page.getByRole('button', { name: 'Box 1 arrived' }).click();
  await expect(page.getByText('Box 1 arrived ✓')).toBeVisible();
  await expect(page.getByTestId('missing-box')).toHaveCount(4);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('missing-box')).toHaveCount(5);
  await page.getByRole('button', { name: 'Box 1 arrived' }).click();
  await expect(page.getByTestId('missing-box')).toHaveCount(4);

  // Scan: box 3 comes off the truck.
  await page.getByRole('button', { name: 'Scan boxes as they arrive' }).click();
  try {
    await expect(page.getByText('Box 3 arrived ✓')).toBeVisible({ timeout: 30_000 });
  } catch (e) {
    console.log('CAMDEBUG', await describeCamera(page, test.info().outputPath('frame.png')));
    throw e;
  }
  await expect(page.getByTestId('missing-box')).toHaveCount(3);
  await expect(page.getByTestId('missing-box')).toHaveText([/Box 2 stuff/, /Box 4 stuff/, /Box 5 stuff/]);
  // Seeing the same label again does not change anything.
  await expect(page.getByRole('status').filter({ hasText: 'Box 3 has already arrived' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Stop scanning' }).click();
  await expect(page.getByTestId('delivery-progress')).toContainText('2 of 6 arrived');
  await expect(page.getByTestId('delivery-progress')).toContainText('3 missing');

  // Box 6 was never marked shipped but turns up anyway.
  await page.getByTestId('not-shipped-toggle').click();
  await page.getByRole('button', { name: 'Box 6 arrived' }).click();
  await expect(page.getByTestId('delivery-progress')).toContainText('3 of 6 arrived');
  await page.getByTestId('arrived-toggle').click();
  await expect(page.getByTestId('arrived-box')).toHaveCount(3);

  // Unpacking: "open first" box 1 is at the top.
  await page.getByRole('radio', { name: 'Unpacking' }).click();
  await expect(page.getByTestId('unpack-box')).toHaveCount(3);
  await expect(page.getByTestId('unpack-box').first()).toHaveAttribute('data-number', '1');
  await page.getByRole('button', { name: 'Box 1 emptied' }).click();
  await expect(page.getByText('Box 1 unpacked ✓')).toBeVisible();
  await expect(page.getByTestId('unpack-box')).toHaveCount(2);
  await page.getByTestId('unpacked-toggle').click();
  await expect(page.getByTestId('unpacked-box')).toHaveCount(1);

  // The summary on the box list agrees.
  await page.goto('/#/boxes');
  await expect(page.getByRole('button', { name: '3 Missing, show them' })).toBeVisible();
  expect(errors).toEqual([]);
});
