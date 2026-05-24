import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';

const SLUG = 'toyota-supra-mk4-1994-demo04';

// Serial to avoid two workers racing on the same beforeAll wrangler write,
// which causes SQLITE_BUSY when both try to acquire the D1 write lock at once.
// Same pattern as download-counter.spec.ts.
test.describe.serial('recommended tracks', () => {
  test.beforeAll(async () => {
    execSync(
      `npx wrangler d1 execute fh6-tune-platform-local --local --command="DELETE FROM tune_tracks WHERE tune_id = (SELECT id FROM tunes WHERE slug = '${SLUG}'); INSERT INTO tune_tracks (tune_id, track_id) SELECT id, 5 FROM tunes WHERE slug = '${SLUG}';"`,
      { stdio: 'pipe' }
    );
  });

  test('tune detail page shows recommended tracks when attached', async ({ page }) => {
    await page.goto(`/tune/${SLUG}`);
    await expect(page.locator('[data-recommended-tracks]')).toBeVisible();
    await expect(page.locator('[data-recommended-tracks]')).toContainText('Tsukuba Circuit');
  });

  test('tune with no recommended tracks does not render the section', async ({ page }) => {
    // demo07 has no tune_tracks rows in the seed (only the Supra above gets one via beforeAll)
    await page.goto('/tune/honda-civic-type-r-ek9-1997-demo07');
    await expect(page.locator('[data-recommended-tracks]')).not.toBeVisible();
  });
});
