import { test, expect } from '@playwright/test';

const SLUG = 'mazda-mx5-miata-na-1989-demo06';

test('report button opens dialog, submits report, shows thanks', async ({ page }) => {
  await page.goto(`/tune/${SLUG}`);
  await page.click('[data-report-btn][data-target-kind="tune"]');
  const dialog = page.locator('[data-report-dialog][data-target-kind="tune"]');
  await expect(dialog).toBeVisible();
  await page.fill('[data-report-dialog][data-target-kind="tune"] textarea[name="reason"]', '測試檢舉內容');
  await page.waitForFunction(() => {
    const inputs = document.querySelectorAll<HTMLInputElement>('[data-report-dialog][data-target-kind="tune"] input[name="cf-turnstile-response"]');
    return Array.from(inputs).some((i) => i.value.length > 0);
  }, null, { timeout: 5000 });
  await page.click('[data-report-dialog][data-target-kind="tune"] [data-report-submit]');
  await expect(page.locator('[data-report-dialog][data-target-kind="tune"] [data-report-status]')).toContainText('感謝您的回報');
});

test('report button visible on each review card', async ({ page }) => {
  await page.goto(`/tune/${SLUG}`);
  // Count actual rendered review cards, then assert report buttons match exactly.
  // Don't hardcode review count: tests/e2e/review-flow.spec.ts targets the same slug
  // and submits reviews, so the row count grows when both suites run.
  const reviewCards = page.locator('section:has(h2:has-text("評論")) .border-l-\\[2px\\]');
  const cardCount = await reviewCards.count();
  expect(cardCount).toBeGreaterThanOrEqual(1);
  const reportButtons = page.locator('[data-report-btn][data-target-kind="review"]');
  expect(await reportButtons.count()).toBe(cardCount);
});

test('report dialog closes on Cancel button', async ({ page }) => {
  await page.goto(`/tune/${SLUG}`);
  await page.click('[data-report-btn][data-target-kind="tune"]');
  const tuneDialog = page.locator('[data-report-dialog][data-target-kind="tune"]');
  await expect(tuneDialog).toBeVisible();
  await tuneDialog.locator('[data-report-cancel]').click();
  await expect(tuneDialog).not.toBeVisible();
});
