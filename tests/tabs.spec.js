// @ts-check
import { test, expect } from '@playwright/test';

test.describe('top tabs coverage', () => {
  test('Ask HN page shows posts and More', async ({ page }) => {
    await page.goto('/ask', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('tr.athing').first()).toBeVisible();
    await expect(page.locator('a.morelink[rel="next"]')).toBeVisible();

    // Heuristic: among first 10, several should start with "Ask HN:"
    const titles = await page.locator('.titleline a').evaluateAll(a => a.slice(0, 10).map(x => x.textContent || ''));
    const askCount = titles.filter(t => /^\s*Ask HN:/i.test(t)).length;
    expect(askCount, `few Ask HN titles found: ${askCount}/10`).toBeGreaterThanOrEqual(3);
  });

  test('Show HN page shows posts and More', async ({ page }) => {
    await page.goto('/show', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('tr.athing').first()).toBeVisible();
    await expect(page.locator('a.morelink[rel="next"]')).toBeVisible();

    const titles = await page.locator('.titleline a').evaluateAll(a => a.slice(0, 10).map(x => x.textContent || ''));
    const showCount = titles.filter(t => /^\s*Show HN:/i.test(t)).length;
    expect(showCount, `few Show HN titles found: ${showCount}/10`).toBeGreaterThanOrEqual(3);
  });

  test('Jobs page loads and paginates', async ({ page }) => {
    await page.goto('/jobs', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('tr.athing').first()).toBeVisible();
    await expect(page.locator('a.morelink[rel="next"]')).toBeVisible();
  });

  test('New Comments page shows comment items', async ({ page }) => {
    await page.goto('/newcomments', { waitUntil: 'domcontentloaded' });
    // Comments page has repeated .commtext and ages
    await expect(page.locator('span.age').first()).toBeVisible();
    // There should be at least one comment text block visible
    await expect(page.locator('.commtext').first()).toBeVisible();
  });

  test('Past (front) page loads days and supports pagination', async ({ page }) => {
    await page.goto('/front', { waitUntil: 'domcontentloaded' });
    // The front page lists a day; ensure we have items and a More link
    await expect(page.locator('tr.athing').first()).toBeVisible();
    await expect(page.locator('a.morelink[rel="next"]')).toBeVisible();

    // It should also have day links like /front?day=YYYY-MM-DD somewhere on the page
    const dayLinks = await page.locator('a[href*="front?day="]').count();
    expect(dayLinks).toBeGreaterThan(0);
  });
});
