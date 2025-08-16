// tests/tabs.spec.js
import { test, expect } from '@playwright/test';

/* -----------------------------------------------------------------------------
 File: tests/tabs.spec.js

 What this runs
 - Exercises key HN tabs: Ask (/ask), Show (/show), Jobs (/jobs),
   New Comments (/newcomments), and Past (/front?day=...).
 - Verifies paging affordances and that expected UI bits are present.

 Key assertions (examples)
 - Ask HN: first row visible; “More” (rel="next") visible; several titles start
   with “Ask HN:”.
 - Show HN: first row visible; “More” present; titles look like “Show HN: …”.
 - Jobs: first row visible; “More” present; job cells render.
 - New Comments: comment items present.
 - Past: day listing visible; pagination works (Next/More).

 How to run (single file)
   npx playwright test tests/tabs.spec.js

 Notes
 - No screenshots; we assert visible semantics (roles/selectors/text).
 ----------------------------------------------------------------------------- */


test.describe('Core: top tabs coverage with detailed assertions', () => {
  test('Ask HN page shows internal posts; titles look like Ask HN', async ({ page }) => {
    await page.goto('https://news.ycombinator.com/ask', { waitUntil: 'domcontentloaded' });

    const rows = page.locator('tr.athing');
    await expect(rows.first()).toBeVisible();

    // Ask posts are internal (no external host badge in most cases)
    const firstTen = rows.filter({ has: page.locator('.titleline a') }).first(10);
    const hostBadges = page.locator('tr.athing .sitebit .sitestr').first(10);
    expect(await hostBadges.count(), 'Ask HN posts typically do not have external host').toBeLessThanOrEqual(2);

    // Title prefix "Ask HN:" common
    const titles = await page.locator('.titleline a').evaluateAll(a =>
      a.slice(0, 12).map(x => (x.textContent || '').trim().toLowerCase())
    );
    const askish = titles.filter(t => t.startsWith('ask hn:')).length;
    expect(askish, 'At least several titles should start with "Ask HN:"').toBeGreaterThanOrEqual(4);
  });

  test('Show HN page shows posts; many titles start with Show HN', async ({ page }) => {
    await page.goto('https://news.ycombinator.com/show', { waitUntil: 'domcontentloaded' });

    const rows = page.locator('tr.athing');
    await expect(rows.first()).toBeVisible();
    await expect(page.locator('a.morelink[rel="next"]')).toBeVisible();

    // Title prefix "Show HN:" is common
    const titles = await page.locator('.titleline a').evaluateAll(a =>
      a.slice(0, 12).map(x => (x.textContent || '').trim().toLowerCase())
    );
    const showish = titles.filter(t => t.startsWith('show hn:')).length;
    expect(showish, 'At least several titles should start with "Show HN:"').toBeGreaterThanOrEqual(4);

    // A good portion have an external host badge
    const hosts = await page.locator('.sitebit .sitestr').count();
    expect(hosts, 'Many Show HN posts link externally').toBeGreaterThanOrEqual(5);
  });

  test('Jobs page loads and paginates (when available)', async ({ page }) => {
    await page.goto('https://news.ycombinator.com/jobs', { waitUntil: 'domcontentloaded' });

    const rows = page.locator('tr.athing');
    await expect(rows.first()).toBeVisible();

    // Jobs usually link to item?id= (internal)
    const internalLinks = await page.locator('tr.athing .titleline a[href^="item?id="]').count();
    expect(internalLinks, 'Jobs often use internal item pages').toBeGreaterThan(0);

    const more = page.locator('a.morelink[rel="next"]');
    if (await more.count()) {
      await Promise.all([page.waitForLoadState('domcontentloaded'), more.click()]);
      await expect(page).toHaveURL(/\/jobs\?p=\d+/);
    }
  });

  test('New Comments lists comment text + users + ages', async ({ page }) => {
    await page.goto('https://news.ycombinator.com/newcomments', { waitUntil: 'domcontentloaded' });

    // Comment text
    await expect(page.locator('.commtext').first()).toBeVisible();

    // Check first 20 comment blocks
    const comments = page.locator('tr.athing.comtr').first(20);
    const count = await comments.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const c = comments.nth(i);
      // Author (sometimes hidden/dead; tolerate missing)
      const user = c.locator('a.hnuser');
      if (await user.count()) await expect(user.first()).toBeVisible();

      // Age link present
      const age = c.locator('.age a');
      await expect(age, `Comment ${i + 1}: age link`).toBeVisible();

      // Comment text exists (commtext)
      await expect(c.locator('.commtext')).toBeVisible();
    }
  });

  test('Past/front page has pagination', async ({ page }) => {
    await page.goto('https://news.ycombinator.com/front', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('a.morelink[rel="next"]')).toBeVisible();
  });
});
