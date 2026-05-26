import { test, expect } from '@playwright/test';

test('/privacy renders with key disclosures', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.locator('main h1')).toContainText(/隱私|Privacy/);
  await expect(page.locator('main')).toContainText(/IP/);
  await expect(page.locator('main')).toContainText(/帳號|account/i);
});

test('/terms renders with UGC + content-removal section', async ({ page }) => {
  await page.goto('/terms');
  await expect(page.locator('main h1')).toContainText(/服務條款|Terms/);
  await expect(page.locator('main')).toContainText(/下架|remov/i);
});

test('footer links to /privacy and /terms', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('footer a[href="/privacy"]')).toBeVisible();
  await expect(page.locator('footer a[href="/terms"]')).toBeVisible();
});
