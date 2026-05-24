import { test, expect } from '@playwright/test';

test('about page renders and links back home', async ({ page }) => {
  const response = await page.goto('/about');
  expect(response?.status()).toBe(200);
  await expect(page.locator('main h1')).toContainText('關於');
  await expect(page.locator('main a[href="/"]')).toBeVisible();
});

test('about page is linked from footer', async ({ page }) => {
  await page.goto('/');
  await page.click('footer a[href="/about"]');
  await page.waitForURL('**/about');
  expect(page.url()).toMatch(/\/about$/);
});
