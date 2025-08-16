// @ts-check
import { test, expect } from '@playwright/test';

/* -----------------------------------------------------------------------------
 File: tests/header.spec.js

 What this runs
 - Verifies remote headers for core resources using the APIRequest fixture.

 Key assertions
 - GET https://news.ycombinator.com/newest returns 2xx/OK, Content-Type text/html,
   and a Cache-Control header is present.
 - GET https://news.ycombinator.com/robots.txt returns 200 and non-empty body.

 How to run (single file)
   npx playwright test tests/header.spec.js
 ----------------------------------------------------------------------------- */

test('responds over HTTPS with sane content-type', async ({ request }) => {
  const resp = await request.get('https://news.ycombinator.com/newest');
  expect(resp.ok()).toBeTruthy();

  const ct = resp.headers()['content-type'] || '';
  expect(ct).toMatch(/text\/html/i);

  const cache = resp.headers()['cache-control'];
  expect(cache).toBeDefined();
});

test('robots.txt exists', async ({ request }) => {
  const resp = await request.get('https://news.ycombinator.com/robots.txt');
  expect(resp.status()).toBe(200);
  const text = await resp.text();
  expect(text.length).toBeGreaterThan(0);
});
