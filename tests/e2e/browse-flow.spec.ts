import { test, expect } from '@playwright/test';

test('browse page loads', async ({ page }) => {
  await page.goto('/browse');
  await expect(page.locator('main h1')).toContainText('筆調校');
});

test('browse page accepts filter URL params', async ({ page }) => {
  await page.goto('/browse?type=touge');
  await expect(page).toHaveURL(/type=touge/);
});

test('filter sidebar shows tune types', async ({ page }) => {
  await page.goto('/browse');
  await expect(page.getByText('調校類型')).toBeVisible();
  await expect(page.getByText('驅動方式')).toBeVisible();
});
