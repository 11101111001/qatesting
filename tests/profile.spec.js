// tests/profile.spec.js
import { test, expect } from '@playwright/test';

/**
 * Profile coverage for a **known** active user (default: "dang").
 * You *can* change USER, but if that user has no submissions, the submissions
 * test will fail by design (we’re asserting real content exists).
 *
 * Tip: override with env var: HN_TEST_USER=dangus
 */

const USER = process.env.HN_TEST_USER || 'dang';
const BASE = 'https://news.ycombinator.com';

test.describe('User profile + related pages', () => {
  test('profile: core fields + navigation links render', async ({ page }) => {
    await page.goto(`${BASE}/user?id=${USER}`, { waitUntil: 'domcontentloaded' });

    const profileTable = page.locator('#hnmain table').filter({ hasText: /^user:/i }).first();
    await expect(profileTable, 'Profile table should be visible').toBeVisible();

    await expect(
      profileTable.getByText(new RegExp(`^user:\\s*${USER}$`, 'i')),
      'User row should show correct username'
    ).toBeVisible();

    await expect(profileTable.getByText(/^created:/i), 'Created date visible').toBeVisible();
    await expect(profileTable.getByText(/^karma:/i), 'Karma value visible').toBeVisible();

    await expect(profileTable.locator(`a[href^="submitted?id=${USER}"]`), '"submissions" link visible').toBeVisible();
    await expect(profileTable.locator(`a[href^="threads?id=${USER}"]`), '"comments" link visible').toBeVisible();
    await expect(profileTable.locator(`a[href^="favorites?id=${USER}"]`), '"favorites" link visible').toBeVisible();
  });

  test('submissions: shows an item list', async ({ page }) => {
    await page.goto(`${BASE}/submitted?id=${USER}`, { waitUntil: 'domcontentloaded' });

    // Assert **real content exists** for this user.
    const rows = page.locator('table >> tr.athing');
    await expect(
      rows.first(),
      `At least one submitted story row should be visible for "${USER}". ` +
      `If this user has no submissions, set HN_TEST_USER to one that does (e.g. "dang").`
    ).toBeVisible({ timeout: 10000 });

    const firstTitle = page.locator('tr.athing .titleline a').first();
    await expect(firstTitle, 'First submission should have a title link').toBeVisible();
  });

  test('comments: shows comment rows/snippets', async ({ page }) => {
    await page.goto(`${BASE}/threads?id=${USER}`, { waitUntil: 'domcontentloaded' });

    const anyCommentRow = page.locator('tr.comtr, tr.athing.comtr').first();
    const anyCommentText = page.locator('span.commtext, div.comment').first();

    await expect(anyCommentRow, 'First comment row visible').toBeVisible();
    await expect(anyCommentText, 'Comment snippet/body visible').toBeVisible();
  });

  test('favorites: page loads and shows content or a valid empty state', async ({ page }) => {
    await page.goto(`${BASE}/favorites?id=${USER}`, { waitUntil: 'domcontentloaded' });

    const main = page.locator('#hnmain');
    await expect(main, 'Main container should exist').toBeVisible();

    const table = page.locator('table.itemlist');
    if (await table.count()) {
      await expect(table, 'Favorites list table visible').toBeVisible();
    } else {
      await expect(
        main,
        'Either a table or an empty-state message should render'
      ).toContainText(/favorite|no submissions|no comments|lists/i);
    }
  });
});
