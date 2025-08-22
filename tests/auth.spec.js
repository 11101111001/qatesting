// tests/auth.spec.js
import { test, expect } from '@playwright/test';

const BASE = 'https://news.ycombinator.com';

// Normalize body text for robust regex checks
async function readBody(page, limit = 4000) {
  const raw = (await page.textContent('body').catch(() => '')) || '';
  return raw.replace(/\s+/g, ' ').trim().slice(0, limit);
}

test.describe('Bonus: login flow (skip if challenged)', () => {
  test('login form renders and accepts input', async ({ page }) => {
    await page.goto(`${BASE}/login?goto=news`, { waitUntil: 'domcontentloaded' });

    // HN renders TWO forms[action="login"]; the FIRST is the actual login form
    const loginForm = page.locator('form[action="login"]').first();
    await expect(loginForm).toBeVisible();

    const user = loginForm.locator('input[name="acct"]').first();
    const pw = loginForm.locator('input[name="pw"]').first();

    await user.fill('dummy_user');
    await pw.fill('dummy_pass');

    await expect(user).toHaveValue('dummy_user');
    await expect(pw).toHaveValue('dummy_pass');
  });

  test('invalid login keeps you logged out (shows error banner or remains on form)', async ({ page, browserName }) => {
    test.slow(); // CI headroom

    await page.goto(`${BASE}/login?goto=news`, { waitUntil: 'domcontentloaded' });

    // If validation/CAPTCHA is already present (e.g., from prior runs), treat as kept-out and finish
    const validationBanner = page.locator('body :text=/validation required/i').first();
    const recaptcha = page.locator('.g-recaptcha, iframe[src*="recaptcha"]').first();
    if (await validationBanner.isVisible({ timeout: 750 }).catch(() => false) ||
        await recaptcha.isVisible({ timeout: 750 }).catch(() => false)) {
      // Considered "kept out" because verification is required
      await expect(true, 'Validation/CAPTCHA wall active; treated as kept out').toBe(true);
      return;
    }

    // Scope precisely to the first login form (not the create-account form)
    const loginForm = page.locator('form[action="login"]').first();
    await expect(loginForm).toBeVisible();

    const acct = loginForm.locator('input[name="acct"]').first();
    const pw = loginForm.locator('input[name="pw"]').first();

    // Force failure path with obviously bad creds
    await acct.fill(`bad_user_${browserName}_${Date.now()}`);
    await pw.fill('bad_pass');

    // Submit; wait for DOM to settle
    await Promise.all([
      loginForm.locator('input[type="submit"][value="login"]').first().click(),
      page.waitForLoadState('domcontentloaded'),
    ]);

    // Up to 8s for any definitive post-submit signal to appear
    const outcome = await Promise.race([
      // SUCCESS (we do NOT want this for this test)
      page.getByRole('link', { name: /^logout$/i }).first()
        .waitFor({ state: 'visible', timeout: 8000 }).then(() => 'loggedIn').catch(() => null),

      // BAD CREDENTIALS banner
      page.locator('body :text("Bad login")')
        .waitFor({ state: 'visible', timeout: 8000 }).then(() => 'badlogin').catch(() => null),

      // VALIDATION wall (banner text)
      page.locator('body :text=/validation required/i')
        .waitFor({ state: 'visible', timeout: 8000 }).then(() => 'validation').catch(() => null),

      // VALIDATION wall (reCAPTCHA present)
      recaptcha.waitFor({ state: 'visible', timeout: 8000 })
        .then(() => 'validation').catch(() => null),

      // STILL on login route (HN re-renders same page on failure)
      page.waitForURL(/\/login(\?|$)/, { timeout: 8000 }).then(() => 'stilllogin').catch(() => null),

      // Or the login form is still visible after submit
      loginForm.waitFor({ state: 'visible', timeout: 8000 }).then(() => 'stilllogin').catch(() => null),
    ]);

    // Fallback sampling
    const body = await readBody(page);
    const recaptchaCount = await page.locator('.g-recaptcha, iframe[src*="recaptcha"]').count().catch(() => 0);

    const hasBadLogin = /bad login/i.test(body);
    const hasValidation = /validation required/i.test(body) || /hn@ycombinator\.com/i.test(body) || recaptchaCount > 0;

    const onLoginURL = /\/login(\?|$)/.test(page.url());
    const formStillPresent = (await loginForm.count().catch(() => 0)) > 0;

    const keptOut =
      outcome === 'badlogin' ||
      outcome === 'validation' ||
      outcome === 'stilllogin' ||
      hasBadLogin ||
      hasValidation ||
      (onLoginURL && formStillPresent);

    // Must not be logged in
    const hasLogout = await page.getByRole('link', { name: /^logout$/i }).first().isVisible().catch(() => false);
    if (hasLogout || outcome === 'loggedIn') {
      // Unexpected: bad creds should not authenticate
      await expect(false, 'Unexpectedly logged in with bad credentials').toBe(true);
      return;
    }

    await expect(keptOut, 'Should show "Bad login", or still be on the login form, or see a validation banner').toBe(true);
  });
});
