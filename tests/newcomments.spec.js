// tests/newcomments.spec.js
import { test, expect } from '@playwright/test';

test.describe('New Comments page', () => {
  test('/newcomments shows recent comments with user + age + text', async ({ page }) => {
    await page.goto('https://news.ycombinator.com/newcomments', {
      waitUntil: 'domcontentloaded',
    });
    
    const rows = page
      .locator('tr.athing')
      .filter({ has: page.locator('td.default .comment .commtext') });

    await expect(
      rows.first(),
      'At least one comment row with a visible body should be present'
    ).toBeVisible({ timeout: 10_000 });

    const total = await rows.count();
    expect(total, 'Expected several comments on /newcomments').toBeGreaterThan(5);

    // Validate the first few thoroughly
    const sample = Math.min(total, 8);
    for (let i = 0; i < sample; i++) {
      const row = rows.nth(i);

      const user = row.locator('a.hnuser').first();              // e.g., <a class="hnuser">Gud</a>
      const age  = row.locator('span.age a').first();             // e.g., <a href="item?id=...">0 minutes ago</a>
      const body = row.locator('td.default .comment .commtext').first();

      await expect(user, `row[${i}] username visible`).toBeVisible();
      await expect(age,  `row[${i}] age link visible`).toBeVisible();
      await expect(body, `row[${i}] comment body visible`).toBeVisible();
      await expect(body, `row[${i}] comment body non-empty`).toHaveText(/\S/);
    }

    // Pagination: "More" link at the bottom
    const more = page.locator('a.morelink[rel="next"]').first();
    await expect(more, '"More" link visible').toBeVisible();
  });
});
