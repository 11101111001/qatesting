// tests/newcomments.spec.js
import { test, expect } from '@playwright/test';

test.describe('New Comments page', () => {
  test('/newcomments shows recent comments with user + age + text', async ({ page }) => {
    // Be generous for slower networks / WSL
    test.setTimeout(45_000);

    await page.goto('https://news.ycombinator.com/newcomments', {
      waitUntil: 'domcontentloaded',
    });

    // HN renders each comment header as <tr class="athing"> with the body in the SAME row:
    // <td class="default"><div class="comment"><div class="commtext ...">TEXT</div>
    // Wait until at least one actual comment body is visible.
    const bodies = page.locator('tr.athing td.default .comment .commtext');
    await expect(
      bodies.first(),
      'At least one comment body should be visible'
    ).toBeVisible({ timeout: 20_000 });

    // Now only consider rows that truly contain a comment body.
    const rows = page
      .locator('tr.athing')
      .filter({ has: page.locator('td.default .comment .commtext') });

    const total = await rows.count();
    expect(total, 'Expected several comments on /newcomments').toBeGreaterThan(5);

    // Validate the first few rows strictly.
    const sample = Math.min(total, 8);
    for (let i = 0; i < sample; i++) {
      const row  = rows.nth(i);
      const user = row.locator('a.hnuser').first();
      const age  = row.locator('span.age a').first();
      const body = row.locator('td.default .comment .commtext').first();

      await expect(user, `row[${i}] username visible`).toBeVisible({ timeout: 15_000 });
      await expect(age,  `row[${i}] age link visible`).toBeVisible({ timeout: 15_000 });
      await expect(body, `row[${i}] body visible`).toBeVisible({ timeout: 15_000 });
      await expect(body, `row[${i}] body non-empty`).toHaveText(/\S/);
    }

    // Pagination sanity: "More" link should exist.
    const more = page.locator('a.morelink[rel="next"]').first();
    await expect(more, '"More" link visible').toBeVisible({ timeout: 15_000 });
  });
});
