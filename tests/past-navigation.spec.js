// tests/past-navigation.spec.js
import { test, expect } from '@playwright/test';

test.describe('Past days navigation', () => {
  test('/front → pick a day and see items', async ({ page }) => {
    test.setTimeout(45_000);

    await page.goto('https://news.ycombinator.com/front', { waitUntil: 'domcontentloaded' });

    // Day links look like: <a href="front?day=YYYY-MM-DD">YYYY-MM-DD</a>
    const dayLink = page.locator('a[href^="front?day="]').first();
    await expect(
      dayLink,
      'A past day link should be visible on /front'
    ).toBeVisible({ timeout: 20_000 });

    // Click to a specific day and wait for DOM to load.
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      dayLink.click(),
    ]);

    await expect(page, 'URL should include a front?day= param').toHaveURL(/front\?day=/i);

    // Be flexible: just assert that story rows appear; no strict table class assumptions.
    // HN story rows use <tr class="athing"> with a .titleline inside the adjacent/meta structure.
    await page.waitForTimeout(200); // tiny settle time
    const rows = page.locator('tr.athing');
    await expect(rows.first(), 'At least one item row should be visible').toBeVisible({ timeout: 20_000 });

    // Spot-check the first few rows contain a clickable title link.
    const sample = Math.min(await rows.count(), 10);
    for (let i = 0; i < sample; i++) {
      const row = rows.nth(i);
      const title = row.locator('.titleline a, a.storylink').first();
      await expect(title, `row[${i}] title link visible`).toBeVisible({ timeout: 10_000 });
      await expect(title, `row[${i}] title link non-empty`).toHaveText(/\S/);
    }

    // "More" should exist to paginate within the day view.
    const more = page.getByRole('link', { name: /^More$/ }).first()
      .or(page.locator('a.morelink[rel="next"]').first());
    await expect(more, '"More" link visible on day').toBeVisible({ timeout: 15_000 });
  });
});
