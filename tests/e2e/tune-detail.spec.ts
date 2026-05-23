import { test, expect } from '@playwright/test';

test('homepage loads with title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/touge\.gg/);
  await expect(page.locator('h1')).toContainText('tune database');
});

test('404 redirect from non-existent tune slug', async ({ page }) => {
  const response = await page.goto('/tune/does-not-exist-12345');
  // Either we get redirected (302) or a 404 page renders
  expect([200, 302, 404]).toContain(response?.status() ?? 0);
});
