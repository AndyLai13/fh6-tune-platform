import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';

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

test.describe.serial('/tracks/{slug} detail', () => {
  test.beforeAll(() => {
    execSync(
      `npx wrangler d1 execute fh6-tune-platform-local --local --command="DELETE FROM tune_tracks WHERE track_id = 5; INSERT INTO tune_tracks (tune_id, track_id) SELECT id, 5 FROM tunes WHERE slug = 'toyota-supra-mk4-1994-demo04';"`,
      { stdio: 'pipe' }
    );
  });

  test('/tracks/{slug} shows track info and recommending tunes', async ({ page }) => {
    await page.goto('/tracks/tsukuba-circuit');
    await expect(page.locator('main h1')).toContainText('Tsukuba Circuit');
    await expect(page.locator('main')).toContainText('Circuit');
    await expect(page.locator('a[href="/tune/toyota-supra-mk4-1994-demo04"]')).toBeVisible();
  });

  test('/tracks/{unknown} returns 404', async ({ page }) => {
    const response = await page.goto('/tracks/this-track-does-not-exist');
    expect(response?.status()).toBe(404);
  });
});
