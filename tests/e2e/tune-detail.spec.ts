import { test, expect } from '@playwright/test';

test('homepage loads with title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/touge\.gg/);
  await expect(page.locator('main h1')).toContainText('認真跑山');
});

test('non-existent tune slug returns 404', async ({ page }) => {
  const response = await page.goto('/tune/does-not-exist-12345');
  expect(response?.status()).toBe(404);
});
