#!/usr/bin/env node
/* eslint-disable no-console */
const { chromium } = require('playwright');

function argJSON(name) {
  const a = process.argv.find(s => s.startsWith(`--${name}=`));
  if (!a) return null;
  const raw = a.slice(name.length + 3);
  try { return JSON.parse(raw); } catch { return raw; }
}
function argFlag(name) {
  const a = process.argv.find(s => s === `--${name}` || s.startsWith(`--${name}=`));
  if (!a) return false;
  if (a === `--${name}`) return true;
  const v = a.split('=')[1];
  return v === '1' || v === 'true' || v === 'yes';
}

async function main() {
  const user = argJSON('user') || process.env.HN_USER || '';
  const pass = argJSON('pass') || process.env.HN_PASS || '';
  const headed = argFlag('headed');

  if (!user || !pass) {
    console.log('Usage: HN_USER=... HN_PASS=... node auth-check.js  (or --user= --pass=)');
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: !headed,
    args: ['--disable-blink-features=AutomationControlled'],
    slowMo: headed ? 50 : 0,
  });

  const context = await browser.newContext({
    baseURL: 'https://news.ycombinator.com',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US',
  });

  const page = await context.newPage();

  try {
    await page.goto('/login?goto=news', { waitUntil: 'domcontentloaded' });

    const loginForm = page.locator('form').filter({
      has: page.locator('input[type="submit"][value="login"]'),
    });

    await loginForm.locator('input[name="acct"]').first().fill(user);
    await loginForm.locator('input[name="pw"]').first().fill(pass);

    await Promise.all([
      page.waitForLoadState('networkidle'),
      loginForm.locator('input[type="submit"][value="login"]').first().click(),
    ]);

    const cookies = await context.cookies(['https://news.ycombinator.com/']);
    const hasUserCookie = cookies.some(c => c.name === 'user');
    const hasLogout = await page.getByRole('link', { name: 'logout' }).first().isVisible().catch(() => false);
    const bodyText = (await page.locator('body').innerText().catch(() => '') || '')
      .replace(/\s+/g, ' ')
      .slice(0, 600);

    const badLogin = /bad login/i.test(bodyText);
    const validationReq = /validation required/i.test(bodyText) || /email hn@ycombinator\.com/i.test(bodyText);
    const challenge = /verify|captcha|are you human|unusual|blocked|try again later|suspicious/i.test(bodyText);
    const hasLoginLink = await page.getByRole('link', { name: /^login$/i }).first().isVisible().catch(() => false);
    const stillOnLogin = page.url().includes('/login') && (await loginForm.count().catch(() => 0)) > 0;

    console.log(
      `[AUTHCHECK] diag url=${page.url()} cookie=${hasUserCookie} ` +
      `logout=${hasLogout} loginLink=${hasLoginLink} onLogin=${stillOnLogin} ` +
      `snippet="${bodyText}"`
    );

    if (hasUserCookie || hasLogout) {
      console.log('[AUTHCHECK] success');
      await page.getByRole('link', { name: 'logout' }).first().click().catch(() => {});
      await browser.close();
      process.exit(0);
    }

    if (validationReq) {
      console.log('[AUTHCHECK] validation required');
      await browser.close();
      process.exit(6); // distinct exit for UI
    }

    if (badLogin) {
      console.log('[AUTHCHECK] fail: bad credentials');
      await browser.close();
      process.exit(2);
    }

    if (challenge) {
      console.log('[AUTHCHECK] challenge suspected');
      await browser.close();
      process.exit(3);
    }

    if (stillOnLogin || hasLoginLink) {
      console.log('[AUTHCHECK] fail: still anonymous after submit');
      await browser.close();
      process.exit(4);
    }

    console.log('[AUTHCHECK] fail: unknown (no cookie, no banner)');
    await browser.close();
    process.exit(5);
  } catch (e) {
    console.error('[AUTHCHECK] error:', e?.message || e);
    await browser.close();
    process.exit(1);
  }
}

main();
