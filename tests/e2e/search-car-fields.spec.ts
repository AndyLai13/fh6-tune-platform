import { test, expect } from '@playwright/test';

test('search for car make returns matching tunes', async ({ page }) => {
  await page.goto('/browse?q=supra');
  const links = await page.locator('a[href*="/tune/"]').allTextContents();
  expect(links.some((t) => /supra/i.test(t))).toBe(true);
});

test('search for car model returns matching tunes', async ({ page }) => {
  await page.goto('/browse?q=miata');
  const links = await page.locator('a[href*="/tune/"]').allTextContents();
  expect(links.some((t) => /miata|mx-5/i.test(t))).toBe(true);
});
