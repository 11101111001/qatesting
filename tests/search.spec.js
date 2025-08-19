// tests/search.spec.js
import { test, expect } from '@playwright/test';

test.describe('Algolia Search: basic visibility', () => {
  test('search "apple" shows visible results with titles and meta', async ({ page }) => {
    // Load the Algolia UI with a pre-filled query
    await page.goto('https://hn.algolia.com/?q=apple', { waitUntil: 'domcontentloaded' });

    // Results container
    const container = page.locator('div.SearchResults_container');
    await expect(container, 'results container should be visible').toBeVisible({ timeout: 15000 });

    // Result cards
    const cards = container.locator('article.Story');
    await expect(cards.first(), 'first result card should be visible').toBeVisible({ timeout: 15000 });
    expect(await cards.count(), 'should list multiple results for "apple"').toBeGreaterThan(3);

    // Validate a handful of top cards
    const sample = Math.min(await cards.count(), 5);
    for (let i = 0; i < sample; i++) {
      const card = cards.nth(i);

      // Story title container should exist
      const titleBox = card.locator('div.Story_title');
      await expect(titleBox, 'StoryTitle container visible').toBeVisible({ timeout: 15000 });

      // Robust title link inside StoryTitle:
      // - Prefer external http(s)
      // - Accept Algolia redirect /go?
      // - Accept direct HN item link as a fallback
      const titleLink =
        titleBox.locator('a[href^="http"]').first()
          .or(titleBox.locator('a[href^="/go?"]').first())
          .or(titleBox.locator('a[href*="news.ycombinator.com/item?id="]').first());

      await expect(titleLink, 'title link visible in StoryTitle').toBeVisible({ timeout: 15000 });
      await expect(titleLink, 'title has text').toHaveText(/.+/);

      const href = await titleLink.getAttribute('href');
      expect(href, 'title link href present').toBeTruthy();
      expect(
        href,
        'title link should be external, a redirect, or an HN item link'
      ).toMatch(/^(https?:\/\/|\/go\?|https?:\/\/news\.ycombinator\.com\/item\?id=)/);

      // HN discussion link (e.g. “123 comments”) pointing to the HN item page
      const discuss = card.locator('a[href*="news.ycombinator.com/item?id="]').first();
      await expect(discuss, 'HN discussion link visible').toBeVisible();
    }
  });
});
