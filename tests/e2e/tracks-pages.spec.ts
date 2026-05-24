import { test, expect } from '@playwright/test';

test('/tracks lists all seeded tracks grouped by region', async ({ page }) => {
  await page.goto('/tracks');
  await expect(page.locator('main h1')).toContainText('賽道');
  const trackLinks = page.locator('a[href^="/tracks/"]');
  expect(await trackLinks.count()).toBe(10);
  await expect(page.locator('main')).toContainText('Touge');
  await expect(page.locator('main')).toContainText('Circuit');
  await expect(page.locator('main')).toContainText('Off-road');
  await expect(page.locator('a[href="/tracks/mt-akina-downhill"]')).toBeVisible();
  await expect(page.locator('a[href="/tracks/suzuka-circuit"]')).toBeVisible();
});
