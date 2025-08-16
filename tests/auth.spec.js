// tests/auth.spec.js
import { test, expect } from '@playwright/test';

/* -----------------------------------------------------------------------------
 File: tests/auth.spec.js

 What this runs
 - A cautious, optional login flow. It first does a negative check (bad creds
   keep you logged out), then—if valid credentials are present and no bot
   challenge is detected—attempts a real login and logout.

 Key assertions
 - Invalid login: form remains visible OR “Bad login” (or equivalent) appears.
 - Valid login (only if not bot-challenged):
   • “logout” link becomes visible (or user link in the header).
   • Visiting “logout” returns you to an anonymous state (login link visible).

 How to provide credentials
   macOS/Linux:
     export HN_USER="your_username"
     export HN_PASS="your_password"
   Windows PowerShell:
     $env:HN_USER="your_username"; $env:HN_PASS="your_password"

 How to run (single file)
   npx playwright test tests/auth.spec.js

 Notes
 - Many sites, including HN, can prompt reCAPTCHA/bot checks. This test should
   detect that state and skip the “valid login” section rather than fail.
 - Headed mode can reduce false positives: add --headed.
 ----------------------------------------------------------------------------- */


test.describe('Bonus: login flow (skip if challenged)', () => {
  const gotoLogin = async (page) => {
    await page.goto('https://news.ycombinator.com/login', { waitUntil: 'domcontentloaded' });
    // Top of the page has two forms on the same page (login + create)
    await expect(page.locator('form').filter({ hasText: /login/i })).toBeVisible();
    await expect(page.locator('form').filter({ hasText: /create/i })).toBeVisible();
  };

  test('invalid login keeps you logged out (shows error or login still visible)', async ({ page }) => {
    await gotoLogin(page);

    const loginForm = page.locator('form').filter({ hasText: /login/i });
    await loginForm.locator('input[name="acct"]').fill('not-a-user');
    await loginForm.locator('input[name="pw"]').fill('not-a-pass');

    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      loginForm.getByRole('button', { name: 'login' }).click(),
    ]);

    // Either error message OR login link still visible in header
    const bad = page.locator('text=Bad login');
    const stillLoggedOut = page.getByRole('link', { name: /^login$/i });

    const outcome = await Promise.race([
      bad.waitFor({ state: 'visible', timeout: 4000 }).then(() => 'error'),
      stillLoggedOut.waitFor({ state: 'visible', timeout: 4000 }).then(() => 'still-logged-out'),
    ]).catch(() => 'unknown');

    expect(outcome, 'Should see "Bad login" or remain logged out').not.toBe('unknown');
  });

  test('valid login shows logout + user link; then logout returns to anonymous', async ({ page }) => {
    const user = process.env.HN_USER;
    const pass = process.env.HN_PASS;
    test.skip(!(user && pass), 'HN_USER/HN_PASS not set');

    await gotoLogin(page);
    const loginForm = page.locator('form').filter({ hasText: /login/i });

    await expect(loginForm.locator('input[name="acct"]')).toBeVisible();
    await expect(loginForm.locator('input[name="pw"]')).toBeVisible();

    await loginForm.locator('input[name="acct"]').fill(user);
    await loginForm.locator('input[name="pw"]').fill(pass);

    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      loginForm.getByRole('button', { name: 'login' }).click(),
    ]);

    // Skip gracefully on anti-bot challenge
    const challenged = await page.locator('text=reCAPTCHA|bot|challenge', { hasText: /reCAPTCHA|bot|challenge/i }).count();
    test.skip(!!challenged, 'Bot/challenge detected – skipping login assertions');

    // Visual assertions after login
    const logoutLink = page.getByRole('link', { name: /^logout$/i });
    await expect(logoutLink, 'Logout link should appear').toBeVisible();

    const userLink = page.locator(`a[href^="user?id=${user}"]`);
    await expect(userLink, `Header should include user link for ${user}`).toBeVisible();

    // Logout should bring us back to anonymous header
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      logoutLink.click(),
    ]);
    await expect(page.getByRole('link', { name: /^login$/i }), 'After logout, login link should return').toBeVisible();
  });
});
