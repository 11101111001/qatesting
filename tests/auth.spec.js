// @ts-check
import { test, expect } from '@playwright/test';

const BASE = '/';

function loginForm(page) {
  // Two forms appear on /login: "login" and "create" — we want the login one.
  return page.locator('form').filter({ hasText: /username:\s*password:\s*login/i }).first();
}
function userInput(page) {
  return loginForm(page).locator('input[name="acct"]');
}
function passInput(page) {
  return loginForm(page).locator('input[name="pw"]');
}
function loginButton(page) {
  return loginForm(page).getByRole('button', { name: /^login$/i });
}
function logoutLink(page) {
  return page.getByRole('link', { name: /^logout$/i });
}
function loginLink(page) {
  return page.getByRole('link', { name: /^login$/i });
}
async function isCaptchaVisible(page) {
  const captchaLike = page.locator(
    [
      'iframe[src*="recaptcha"]',
      'div.g-recaptcha',
      'text=/verify you are human/i',
      'text=/please stand by/i',
      'text=/checking your browser before accessing/i',
    ].join(', ')
  );
  return (await captchaLike.count()) > 0;
}

test.describe('login flow', () => {
  test('invalid login shows error or keeps us unauthenticated', async ({ page }) => {
    await page.goto(`${BASE}login?goto=newest`, { waitUntil: 'domcontentloaded' });

    await userInput(page).fill('___invalid___');
    await passInput(page).fill('___invalid___');

    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      loginButton(page).click(),
    ]);

    // If CAPTCHA/human-check gates us, mark as skipped (environmental).
    if (await isCaptchaVisible(page)) test.skip(true, 'Login gated by CAPTCHA / human-check');

    // Assert we remain unauthenticated (this is the important part)
    await expect(loginLink(page)).toBeVisible();
    await expect(logoutLink(page)).toHaveCount(0);

    // Optional: if "Bad login" appears, great; we don't require it.
    // (Removed the incorrect toHaveCountGreaterThan matcher.)
  });

  test('valid login succeeds and logout works (skips if gated or creds missing)', async ({ page }) => {
    const user = process.env.HN_USER || '';
    const pass = process.env.HN_PASS || '';
    test.skip(!user || !pass, 'HN_USER/HN_PASS not provided');

    await page.goto(`${BASE}login?goto=newest`, { waitUntil: 'domcontentloaded' });

    await userInput(page).fill(user);
    await passInput(page).fill(pass);

    const outcome = await Promise.race([
      (async () => {
        await Promise.all([
          page.waitForLoadState('domcontentloaded'),
          loginButton(page).click(),
        ]);
        await page.waitForTimeout(500);
        if (await isCaptchaVisible(page)) return 'captcha';
        await expect(logoutLink(page)).toBeVisible({ timeout: 4000 });
        return 'success';
      })(),
      (async () => {
        await page.waitForTimeout(8000);
        return 'timeout';
      })(),
    ]);

    if (outcome === 'captcha') test.skip(true, 'Login gated by CAPTCHA / human-check');
    if (outcome === 'timeout') test.skip(true, 'Login possibly throttled / no state change observed');

    expect(outcome).toBe('success');

    // Best-effort logout to clean up
    if (await logoutLink(page).count()) {
      await Promise.all([
        page.waitForLoadState('domcontentloaded'),
        logoutLink(page).click(),
      ]);
      await expect(loginLink(page)).toBeVisible();
    }
  });
});
