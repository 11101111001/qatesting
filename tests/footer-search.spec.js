// tests/footer-search.spec.js
import { test, expect } from '@playwright/test';

/**
 * From /newest, use the footer search input to jump to Algolia,
 * then verify results render.
 */

test.describe('Footer → Algolia search', () => {
  test('bottom search for "apple" redirects and shows results', async ({ page }) => {
    await page.goto('/newest', { waitUntil: 'domcontentloaded' });

    // Footer search form typically posts to hn.algolia.com with input[name="q"]
    const form = page.locator('form[action*="hn.algolia.com"]');
    await expect(form, 'Footer search form should exist').toBeVisible();

    const input = form.locator('input[name="q"]');
    await expect(input, 'Footer search input should be visible').toBeVisible();

    await input.fill('apple');
    await input.press('Enter');

    await expect(page, 'Should land on Algolia with ?q=apple').toHaveURL(/https:\/\/hn\.algolia\.com\/\?q=apple/i);

    // On Algolia: results container and a few story cards
    const container = page.locator('div.SearchResults_container');
    await expect(container, 'Algolia results container should be visible').toBeVisible({ timeout: 15000 });

    const cards = container.locator('article.Story');
    await expect(cards.first(), 'First Algolia result should be visible').toBeVisible({ timeout: 15000 });
    expect(await cards.count(), 'Should list multiple results').toBeGreaterThan(3);
  });
});
