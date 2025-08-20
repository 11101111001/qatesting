// tests/host-badges.spec.js
import { test, expect } from '@playwright/test';

/**
 * On /newest, many external posts should show a small host/domain badge
 * near the title (e.g., "(example.com)").
 */
test.describe('Host/domain badges on Newest', () => {
  test('a reasonable number of host badges are visible', async ({ page }) => {
    await page.goto('/newest', { waitUntil: 'domcontentloaded' });

    const rows = page.locator('tr.athing');
    await expect(rows.first(), 'At least one story row should be visible').toBeVisible();

    const take = Math.min(await rows.count(), 30);
    let withHost = 0;

    for (let i = 0; i < take; i++) {
      const row = rows.nth(i);
      // Common markup is a span with "sitebit" (domain) near the title.
      const host = row.locator('span.sitebit, span.comhead .sitebit').first();
      if (await host.isVisible().catch(() => false)) withHost++;
    }

    // Expect at least a handful to show domains; internal Ask/Show HN won't.
    expect(withHost, `Expected some host badges among first ${take} stories`).toBeGreaterThanOrEqual(5);
  });
});
