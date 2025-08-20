// tests/past-navigation.spec.js
import { test, expect } from '@playwright/test';

test.describe('Past days navigation', () => {
  test('/front → pick a day and see items', async ({ page }) => {
    await page.goto('https://news.ycombinator.com/front', {
      waitUntil: 'domcontentloaded',
    });

    // Find a day link like /front?day=YYYY-MM-DD and click it.
    const dayLink = page.locator('a[href^="front?day="]').first();
    await expect(dayLink, 'Past day link should be visible').toBeVisible({ timeout: 10_000 });

    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      dayLink.click(),
    ]);

    await expect(page, 'URL should include selected day').toHaveURL(/front\?day=/);

    // Day page should show a table with story rows.
    const table = page.locator('table').filter({ has: page.locator('tr.athing') }).first();
    await expect(table, 'Past day item table should be visible').toBeVisible({ timeout: 10_000 });

    const rows = table.locator('tr.athing');
    await expect(
      rows.first(),
      'At least one story row should be visible on the day page'
    ).toBeVisible();
  });
});
