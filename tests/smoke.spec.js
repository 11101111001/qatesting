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
    await page.goto('/newest', { waitUntil: 'domcontentloaded' });

    const topbar = page.locator('span.pagetop');
    await expect(topbar.getByRole('link', { name: /^hacker news$/i }).first()).toBeVisible();
    await expect(topbar.getByRole('link', { name: /^new$/i }).first()).toBeVisible();
    await expect(topbar.getByRole('link', { name: /^past$/i }).first()).toBeVisible();
    await expect(topbar.getByRole('link', { name: /^comments$/i }).first()).toBeVisible();
    await expect(topbar.getByRole('link', { name: /^ask$/i }).first()).toBeVisible();
    await expect(topbar.getByRole('link', { name: /^show$/i }).first()).toBeVisible();
    await expect(topbar.getByRole('link', { name: /^jobs$/i }).first()).toBeVisible();
    await expect(topbar.getByRole('link', { name: /^submit$/i }).first()).toBeVisible();

    // Login or user link visible (depending on auth)
    const loginOrUser = page.getByRole('link', { name: /login|logout/i });
    await expect(loginOrUser).toBeVisible();
  });

  test('"More" pagination is present and works on Newest', async ({ page }) => {
    await page.goto('/newest', { waitUntil: 'domcontentloaded' });

    const firstRow = page.locator('tr.athing').first();
    await expect(firstRow).toBeVisible();
    const firstId = await firstRow.getAttribute('id');

    const more = page.locator('a.morelink[rel="next"], a.morelink'); // be lenient
    await expect(more.first()).toBeVisible();

    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      more.first().click(),
    ]);

    await expect(page).toHaveURL(/\/newest\b/);

    const newFirstId = await page.locator('tr.athing').first().getAttribute('id');
    expect(newFirstId).not.toBe(firstId);
  });
});
