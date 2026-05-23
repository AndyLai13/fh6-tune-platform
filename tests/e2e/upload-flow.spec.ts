import { test, expect } from '@playwright/test';

test('upload page loads and form is present', async ({ page }) => {
  await page.goto('/upload');
  await expect(page.locator('main h1')).toContainText('上傳調校');
  await expect(page.locator('input[name="name"]')).toBeVisible();
  await expect(page.locator('input[name="share_code"]')).toBeVisible();
  await expect(page.locator('select[name="car_id"]')).toBeVisible();
});

test('tune type buttons select correctly', async ({ page }) => {
  await page.goto('/upload');
  await page.click('[data-type="drift"]');
  const hiddenInput = page.locator('input[name="tune_type"]');
  await expect(hiddenInput).toHaveValue('drift');
});
