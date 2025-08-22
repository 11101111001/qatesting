// tests/smoke.spec.js
import { test, expect } from '@playwright/test';

const BASE = 'https://news.ycombinator.com';

test.describe('Smoke: top bar + basic navigation', () => {
  test('top bar links and branding render', async ({ page }) => {
    await page.goto(`${BASE}/news`, { waitUntil: 'domcontentloaded' });

    // Scope to the top navigation row to avoid strict-mode multi-matches
    const topbar = page.locator('#hnmain tr').first();

    // Branding
    const brand = topbar.getByRole('link', { name: /^Hacker News$/i }).first();
    await expect(brand).toBeVisible();

    // Common top bar links (existence/visibility only)
    for (const name of ['new', 'past', 'comments', 'ask', 'show', 'jobs', 'submit']) {
      const link = topbar.getByRole('link', { name: new RegExp(`^${name}$`, 'i') }).first();
      await expect(link, `"${name}" link should be visible in top bar`).toBeVisible();
    }

    // Auth link (login OR logout). Disambiguate with scope + .first()
    const authLink = topbar.getByRole('link', { name: /^(login|logout)$/i }).first();
    await expect(authLink).toBeVisible();
  });

  test('"More" pagination is present and works on Newest', async ({ page }) => {
    await page.goto(`${BASE}/newest`, { waitUntil: 'domcontentloaded' });

    // "More" link sits at the bottom of the list
    const more = page.getByRole('link', { name: /^More$/i }).first();
    await expect(more).toBeVisible();

    const urlBefore = page.url();
    await Promise.all([
      page.waitForURL(url => url.href !== urlBefore, { timeout: 5000 }),
      more.click()
    ]);

    // Basic sanity: we should still be on /newest and have a different URL (pagination param)
    await expect(page).toHaveURL(/\/newest/);
  });
});
