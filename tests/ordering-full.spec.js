// @ts-check
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { collectItems, isNonIncreasingTimestamps } from '../shared/helper.js';

test.describe('Full ordering check for first 100 newest items', () => {
  test('items are sorted newest → oldest', async ({ page }) => {
    const limit = 100;
    const verbose = true; // set false to suppress per-item logs
    const screenshotPath = process.env.SCREENSHOT_PATH; // e.g., env var from CI
    const reportPath = process.env.REPORT_PATH;

    await page.goto('https://news.ycombinator.com/newest', { waitUntil: 'domcontentloaded' });

    const items = await collectItems(page, { limit, verbose });

    expect(items.length, `Expected ${limit} items`).toBe(limit);

    const { ok, idx } = isNonIncreasingTimestamps(items);

    if (screenshotPath) {
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }

    if (reportPath) {
      const lines = [
        `# Newest Order Check (First ${limit})`,
        '',
        '| # | ID | ISO Time | Title |',
        '|:-:|:-:|:-|:-|'
      ];
      for (const it of items) {
        lines.push(`| ${it.index} | ${it.id} | ${it.iso} | ${it.title.replace(/\|/g, '\\|')} |`);
      }
      lines.push('', ok ? 'Sorted newest → oldest.' : `Out of order at index ${idx}.`);
      fs.writeFileSync(path.resolve(reportPath), lines.join('\n'));
    }

    if (!ok) {
      const prev = items[idx - 1], curr = items[idx];
      throw new Error(
        `Ordering error at index ${idx}:\n` +
        `Prev: ${prev.iso} "${prev.title}"\n` +
        `Curr: ${curr.iso} "${curr.title}"`
      );
    }
  });
});
