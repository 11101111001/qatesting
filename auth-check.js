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

async function readBody(page, limit = 2000) {
  const raw = (await page.textContent('body').catch(() => '')) || '';
  return raw.replace(/\s+/g, ' ').trim().slice(0, limit);
}

async function main() {
  const user = argJSON('user') || process.env.HN_USER || '';
  const pass = argJSON('pass') || process.env.HN_PASS || '';
  const headed = argFlag('headed');

  if (!user || !pass) {
    console.log('Usage: HN_USER=... HN_PASS=... node auth-check.js  (or --user= --pass=) [--headed]');
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

    // FIRST form[action="login"] is the actual login form (second is create account)
    const loginForm = page.locator('form[action="login"]').first();
    await loginForm.locator('input[name="acct"]').fill(user);
    await loginForm.locator('input[name="pw"]').fill(pass);

    await Promise.all([
      loginForm.locator('input[type="submit"][value="login"]').first().click(),
      page.waitForLoadState('domcontentloaded'),
    ]);

    // Wait up to 6s for any state to appear
    const postSubmit = await Promise.race([
      page.getByRole('link', { name: /^logout$/i }).first()
        .waitFor({ state: 'visible', timeout: 6000 }).then(() => 'logout').catch(() => null),
      page.locator('body :text("Bad login")')
        .waitFor({ state: 'visible', timeout: 6000 }).then(() => 'badlogin').catch(() => null),
      page.locator('body :text=/validation required/i')
        .waitFor({ state: 'visible', timeout: 6000 }).then(() => 'validation').catch(() => null),
      page.locator('.g-recaptcha, iframe[src*="recaptcha"]').first()
        .waitFor({ state: 'visible', timeout: 6000 }).then(() => 'validation').catch(() => null),
      page.waitForURL(/\/login(\?|$)/, { timeout: 6000 })
        .then(() => 'stilllogin').catch(() => null),
      loginForm.waitFor({ state: 'visible', timeout: 6000 })
        .then(() => 'stilllogin').catch(() => null),
    ]);

    const cookies = await context.cookies(['https://news.ycombinator.com/']);
    const hasUserCookie = cookies.some(c => c.name === 'user');
    const hasLogout = await page.getByRole('link', { name: /^logout$/i }).first().isVisible().catch(() => false);

    const body = await readBody(page);
    const recaptchaCount = await page.locator('.g-recaptcha, iframe[src*="recaptcha"]').count().catch(() => 0);

    const badLogin = /bad login/i.test(body);
    const validationReq = /validation required/i.test(body) || /hn@ycombinator\.com/i.test(body) || recaptchaCount > 0;
    const challenge = /captcha|are you human|verify(?!.*logout)|unusual|blocked|try again later|suspicious/i.test(body);
    const stillOnLogin = /\/login(\?|$)/.test(page.url());

    // One-line JSON diagnostic (easy for humans & machines)
    const diag = {
      url: page.url(),
      postSubmit,
      cookieUser: hasUserCookie,
      hasLogout,
      badLogin,
      validationReq,
      challenge,
      recaptchaCount,
      stillOnLogin,
      snippet: body,
    };
    console.log('[AUTHCHECK]', JSON.stringify(diag));

    // Exit code mapping (keep order: success first, then specific failures)
    if (hasUserCookie || hasLogout || postSubmit === 'logout') {
      // success
      console.log('[AUTHCHECK] success');
      // best-effort logout so we don’t leave sessions around
      await page.getByRole('link', { name: /^logout$/i }).first().click().catch(() => {});
      await browser.close();
      process.exit(0);
    }

    if (validationReq || postSubmit === 'validation') {
      console.log('[AUTHCHECK] validation required');
      await browser.close();
      process.exit(6); // distinct code for UI to show “verification required”
    }

    if (badLogin || postSubmit === 'badlogin') {
      console.log('[AUTHCHECK] fail: bad credentials');
      await browser.close();
      process.exit(2);
    }

    if (challenge) {
      console.log('[AUTHCHECK] challenge suspected');
      await browser.close();
      process.exit(3);
    }

    if (stillOnLogin || postSubmit === 'stilllogin') {
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
