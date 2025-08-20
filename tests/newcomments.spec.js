// tests/newcomments.spec.js
import { test, expect } from '@playwright/test';

/**
 * /newcomments should list recent comments with username, age, and text.
 */

test.describe('New Comments page', () => {
  test('/newcomments shows recent comments with user + age + text', async ({ page }) => {
    await page.goto('/newcomments', { waitUntil: 'domcontentloaded' });

    const rows = page.locator('tr.comtr');
    await expect(rows.first(), 'At least one comment row should be visible').toBeVisible();

    const take = Math.min(await rows.count(), 10);
    for (let i = 0; i < take; i++) {
      const row = rows.nth(i);

      // Username
      const user = row.locator('a.hnuser').first();
      await expect(user, `row[${i}] username should be visible`).toBeVisible();

      // Age link
      const age = row.locator('span.age a').first();
      await expect(age, `row[${i}] age link should be visible`).toBeVisible();

      // Comment text (commtext usually within .comment)
      const text = row.locator('.comment .commtext').first();
      await expect(text, `row[${i}] comment text should be visible`).toBeVisible();
      await expect(text, `row[${i}] comment text should not be empty`).toContainText(/.+/);
    }
  });
});
