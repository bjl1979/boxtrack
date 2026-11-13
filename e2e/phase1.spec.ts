import { expect, test, type Page } from '@playwright/test';

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function startMove(page: Page, name = 'Doha → Kochi') {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Start your first move' })).toBeVisible();
  await page.getByLabel('Move name').fill(name);
  await page.getByRole('button', { name: 'Start packing' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

test('create a move, add boxes with "Save & next", edit, filter and delete', async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await startMove(page);
  await expect(page.getByText('No boxes yet')).toBeVisible();

  // New box: number pre-filled with 1.
  await page.getByRole('button', { name: 'New box' }).click();
  await expect(page.getByLabel('Box number')).toHaveValue('1');
  await page.getByLabel('Label').fill('Kitchen – plates');
  await page.getByRole('group', { name: 'To room' }).getByRole('button', { name: 'Kitchen' }).click();
  await page.getByRole('button', { name: /Fragile/ }).click();
  await page.getByRole('button', { name: 'Save & next box' }).click();

  // Ready for the next box, rooms kept.
  await expect(page.getByText('Box 1 saved')).toBeVisible();
  await expect(page.getByLabel('Box number')).toHaveValue('2');
  await expect(page.getByLabel('Label')).toHaveValue('');
  await expect(page.getByRole('group', { name: 'To room' }).getByRole('button', { name: 'Kitchen' })).toHaveAttribute('aria-pressed', 'true');

  // Duplicate numbers are blocked.
  await page.getByLabel('Box number').fill('1');
  await expect(page.getByText('Box 1 already exists in this move')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();

  await page.getByLabel('Box number').fill('17');
  await page.getByLabel('Label').fill('Study – books');
  await page.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'Books' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  // Box detail.
  await expect(page.getByTestId('box-number')).toHaveText('17');
  await expect(page.getByText('Study – books')).toBeVisible();
  await page.getByRole('button', { name: 'Shipped' }).click();
  await expect(page.getByRole('button', { name: 'Shipped' })).toHaveAttribute('aria-pressed', 'true');

  // Edit.
  await page.getByRole('link', { name: 'Edit box' }).click();
  await page.getByLabel('Label').fill('Study – novels');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Study – novels')).toBeVisible();

  // List + summary.
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByTestId('box-row')).toHaveCount(2);
  await expect(page.getByTestId('total-boxes')).toHaveText('2');

  // Filter by status chip.
  await page.getByRole('button', { name: /Shipped: 1/ }).click();
  await expect(page.getByTestId('box-row')).toHaveCount(1);
  await expect(page.getByTestId('box-row')).toContainText('Study – novels');
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.getByTestId('box-row')).toHaveCount(2);

  // Next free number continues after the highest.
  await page.getByRole('button', { name: 'New box' }).click();
  await expect(page.getByLabel('Box number')).toHaveValue('18');
  await page.getByRole('button', { name: 'Back' }).click();

  // Delete.
  await page.getByTestId('box-row').filter({ hasText: 'Kitchen – plates' }).click();
  await page.getByRole('button', { name: 'Delete box' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByTestId('box-row')).toHaveCount(1);

  expect(errors).toEqual([]);
});

test('manage moves in settings', async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await startMove(page, 'First move');
  await page.getByRole('link', { name: 'Settings' }).first().click();
  await page.getByRole('button', { name: '+ New move' }).click();
  await page.getByLabel('Move name').fill('Second move');
  await page.getByRole('button', { name: 'Create and switch to it' }).click();
  await expect(page.getByTestId('move-card')).toHaveCount(2);
  await expect(page.getByTestId('move-card').filter({ hasText: 'Second move' })).toContainText('Active');

  // Edit room list.
  await page.getByRole('radio', { name: 'Rooms & tags' }).click();
  await page.getByLabel('New room').fill('Loft');
  await page.getByRole('button', { name: 'Add' }).first().click();
  await expect(page.getByRole('list', { name: 'Rooms' })).toContainText('Loft');

  await page.getByRole('link', { name: 'Boxes' }).click();
  await expect(page.getByRole('heading', { name: 'Second move' })).toBeVisible();
  await page.getByRole('button', { name: 'New box' }).click();
  await expect(page.getByRole('group', { name: 'To room' }).getByRole('button', { name: 'Loft' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('works offline once the service worker is installed', async ({ page, context }) => {
  await startMove(page, 'Offline move');
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  // Make sure the page is controlled by the SW before going offline.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Offline move' })).toBeVisible();
  await page.getByRole('button', { name: 'New box' }).click();
  await page.getByLabel('Label').fill('Packed offline');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('box-number')).toHaveText('1');
  await page.reload();
  await expect(page.getByText('Packed offline')).toBeVisible();
  await context.setOffline(false);
});

test('manifest is installable', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = await (await request.get(href!)).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
});
