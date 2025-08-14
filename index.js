// index.js
// CLI entrypoint required by the take-home: `node index.js`
// Uses Playwright (core lib) + our locator-based helper.
// Produces an exit code and optional artifacts for a clean demo.

const { chromium } = require('playwright'); // ensure `playwright` is installed (in addition to @playwright/test)
const fs = require('fs');
const path = require('path');
const { collectItems, isNonIncreasingTimestamps } = require('./shared/helper');

/**
 * Tiny CLI parser for flags like:
 * --headless=false --limit=100 --verbose --report out.md --screenshot newest.png
 * @param {string[]} argv
 * @returns {Map<string,string>}
 */
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

  // NOTE: args values are strings; compare to 'false'
  const headless = (args.get('headless') ?? 'true') !== 'false';
  const verbose = args.has('verbose');
  const limit = Number(args.get('limit') ?? 100);
  const screenshotPath = args.get('screenshot');
  const reportPath = args.get('report');

  const browser = await chromium.launch({ headless });
  const page = await browser.newPage();

  try {
    await page.goto('https://news.ycombinator.com/newest', { waitUntil: 'domcontentloaded' });

    const items = await collectItems(page, { limit, verbose });

    if (items.length !== limit) {
      throw new Error(`Expected ${limit} items, got ${items.length}`);
    }

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

    if (ok) {
      console.log(`PASS: First ${limit} items on /newest are sorted newest → oldest.`);
      process.exit(0);
    } else {
      const prev = items[idx - 1], curr = items[idx];
      console.error(
        `FAIL at #${curr.index}:\nPrev: ${prev.iso} "${prev.title}"\nCurr: ${curr.iso} "${curr.title}"`
      );
      process.exit(1);
    }
  } catch (e) {
    console.error('ERROR:', e?.message || e);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
