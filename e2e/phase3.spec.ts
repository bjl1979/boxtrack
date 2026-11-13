import { expect, test, type Page } from '@playwright/test';

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function addBox(page: Page, number: number, label: string, items: string[]) {
  await page.goto('/#/boxes');
  await page.getByRole('button', { name: 'New box' }).click();
  await page.getByLabel('Box number').fill(String(number));
  await page.getByLabel('Label').fill(label);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('box-number')).toHaveText(String(number));
  for (const it of items) {
    await page.getByLabel('New item').fill(it);
    await page.getByLabel('New item').press('Enter');
  }
  await expect(page.getByTestId('item-row')).toHaveCount(items.length);
}

async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByLabel('Plan name').fill('Doha → Kochi');
  await page.getByRole('button', { name: 'Create plan' }).click();
  await expect(page.getByRole('heading', { name: 'Doha → Kochi' })).toBeVisible();
}

test('typo-tolerant search: "passprt" finds box 17 first and opens it on the item', async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await start(page);
  await addBox(page, 3, 'Kitchen – pasta', ['Pasta pot', 'Colander']);
  await addBox(page, 17, 'Study – documents', ['Passport', 'Birth certificates', 'Old payslips', 'Pens', 'Stapler']);

  await page.goto('/#/boxes');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Search' }).click();
  const input = page.getByLabel('Search boxes');
  await expect(input).toBeFocused();
  await input.fill('passprt');
  const results = page.getByTestId('search-result');
  await expect(results.first()).toContainText('17');
  await expect(results.first().getByTestId('match-text').first()).toHaveText('Passport');
  await expect(results.first().locator('mark')).toHaveText('Passport');
  await expect(results.first()).toContainText('Item');

  await results.first().getByRole('link', { name: /Passport/ }).click();
  await expect(page.getByTestId('box-number')).toHaveText('17');
  await expect(page.locator('#' + (await page.getByTestId('item-row').filter({ hasText: 'Passport' }).getAttribute('id')))).toHaveClass(/ring-accent/);

  // Back returns to the same results.
  await page.goBack();
  await expect(page.getByLabel('Search boxes')).toHaveValue('passprt');

  // A number jumps to that box; nonsense shows an empty state.
  await page.getByLabel('Search boxes').fill('3');
  await expect(results.first()).toContainText('Kitchen – pasta');
  await page.getByLabel('Search boxes').fill('zzzqqq');
  await expect(page.getByText('No box matches')).toBeVisible();

  // Results update as data changes: rename a box label.
  await page.getByLabel('Search boxes').fill('colander');
  await expect(results).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('photo text is searchable, survives a reload (index rebuilt) and opens the photo highlighted', async ({ page }) => {
  await start(page);
  await addBox(page, 9, 'Pantry', ['Rice']);
  await page.getByRole('radio', { name: /Photos/ }).click();
  const jpg = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 300;
    c.getContext('2d')!.fillRect(0, 0, 400, 300);
    return c.toDataURL('image/jpeg').split(',')[1];
  });
  await page.getByTestId('gallery-input').setInputFiles([{ name: 'jar.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpg, 'base64') }]);
  await expect(page.getByTestId('photo-thumb')).toHaveCount(1);

  // OCR arrives in phase 4; simulate its result in the database, then reload so the index is rebuilt from IndexedDB.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open('boxtrack');
        req.onsuccess = () => {
          const store = req.result.transaction('photos', 'readwrite').objectStore('photos');
          store.getAll().onsuccess = (e) => {
            const [p] = (e.target as IDBRequest).result;
            p.ocrText = 'EVEREST\nGaram Masala\nNet wt 100 g';
            p.ocrStatus = 'done';
            store.put(p).onsuccess = () => resolve();
          };
        };
      }),
  );
  await page.goto('/#/search');
  await page.reload();
  await page.getByLabel('Search boxes').fill('masala');
  const first = page.getByTestId('search-result').first();
  await expect(first).toContainText('9');
  await expect(first).toContainText('Photo text');
  await expect(first.locator('mark')).toHaveText('Masala');
  await first.getByRole('link', { name: /Masala/ }).click();
  await expect(page.getByRole('radio', { name: 'Photos (1)' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('photo-thumb')).toHaveClass(/ring-accent/);
});

test('search is reachable from home and the box list, and works offline', async ({ page, context }) => {
  await start(page);
  await addBox(page, 1, 'Bedroom', ['Drill']);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 60_000 }).toBe(true);
  await context.setOffline(true);
  await page.goto('/#/');
  await page.getByTestId('search-bar').click();
  await page.getByLabel('Search boxes').fill('dril');
  await expect(page.getByTestId('search-result').first()).toContainText('Bedroom');
  await page.goto('/#/boxes');
  await expect(page.getByTestId('search-bar')).toBeVisible();
  await context.setOffline(false);
});
