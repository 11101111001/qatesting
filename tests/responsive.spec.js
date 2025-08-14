import { test, expect} from '@playwright/test';

const sizes = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];

for (const vp of sizes) {
  test(`layout @ ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/newest');
    await expect(page.locator('tr.athing').first()).toBeVisible();

    // Mask dynamic bits (relative time) to reduce snapshot churn
    await expect(page).toHaveScreenshot(`newest-${vp.name}.png`, {
      mask: [page.locator('span.age')],
      fullPage: true,
    });
  });
}