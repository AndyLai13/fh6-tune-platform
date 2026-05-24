import { test, expect } from '@playwright/test';

test('/tuner/{handle} lists all tunes by that author', async ({ page }) => {
  await page.goto('/tuner/two_j_zee');
  await expect(page.locator('main h1')).toContainText('two_j_zee');
  await expect(page.locator('a[href="/tune/toyota-supra-mk4-1994-demo04"]')).toBeVisible();
});

test('/tuner/{unknown} shows empty state, not 404', async ({ page }) => {
  const response = await page.goto('/tuner/nobody_here_12345');
  expect(response?.status()).toBe(200);
  await expect(page.locator('[data-empty-state]')).toBeVisible();
});

test('clicking author handle on a tune card navigates to tuner profile', async ({ page }) => {
  await page.goto('/browse');
  const firstHandle = page.locator('a[href^="/tuner/"]').first();
  const href = await firstHandle.getAttribute('href');
  expect(href).toMatch(/^\/tuner\/.+/);
  await firstHandle.click();
  await expect(page.locator('main h1')).toContainText('@');
});
