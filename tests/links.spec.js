// @ts-check
import { test, expect } from '@playwright/test';

const SOFT_SKIP_STATUSES = new Set([400, 401, 403, 404, 405, 409, 410, 412, 418, 429]);
const SOFT_SKIP_HOSTS = [
  /(^|\.)ai\.meta\.com$/i,
  /(^|\.)science\.org$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)x\.com$/i,
];

function hostOf(u) {
  try { return new URL(u).host; } catch { return ''; }
}

test('story links respond (HEAD/GET sample)', async ({ page, request }) => {
  await page.goto('/newest');

  const links = await page.locator('.titleline a').evaluateAll(a =>
    a.map(x => x.getAttribute('href') || '').filter(Boolean)
  );

  const sample = links.slice(0, 25);
  let hardFails = 0;

  for (const url of sample) {
    const host = hostOf(url);

    /** @type {import('@playwright/test').APIResponse | null} */
    let resp = null;

    try {
      const headers = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 HNChecks/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      };
      const head = await request.head(url, { headers });
      resp = head.ok() ? head : await request.get(url, { headers });
    } catch {
      resp = null;
    }

    if (!resp) {
      // network-level failure — count as hard fail
      hardFails++;
      // eslint-disable-next-line no-console
      console.warn(`No response from ${url}`);
      continue;
    }

    const status = resp.status();
    const shouldSoftSkip =
      SOFT_SKIP_STATUSES.has(status) ||
      SOFT_SKIP_HOSTS.some((re) => re.test(host));

    if (shouldSoftSkip) {
      // eslint-disable-next-line no-console
      console.warn(`Skipping ${status} from ${url}`);
      continue;
    }

    // Hard fail only on 5xx or other unexpected statuses >= 400
    if (status >= 500 || status >= 400) {
      hardFails++;
      // eslint-disable-next-line no-console
      console.warn(`Hard fail ${status} from ${url}`);
    }
  }

  // Allow a couple of hard failures, but not many.
  expect(hardFails, `Too many hard failures among sampled links`).toBeLessThan(3);
});
