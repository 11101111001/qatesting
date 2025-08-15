#!/usr/bin/env node
'use strict';

// Root CLI runner for the take-home. Keeps output simple and CI-friendly.
// Usage:
//   node index.js --limit=50 --report report.md
//   node index.js --headless=false --verbose --screenshot newest.png

const { chromium } = require('playwright'); // core playwright, not @playwright/test
const fs = require('fs');
const path = require('path');

// Support either shared/helper.js (current) or shared/hn.js (older name)
let helper;
try {
  helper = require('./shared/helper');
} catch {
  helper = require('./shared/hn');
}
const { collectItems, isNonIncreasingTimestamps } = helper;

function parseArgs(argv) {
  const out = new Map();
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const [k, vRaw] = a.includes('=') ? a.split('=') : [a, argv[i + 1]?.startsWith('--') ? 'true' : argv[++i]];
    out.set(k.replace(/^--/, ''), vRaw ?? 'true');
  }
  return out;
}

(async () => {
  const args = parseArgs(process.argv);

  const headless = (args.get('headless') ?? 'true') !== 'false';
  const verbose  = args.has('verbose');
  const limitRaw = Number(args.get('limit') ?? 100);
  const limit    = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 100;

  const screenshotPath = args.get('screenshot'); // e.g. newest.png
  const reportPath     = args.get('report');     // e.g. report.md

  const browser = await chromium.launch({ headless });
  const page = await browser.newPage();

  try {
    console.log('[TEST_STATUS] Visiting /newest…');
    await page.goto('https://news.ycombinator.com/newest', { waitUntil: 'domcontentloaded' });

    console.log(`[TEST_STATUS] Collecting ${limit} items…`);
    const items = await collectItems(page, { limit, verbose });

    if (items.length !== limit) {
      throw new Error(`Expected ${limit} items, got ${items.length}`);
    }

    console.log('[TEST_STATUS] Verifying order newest → oldest…');
    const { ok, idx } = isNonIncreasingTimestamps(items);

    if (screenshotPath) {
      console.log('[TEST_STATUS] Capturing screenshot…');
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }

    if (reportPath) {
      console.log('[TEST_STATUS] Writing report…');
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
        `FAIL at #${curr.index}:\nPrev: ${prev.iso} "${prev.title}"\nCurr: ${curr.iso} "${curr.title}"`
      );
    }

    console.log(`PASS: First ${limit} items on /newest are sorted newest → oldest.`);
    process.exit(0);
  } catch (e) {
    console.error('ERROR:', e?.message || e);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
