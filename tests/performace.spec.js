// @ts-check
import { test, expect } from '@playwright/test';

test('captures navigation timing + resource counts', async ({ page }) => {
  await page.goto('/newest', { waitUntil: 'load' });

  const nav = await page.evaluate(() => {
    // Cast the single entry to PerformanceNavigationTiming.
    const entry =
      /** @type {PerformanceNavigationTiming | undefined} */
      (performance.getEntriesByType('navigation')[0]);

    if (!entry) return null;

    // Some fields (transferSize, encodedBodySize) aren’t on the base type in TS DOM libs.
    const e = /** @type {any} */ (entry);

    return {
      domContentLoaded: e.domContentLoadedEventEnd - e.startTime,
      load: e.loadEventEnd - e.startTime,
      transferSize: e.transferSize ?? 0,
      encodedBodySize: e.encodedBodySize ?? 0,
    };
  });

  expect(nav).not.toBeNull();

  const resources = await page.evaluate(() =>
    performance.getEntriesByType('resource').map(r => ({ name: r.name, duration: r.duration }))
  );
  expect(Array.isArray(resources)).toBeTruthy();

  // eslint-disable-next-line no-console
  console.log('Perf:', nav, 'resources:', resources.length);
});
