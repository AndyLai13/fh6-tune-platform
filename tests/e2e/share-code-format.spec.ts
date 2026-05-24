import { test, expect } from '@playwright/test';

test('share code input auto-formats to XXX-XXX-XXX as user types', async ({ page }) => {
  await page.goto('/upload');
  const input = page.locator('input[name="share_code"]');
  await input.fill('821471933');
  // Trigger the input event by typing one more then deleting (formatter is on input event)
  await input.press('End');
  await expect(input).toHaveValue('821-471-933');
});

test('share code input rejects non-alphanumeric and uppercases', async ({ page }) => {
  await page.goto('/upload');
  const input = page.locator('input[name="share_code"]');
  await input.fill('abc 123 def');
  await input.press('End');
  await expect(input).toHaveValue('ABC-123-DEF');
});

test('duplicate share code surfaces a warning with link to existing tune', async ({ page }) => {
  await page.goto('/upload');
  // 707-202-815 is the seeded share code for the Supra demo (toyota-supra-mk4-1994-demo04)
  const input = page.locator('input[name="share_code"]');
  await input.fill('707-202-815');
  await input.press('Tab'); // blur to trigger debounced check
  await expect(page.locator('[data-share-code-warning]')).toBeVisible({ timeout: 2000 });
  await expect(page.locator('[data-share-code-warning] a[href*="/tune/toyota-supra-mk4-1994-demo04"]')).toBeVisible();
});
