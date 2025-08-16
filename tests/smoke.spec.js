// tests/smoke.spec.js
import { test, expect } from '@playwright/test';

/* -----------------------------------------------------------------------------
 File: tests/smoke.spec.js

 What this runs
 - Basic “is it up?” checks and simple pagination sanity.

 Key assertions
 - /newest loads and URL matches.
 - Top-left “Hacker News” link is visible.
 - Clicking “More” changes the first row’s id (pagination worked).

 How to run (single file)
   npx playwright test tests/smoke.spec.js
 ----------------------------------------------------------------------------- */

test.describe('Smoke: top bar + basic navigation', () => {
  test('top bar links and branding render', async ({ page }) => {
    await page.goto('https://news.ycombinator.com/newest', { waitUntil: 'domcontentloaded' });

    // Brand link
    await expect(page.getByRole('link', { name: 'Hacker News' })).toBeVisible();

    // Primary nav (links can be small-caps; verify by text)
    const navLabels = ['new', 'past', 'comments', 'ask', 'show', 'jobs', 'submit'];
    for (const label of navLabels) {
      await expect(page.getByRole('link', { name: new RegExp(`^${label}$`, 'i') })).toBeVisible();
    }

    // Login or user link visible (depending on auth)
    const loginOrUser = page.getByRole('link', { name: /login|logout/i });
    await expect(loginOrUser).toBeVisible();
  });

  test('"More" pagination is present and works on Newest', async ({ page }) => {
    await page.goto('https://news.ycombinator.com/newest', { waitUntil: 'domcontentloaded' });

    const firstRow = page.locator('tr.athing').first();
    await expect(firstRow).toBeVisible();

    const more = page.locator('a.morelink[rel="next"]');
    await expect(more).toBeVisible();
    const firstId = await firstRow.getAttribute('id');

    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      more.click(),
    ]);

    await expect(page).toHaveURL(/\/newest\?p=\d+/);

    const newFirstId = await page.locator('tr.athing').first().getAttribute('id');
    expect(newFirstId, 'First row should change when paginating').not.toBe(firstId);
  });
});
