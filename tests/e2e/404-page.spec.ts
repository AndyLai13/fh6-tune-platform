import { test, expect } from '@playwright/test';

test('404 page renders for unknown route', async ({ page }) => {
  const response = await page.goto('/this-route-does-not-exist-xyz');
  expect(response?.status()).toBe(404);
  await expect(page.locator('main h1')).toContainText('404');
  await expect(page.locator('main a[href="/"]')).toBeVisible();
});

test('unknown tune slug renders 404 page (not redirect)', async ({ page }) => {
  const response = await page.goto('/tune/does-not-exist-12345');
  expect(response?.status()).toBe(404);
  await expect(page.locator('main h1')).toContainText('404');
});

test('unknown edit slug renders 404 page', async ({ page }) => {
  const response = await page.goto('/edit/does-not-exist-12345');
  expect(response?.status()).toBe(404);
  await expect(page.locator('main h1')).toContainText('404');
});
