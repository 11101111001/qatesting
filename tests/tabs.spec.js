// tests/tabs.spec.js
// @ts-check
import { test, expect } from '@playwright/test';

test.describe('top tabs coverage', () => {
  test('Ask HN page shows posts (and often More)', async ({ page }) => {
    await page.goto('/ask', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('tr.athing').first()).toBeVisible();

    // Heuristic: among first 10 titles, at least one should start with "Ask HN:"
    const titles = await page.locator('.titleline a').evaluateAll(a =>
      a.slice(0, 10).map(x => x.textContent || '')
    );
    expect(titles.some(t => /^Ask HN:/i.test(t))).toBeTruthy();

    // Optional "More" — assert if present, not required
    const more = page.locator('a.morelink[rel="next"]');
    if (await more.count()) {
      await expect(more).toBeVisible();
    }
  });

  test('Show HN page shows posts and More', async ({ page }) => {
    await page.goto('/show', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('tr.athing').first()).toBeVisible();
    await expect(page.locator('a.morelink[rel="next"]')).toBeVisible();
  });

  test('Jobs page loads and paginates', async ({ page }) => {
    await page.goto('/jobs', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('tr.athing').first()).toBeVisible();
    const more = page.locator('a.morelink[rel="next"]');
    if (await more.count()) {
      await Promise.all([page.waitForLoadState('domcontentloaded'), more.click()]);
      await expect(page.locator('tr.athing').first()).toBeVisible();
    }
  });

  test('New Comments page shows comment items', async ({ page }) => {
    await page.goto('/newcomments', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.comment')).toBeVisible();
  });

  test('Past (front) page loads days and supports pagination', async ({ page }) => {
    await page.goto('/front', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('link', { name: /\b\d{4}-\d{2}-\d{2}\b/ })).toBeVisible();
    const more = page.locator('a.morelink[rel="next"]');
    if (await more.count()) {
      await Promise.all([page.waitForLoadState('domcontentloaded'), more.click()]);
      await expect(page.getByRole('link', { name: /\b\d{4}-\d{2}-\d{2}\b/ })).toBeVisible();
    }
  });
});
