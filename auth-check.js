// auth-check.js
const { chromium } = require('playwright');

/* -----------------------------------------------------------------------------
 File: auth-check.js  (node script, not a Playwright test)

 What this does
 - Minimal headless login probe using playwright core.
 - Takes HN_USER / HN_PASS from environment and attempts login.
 - Prints a single-line result: PASS/FAIL plus a short reason.

 How to run
   HN_USER=alice HN_PASS='secret' node auth-check.js

 Notes
 - Intended for quick credential sanity checks; not part of the default suite.
 ----------------------------------------------------------------------------- */

async function main() {
  const user = process.env.HN_USER || process.argv.find(a => a.startsWith('--user='))?.split('=')[1];
  const pass = process.env.HN_PASS || process.argv.find(a => a.startsWith('--pass='))?.split('=')[1];

  if (!user || !pass) {
    console.error('Usage: HN_USER=... HN_PASS=... node auth-check.js  (or --user= --pass=)');
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto('https://news.ycombinator.com/login?goto=news', { waitUntil: 'domcontentloaded' });

    // Scope to the LOGIN form (not the CREATE form)
    const loginForm = page.locator('form').filter({
      has: page.locator('input[type="submit"][value="login"]'),
    });

    await loginForm.locator('input[name="acct"]').fill(user);
    await loginForm.locator('input[name="pw"]').fill(pass);

    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      loginForm.locator('input[type="submit"][value="login"]').click(),
    ]);

    const loggedIn = await page.getByRole('link', { name: 'logout' }).isVisible().catch(() => false);
    if (loggedIn) {
      console.log('LOGIN OK');
      // Clean up: logout so future runs don’t carry cookies
      await Promise.all([
        page.waitForLoadState('domcontentloaded'),
        page.getByRole('link', { name: 'logout' }).click(),
      ]);
      process.exit(0);
    } else {
      console.log('LOGIN FAILED');
      process.exit(1);
    }
  } catch (e) {
    console.error('ERROR:', e?.message || e);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
