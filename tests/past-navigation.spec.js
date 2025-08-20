// tests/past-navigation.spec.js
import { test, expect } from '@playwright/test';

/**
 * /front shows past day links. Clicking a day should show a list of items.
 */

test.describe('Past days navigation', () => {
  test('/front → pick a day and see items', async ({ page }) => {
    await page.goto('/front', { waitUntil: 'domcontentloaded' });

    // Find a link like /front?day=YYYY-MM-DD
    const dayLink = page.locator('a[href*="front?day="]').first();
    await expect(dayLink, 'A day link should be visible on /front').toBeVisible();

    const href = await dayLink.getAttribute('href');
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      dayLink.click(),
    ]);

    await expect(page, 'URL should contain a day parameter').toHaveURL(/front\?day=/i);

    // Item list renders
    const table = page.locator('table.itemlist');
    await expect(table, 'Past day item table should be visible').toBeVisible();

    const rows = table.locator('tr.athing');
    await expect(rows.first(), 'At least one story row should be visible for that day').toBeVisible();
  });
});
