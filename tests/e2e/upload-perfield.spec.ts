import { test, expect } from '@playwright/test';

test('upload form renders per-field inputs grouped by section', async ({ page }) => {
  await page.goto('/upload');

  for (const section of ['輪胎', '變速箱', '定位', '防傾桿', '彈簧', '阻尼', '空力', '煞車', '差速器']) {
    await expect(page.locator(`text=${section}`).first()).toBeVisible();
  }

  await expect(page.locator('input[name="tv.tires.pressure_f"]')).toBeVisible();
  await expect(page.locator('input[name="tv.gearing.final"]')).toBeVisible();
  await expect(page.locator('input[name="tv.diff.accel_pct"]')).toBeVisible();

  await expect(page.locator('textarea[name="_tune_values_json"]')).toHaveCount(0);
});

test('per-field inputs are pre-filled with sample values', async ({ page }) => {
  await page.goto('/upload');
  await expect(page.locator('input[name="tv.tires.pressure_f"]')).toHaveValue('28.5');
});

test('edit page renders per-field inputs from the loaded tune', async ({ page }) => {
  await page.goto('/edit/toyota-supra-mk4-1994-demo04');
  await expect(page.locator('input[name="tv.tires.pressure_f"]')).toBeVisible();
  await expect(page.locator('input[name="tv.tires.pressure_f"]')).toHaveValue('28.5');
});
