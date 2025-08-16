// tests/content.spec.js
import { test, expect } from '@playwright/test';

/* -----------------------------------------------------------------------------
 File: tests/content.spec.js

 What this runs
 - Spot-checks structural integrity of /newest content.

 Key assertions
 - Page has ≥ 1 story row.
 - Each row exposes:
   • id attribute (post id)
   • .titleline a (visible, has href and non-empty text)
   • the immediate following meta row contains span.age (visible, contains a
     relative label like “X minutes ago / yesterday / just now”)
 - All row ids on the page are unique.

 How to run (single file)
   npx playwright test tests/content.spec.js
 ----------------------------------------------------------------------------- */

test.describe('Core: Newest table details', () => {
  test('table + rows + meta content are well-formed', async ({ page }) => {
    await page.goto('https://news.ycombinator.com/newest', { waitUntil: 'domcontentloaded' });

    // Table structure
    const table = page.locator('table.itemlist');
    await expect(table, 'Item list table should exist').toBeVisible();

    const rows = page.locator('tr.athing');
    const count = await rows.count();
    expect(count, 'There should be at least 20 stories on Newest').toBeGreaterThanOrEqual(20);

    // Check first N (limit for stability)
    const N = Math.min(30, count);

    for (let i = 0; i < N; i++) {
      const row = rows.nth(i);
      const idx = i + 1;

      // Story row id
      await expect(row, `Row ${idx}: should have HN id`).toHaveAttribute('id', /^\d+$/);

      // Title + href
      const titleLink = row.locator('.titleline a').first();
      await expect(titleLink, `Row ${idx}: title link visible`).toBeVisible();
      const titleText = (await titleLink.innerText()).trim();
      expect(titleText.length, `Row ${idx}: title text should be non-empty`).toBeGreaterThan(0);
      await expect(titleLink, `Row ${idx}: link has href`).toHaveAttribute('href', /.+/);

      // Host badge (sitebit) appears for external links
      const host = row.locator('.sitebit .sitestr');
      if ((await host.count()) > 0) {
        await expect(host, `Row ${idx}: host badge text`).toHaveText(/^[\w.-]+/);
      }

      // Meta row
      const metaRow = row.locator('xpath=following-sibling::tr[1]');
      await expect(metaRow, `Row ${idx}: meta row exists`).toBeVisible();

      const sub = metaRow.locator('.subtext');
      await expect(sub, `Row ${idx}: subtext cell present`).toBeVisible();

      // Age
      const age = sub.locator('span.age');
      await expect(age, `Row ${idx}: relative age visible`).toBeVisible();
      await expect(age, `Row ${idx}: relative age text`).toContainText(/ago|just now|yesterday/i);
      // Age is a link to the item
      await expect(age.locator('a'), `Row ${idx}: age has a permalink`).toHaveAttribute('href', /item\?id=\d+/);

      // Byline (may be missing for very new stories, but usually present)
      const user = sub.locator('a.hnuser');
      if ((await user.count()) > 0) {
        await expect(user.first(), `Row ${idx}: author link visible`).toBeVisible();
      }

      // Comments/Discuss link (very new items may show 'discuss')
      const commentsLink = sub.getByRole('link', { name: /(comment|discuss)/i });
      await expect(commentsLink, `Row ${idx}: discuss/comments link present`).toBeVisible();
    }

    // Bottom "More"
    await expect(page.locator('a.morelink[rel="next"]'), 'More pagination link').toBeVisible();
  });

  test('IDs are unique on the page', async ({ page }) => {
    await page.goto('https://news.ycombinator.com/newest', { waitUntil: 'domcontentloaded' });

    const ids = await page.locator('tr.athing').evaluateAll(nodes =>
      nodes.map(n => n.getAttribute('id') || '')
    );
    const unique = new Set(ids);
    expect(unique.size, 'Row IDs must be unique').toBe(ids.length);
  });
});
