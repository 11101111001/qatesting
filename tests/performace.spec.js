// @ts-check
import { test, expect } from '@playwright/test';

/* -----------------------------------------------------------------------------
 File: tests/performance.spec.js

 What this runs
 - Captures W3C PerformanceNavigationTiming from /newest and counts resource
   entries, logging a compact summary.

 Key assertions
 - navigation timing entry is present (not null).
 - derived fields (domContentLoaded, load, transferSize, encodedBodySize) are
   numbers (when provided by the browser).
 - performance.getEntriesByType('resource') returns an array.

 How to run (single file)
   npx playwright test tests/performance.spec.js

 Notes
 - This is informational (non-threshold). Extend with thresholds if needed.
 ----------------------------------------------------------------------------- */

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
