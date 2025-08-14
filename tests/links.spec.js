// @ts-check
import { test, expect } from '@playwright/test';

test('story links respond (HEAD/GET sample)', async ({ page, request }) => {
  await page.goto('/newest');

  // Use getAttribute to avoid TS complaining about .href on SVGElement | HTMLElement
  const links = await page.locator('.titleline a').evaluateAll(anchors =>
    anchors
      .map(a => a.getAttribute('href') || '')
      .filter(Boolean)
  );

  const sample = links.slice(0, 25); // be polite

  for (const url of sample) {
    /** @type {import('@playwright/test').APIResponse | null} */
    let resp = null;

    try {
      const head = await request.head(url);
      resp = head.ok() ? head : await request.get(url);
    } catch {
      resp = null;
    }

    // Make the checker happy and keep the assertion meaningful
    if (!resp) {
      throw new Error(`No response from ${url}`);
    }

    expect(resp.status(), `Bad status from ${url}`).toBeLessThan(400);
  }
});
