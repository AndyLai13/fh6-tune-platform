import { test, expect } from '@playwright/test';

test('browse page loads', async ({ page }) => {
  await page.goto('/browse');
  await expect(page.locator('h1')).toContainText('tunes');
});

test('browse page accepts filter URL params', async ({ page }) => {
  await page.goto('/browse?type=touge');
  await expect(page).toHaveURL(/type=touge/);
});

test('filter sidebar shows tune types', async ({ page }) => {
  await page.goto('/browse');
  await expect(page.getByText('TUNE TYPE')).toBeVisible();
  await expect(page.getByText('DRIVETRAIN')).toBeVisible();
});
