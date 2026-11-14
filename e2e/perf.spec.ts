import { expect, test, type Page } from '@playwright/test';

/**
 * Performance check from the spec: 300 boxes and 1,500 photos, with the CPU slowed 4× to roughly a
 * mid-range Android phone. Run with `npm run perf` (not part of the normal E2E run).
 */
test.describe.configure({ mode: 'serial' });
test.setTimeout(600_000);

async function seed(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByLabel('Plan name').fill('Big move');
  await page.getByRole('button', { name: 'Create plan' }).click();
  await expect(page.getByRole('heading', { name: 'Big move' })).toBeVisible();
  await page.evaluate(async () => {
    const jpeg = async (w: number, h: number, q: number) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d')!;
      for (let i = 0; i < 60; i++) {
        g.fillStyle = `hsl(${(i * 37) % 360} 50% ${30 + (i % 5) * 10}%)`;
        g.fillRect(Math.random() * w, Math.random() * h, w / 4, h / 4);
      }
      return new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', q));
    };
    const full = await jpeg(1600, 1200, 0.75);
    const thumb = await jpeg(300, 225, 0.7);
    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open('boxtrack');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const moveId: string = await new Promise((res) => {
      db.transaction('moves').objectStore('moves').getAll().onsuccess = (e) => res((e.target as IDBRequest).result[0].id);
    });
    const rooms = ['Kitchen', 'Master Bedroom', 'Kids Room', 'Living', 'Study', 'Bathroom', 'Store', 'Garage'];
    const statuses = ['packing', 'packed', 'shipped', 'delivered', 'unpacked'];
    const words = ['Plates', 'Mugs', 'Books', 'Cables', 'Towels', 'Shoes', 'Toys', 'Tools', 'Lamp', 'Passport', 'Jackets', 'Pans'];
    const tx = db.transaction(['boxes', 'items', 'photos'], 'readwrite');
    const now = Date.now();
    for (let n = 1; n <= 300; n++) {
      const boxId = `perf-box-${n}`;
      tx.objectStore('boxes').put({
        id: boxId,
        moveId,
        number: n,
        label: `${rooms[n % rooms.length]} box ${n}`,
        toRoom: rooms[n % rooms.length],
        category: 'Misc',
        flags: { fragile: n % 7 === 0, priority: n % 11 === 0, valuable: false, thisSideUp: false },
        status: statuses[n % statuses.length],
        createdAt: now - n * 1000,
        updatedAt: now - n * 1000,
      });
      for (let i = 0; i < 5; i++) {
        tx.objectStore('items').put({ id: `perf-item-${n}-${i}`, boxId, name: `${words[(n + i) % words.length]} ${n}-${i}`, quantity: 1 + (i % 3), position: i, createdAt: now });
        tx.objectStore('photos').put({
          id: `perf-photo-${n}-${i}`,
          boxId,
          kind: i === 0 ? 'outside' : 'contents',
          blob: full,
          thumbBlob: thumb,
          width: 1600,
          height: 1200,
          createdAt: now + i,
          ocrStatus: i === 0 ? 'skipped' : 'done',
          ...(i === 0 ? {} : { ocrText: `LABEL ${words[(n * i) % words.length].toUpperCase()} ${n}` }),
        });
      }
    }
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  });
}

test('300 boxes and 1,500 photos stay fast at phone speed', async ({ page }) => {
  await seed(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    (window as unknown as { __long: number[] }).__long = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (window as unknown as { __long: number[] }).__long.push(Math.round(e.duration)))).observe({
      type: 'longtask',
      buffered: true,
    });
  });
  const results: Record<string, string | number> = {};

  // Cold start to the plans screen (a real reload: the data was written underneath the app).
  await page.goto('/#/');
  let t = Date.now();
  await page.reload();
  await expect(page.getByTestId('plan-card')).toContainText('300 box');
  results['start → plans screen (ms)'] = Date.now() - t;

  // Box list with 300 rows.
  t = Date.now();
  await page.goto('/#/boxes');
  await expect(page.getByTestId('box-row')).toHaveCount(300, { timeout: 30_000 });
  results['box list, 300 rows (ms)'] = Date.now() - t;
  await page.waitForTimeout(1500);

  // Scroll through the whole list; record long tasks (>50 ms) while scrolling.
  await page.evaluate(() => ((window as unknown as { __long: number[] }).__long = []));
  t = Date.now();
  for (let y = 0; y < 300 * 150; y += 600) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(16);
  }
  results['scroll whole list (ms)'] = Date.now() - t;
  const long = await page.evaluate(() => (window as unknown as { __long: number[] }).__long);
  results['long tasks while scrolling'] = long.length;
  results['longest task while scrolling (ms)'] = Math.max(0, ...long);
  results['thumbnails loaded'] = await page.locator('[data-testid="box-row"] img').count();

  // Search (index built from IndexedDB at start-up).
  await page.goto('/#/search');
  t = Date.now();
  await page.getByLabel('Search boxes').fill('passprt');
  await expect(page.getByTestId('search-result').first()).toBeVisible();
  results['search "passprt" (ms)'] = Date.now() - t;
  t = Date.now();
  await page.getByLabel('Search boxes').fill('jackets');
  await expect(page.getByTestId('search-result').first()).toBeVisible();
  results['search "jackets" (ms)'] = Date.now() - t;

  // A box with 5 photos.
  t = Date.now();
  await page.goto('/#/boxes/perf-box-150?tab=photos');
  await expect(page.getByTestId('photo-thumb')).toHaveCount(5);
  results['open box with 5 photos (ms)'] = Date.now() - t;

  const mem = await cdp.send('Runtime.getHeapUsage');
  results['JS heap used (MB)'] = Math.round(mem.usedSize / 1e6);
  console.log('PERF RESULTS\n' + Object.entries(results).map(([k, v]) => `  ${k.padEnd(38)} ${v}`).join('\n'));

  // Budgets (4× slower CPU).
  expect(results['box list, 300 rows (ms)'] as number).toBeLessThan(4000);
  expect(results['longest task while scrolling (ms)'] as number).toBeLessThan(250);
  expect(results['search "passprt" (ms)'] as number).toBeLessThan(1500);
});
