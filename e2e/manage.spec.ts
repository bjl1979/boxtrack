import { expect, test, type Page } from '@playwright/test';

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function planWithBoxes(page: Page, name: string, labels: string[]) {
  await page.goto('/#/');
  const start = page.getByRole('button', { name: 'Get started' });
  const more = page.getByRole('button', { name: '+ New plan' });
  await expect(start.or(more)).toBeVisible();
  if (await start.isVisible()) await start.click();
  else await more.click();
  await page.getByLabel('Plan name').fill(name);
  await page.getByRole('button', { name: 'Create plan' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  if (!labels.length) return;
  await page.getByRole('button', { name: 'New box' }).click();
  for (const [i, label] of labels.entries()) {
    await page.getByLabel('Label', { exact: true }).fill(label);
    await page.getByRole('button', { name: 'Save & next box' }).click();
    await expect(page.getByText(`Box ${i + 1} saved`)).toBeVisible();
  }
}

test('delete several boxes at once from Select mode', async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await planWithBoxes(page, 'Doha → Kochi', ['Kitchen', 'Books', 'Toys', 'Tools']);
  await page.goto('/#/boxes');
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.getByRole('checkbox', { name: /^Box 2 / }).click();
  await page.getByRole('checkbox', { name: /^Box 3 / }).click();
  await page.getByRole('button', { name: 'Delete 2 boxes…' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('Delete 2 boxes?');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('2 boxes deleted')).toBeVisible();
  await expect(page.getByTestId('box-row')).toHaveText([/Kitchen/, /Tools/]);
  // Search no longer finds them.
  await page.goto('/#/search');
  await page.getByLabel('Search boxes').fill('books');
  await expect(page.getByText('No box matches')).toBeVisible();
  expect(errors).toEqual([]);
});

test('delete a whole plan (asks twice); another plan becomes active', async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await planWithBoxes(page, 'Keep this', ['Stays']);
  await planWithBoxes(page, 'Old storage', ['Goes 1', 'Goes 2']);
  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'Delete plan Old storage' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('Its 2 boxes with all items and photos will be deleted');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('Are you absolutely sure?');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete plan' }).click();
  await expect(page.getByTestId('move-card')).toHaveCount(1);
  await expect(page.getByTestId('move-card')).toContainText('Keep this');
  await expect(page.getByTestId('move-card')).toContainText('Active');
  await page.goto('/#/boxes');
  await expect(page.getByTestId('box-row')).toHaveText([/Stays/]);

  // Cancelling keeps the plan.
  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'Delete plan Keep this' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByTestId('move-card')).toHaveCount(1);

  // Deleting the last plan returns to the start screen.
  await page.getByRole('button', { name: 'Delete plan Keep this' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete plan' }).click();
  await expect(page.getByRole('button', { name: 'Get started' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('About & updates shows the version and checks for updates', async ({ page }) => {
  await planWithBoxes(page, 'Any', []);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 60_000 }).toBe(true);
  await page.goto('/#/settings?tab=lists');
  await expect(page.getByTestId('app-version')).toContainText(/BoxTrack \d+\.\d+\.\d+ · build \w+/);
  await page.getByRole('button', { name: 'Check for updates' }).click();
  await expect(page.getByTestId('update-result')).toHaveText('You have the latest version.');
});
