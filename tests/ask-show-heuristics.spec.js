// tests/ask-show-heuristics.spec.js
import { test, expect } from '@playwright/test';

/**
 * Quick heuristics on Ask HN and Show HN pages.
 */

async function firstTitles(page, limit = 20) {
  const rows = page.locator('tr.athing');
  await expect(rows.first(), 'At least one row should be visible').toBeVisible();
  const take = Math.min(await rows.count(), limit);
  const titles = [];
  for (let i = 0; i < take; i++) {
    const t = await rows.nth(i).locator('.titleline a').first().innerText();
    titles.push((t || '').trim());
  }
  return titles;
}

test.describe('Ask/Show HN heuristics', () => {
  test('/show — many titles start with "Show HN"', async ({ page }) => {
    await page.goto('/show', { waitUntil: 'domcontentloaded' });

    const titles = await firstTitles(page, 20);
    const matches = titles.filter(t => /^show hn\b/i.test(t)).length;

    expect(matches, 'At least 5 titles should start with "Show HN"').toBeGreaterThanOrEqual(5);
    expect(matches, 'A good portion should be "Show HN"').toBeGreaterThanOrEqual(Math.floor(titles.length * 0.4));
  });

  test('/ask — many titles start with "Ask HN"', async ({ page }) => {
    await page.goto('/ask', { waitUntil: 'domcontentloaded' });

    const titles = await firstTitles(page, 20);
    const matches = titles.filter(t => /^ask hn\b/i.test(t)).length;

    expect(matches, 'At least 5 titles should start with "Ask HN"').toBeGreaterThanOrEqual(5);
    expect(matches, 'A good portion should be "Ask HN"').toBeGreaterThanOrEqual(Math.floor(titles.length * 0.4));
  });
});
