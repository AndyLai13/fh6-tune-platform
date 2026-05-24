# Sprint 2: Launch-Ready Platform

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining content-management, discoverability, and trust gaps so the FH6 tune platform is fit for a real launch — recommended tracks visible on tunes, abuse reports possible, search actually finds cars, an /about page exists, and the whole thing is documented for Cloudflare Pages deployment.

**Architecture:** Builds on the Sprint 1 backend (D1 + KV + Turnstile, all via `import { env } from 'cloudflare:workers'`). Adds: a `listTracksForTune` DB helper + one new section on the tune detail page; a `<ReportButton>` component sharing the same Turnstile/honeypot/rate-limit pattern as ReviewForm; an `/about` static page; a schema migration `0003_fts_car_columns.sql` that rebuilds `tunes_fts` with denormalized car make/model + a shared `lib/fts.ts` sanitizer; and a `docs/DEPLOY.md` runbook for first-time Cloudflare Pages deployment.

**Tech Stack:** Astro 6 (server output) · Cloudflare Pages · D1 (SQLite + FTS5) · KV · Tailwind v4 · Playwright · Vitest.

---

## File Structure Overview

**New files:**
- `migrations/0003_fts_car_columns.sql` — rebuild `tunes_fts` to include `car_make`, `car_model`; recreate triggers
- `src/lib/fts.ts` — single source of truth for FTS5 query sanitization (used by `/api/search.ts` and `browse.astro`)
- `src/components/ReportButton.astro` — small button + modal dialog form, POSTs to existing `/api/report`
- `src/pages/about.astro` — static About page (zh-TW copy, what the site is, who it's for, disclaimer)
- `docs/DEPLOY.md` — first-time Cloudflare Pages deployment runbook
- `tests/unit/fts.test.ts` — unit tests for the extracted sanitizer
- `tests/e2e/recommended-tracks.spec.ts` — verifies tracks render on tune detail
- `tests/e2e/report-flow.spec.ts` — verifies report dialog flow
- `tests/e2e/about-page.spec.ts` — 1 smoke test
- `tests/e2e/search-car-fields.spec.ts` — verifies `?q=supra` now returns the Supra MK4

**Modified files:**
- `src/lib/db.ts` — add `listTracksForTune(db, tuneId)` returning `{ id, name, slug, surface, length_km, region }[]`
- `src/pages/tune/[slug].astro` — call `listTracksForTune`, render new "Recommended tracks" section; embed `<ReportButton>` next to the tune title; embed `<ReportButton>` per review
- `src/pages/api/search.ts` — import sanitizer from `lib/fts.ts` instead of inlining
- `src/pages/browse.astro` — import sanitizer from `lib/fts.ts` instead of inlining
- `src/components/Footer.astro` — link `/about` href stays as-is, no change needed (already in Footer)

**Task order rationale:** Task 1 (tracks display) is the smallest pure-UI task — good warmup. Task 2 (FTS extension) is a schema migration so it goes early before deploy doc is written. Task 3 (report button) reuses Turnstile pattern from Sprint 1. Task 4 (/about) is trivial markup. Task 5 (deploy runbook) goes last after the codebase is finalized.

---

### Task 1: Display recommended tracks on tune detail page

**Files:**
- Modify: `src/lib/db.ts` — add `listTracksForTune` helper
- Modify: `src/pages/tune/[slug].astro` — call helper, render section
- Test: `tests/e2e/recommended-tracks.spec.ts`

**Background:** Upload form already saves `track_ids` into `tune_tracks` (see `src/pages/api/tunes/index.ts:87` + `attachTracks` in db.ts). The demo seed (`scripts/seed-demo-tunes.ts`) does NOT attach tracks to demo tunes — so the test will need to first attach a track to a known demo tune via direct SQL before asserting.

- [ ] **Step 1: Write the failing e2e test**

Create `tests/e2e/recommended-tracks.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';

const SLUG = 'toyota-supra-mk4-1994-demo04';

test.beforeAll(async () => {
  // Attach track id 5 (Tsukuba Circuit) to demo tune so the test has data to assert
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
  // Pick a demo tune that has no tracks attached (most demo tunes have none)
  await page.goto('/tune/honda-civic-type-r-ek9-1997-demo07');
  await expect(page.locator('[data-recommended-tracks]')).not.toBeVisible();
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npx playwright test tests/e2e/recommended-tracks.spec.ts
```

Expected: FAIL — `[data-recommended-tracks]` element doesn't exist anywhere.

- [ ] **Step 3: Add `listTracksForTune` to `src/lib/db.ts`**

After the existing `attachTracks` function (around line 125-131), add:

```typescript
export async function listTracksForTune(db: D1Database, tuneId: number) {
  return db.prepare(`
    SELECT t.id, t.name, t.slug, t.surface, t.length_km, t.region
    FROM tune_tracks tt
    JOIN tracks t ON t.id = tt.track_id
    WHERE tt.tune_id = ?
    ORDER BY t.name
  `).bind(tuneId).all<{ id: number; name: string; slug: string; surface: string; length_km: number | null; region: string | null }>();
}
```

- [ ] **Step 4: Render the section in `src/pages/tune/[slug].astro`**

Add to the imports (top of frontmatter):

```typescript
import { getTuneBySlug, getCarById, listReviews, listTracksForTune } from '~/lib/db';
```

Replace the existing single-line import. Then in the frontmatter, after `const reviews = ...`:

```typescript
const tracksResult = await listTracksForTune(env.DB, tune.id);
const tracks = (tracksResult.results ?? []) as Array<{ name: string; slug: string; surface: string; length_km: number | null; region: string | null }>;
```

In the template, insert a new section AFTER the description block (after the `{tune.description && (...)}` ternary, before `</section>`):

```astro
    {tracks.length > 0 && (
      <div data-recommended-tracks class="mt-6 p-5 bg-bg-card border-l-[3px] border-cyan">
        <div class="font-mono text-[10px] text-cyan tracking-wider2 mb-2">＞ 推薦賽道</div>
        <ul class="m-0 p-0 list-none flex flex-wrap gap-2">
          {tracks.map((t) => (
            <li class="font-mono text-[12px] bg-bg border border-line px-3 py-1.5">
              {t.name}
              {t.region && <span class="text-text-dim"> · {t.region}</span>}
              {t.length_km && <span class="text-text-dim"> · {t.length_km} km</span>}
            </li>
          ))}
        </ul>
      </div>
    )}
```

- [ ] **Step 5: Run tests, confirm pass**

```bash
npx playwright test tests/e2e/recommended-tracks.spec.ts
```

Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts src/pages/tune/\[slug\].astro tests/e2e/recommended-tracks.spec.ts
git commit -m "feat: show recommended tracks on tune detail page"
```

---

### Task 2: Extend FTS to include car make/model + extract shared sanitizer

**Files:**
- Create: `migrations/0003_fts_car_columns.sql`
- Create: `src/lib/fts.ts`
- Modify: `src/pages/api/search.ts` — import sanitizer
- Modify: `src/pages/browse.astro` — import sanitizer
- Test: `tests/unit/fts.test.ts`
- Test: `tests/e2e/search-car-fields.spec.ts`

**Background:** Sprint 1 surfaced that searching `supra` returns nothing because `tunes_fts` only indexes `name`, `description`, `author_handle`. Cars are in a separate `cars` table joined by `car_id`. This task denormalizes `car_make` + `car_model` into the FTS index via the existing triggers, and pulls the inlined sanitizer logic into `lib/fts.ts`.

- [ ] **Step 1: Write the failing unit test for the sanitizer**

Create `tests/unit/fts.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { sanitizeFtsQuery } from '~/lib/fts';

describe('sanitizeFtsQuery', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeFtsQuery('')).toBe('');
  });
  it('returns empty string for single-character input', () => {
    expect(sanitizeFtsQuery('a')).toBe('');
  });
  it('quotes and prefix-matches each token', () => {
    expect(sanitizeFtsQuery('supra mk4')).toBe('"supra"* OR "mk4"*');
  });
  it('strips FTS metacharacters', () => {
    expect(sanitizeFtsQuery('foo"bar*baz')).toBe('"foobarbaz"*');
  });
  it('drops tokens under 2 characters', () => {
    expect(sanitizeFtsQuery('a supra b mk4')).toBe('"supra"* OR "mk4"*');
  });
  it('handles dashes as part of tokens', () => {
    expect(sanitizeFtsQuery('gt-r r34')).toBe('"gt-r"* OR "r34"*');
  });
});
```

- [ ] **Step 2: Run unit test to confirm fail**

```bash
npm test -- tests/unit/fts.test.ts
```

Expected: FAIL — module `~/lib/fts` doesn't exist.

- [ ] **Step 3: Create `src/lib/fts.ts`**

```typescript
export function sanitizeFtsQuery(query: string): string {
  return query
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .map((t) => `"${t}"*`)
    .join(' OR ');
}
```

- [ ] **Step 4: Run unit test, confirm pass**

```bash
npm test -- tests/unit/fts.test.ts
```

Expected: 6 tests PASS.

- [ ] **Step 5: Replace inline sanitizer in `src/pages/api/search.ts`**

Replace the entire file with:

```typescript
import type { APIRoute } from 'astro';
import { searchTunes } from '~/lib/db';
import { sanitizeFtsQuery } from '~/lib/fts';
import { env } from 'cloudflare:workers';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get('q')?.trim();
  if (!q || q.length < 2) return Response.json({ results: [] });
  const fts = sanitizeFtsQuery(q);
  if (!fts) return Response.json({ results: [] });
  const result = await searchTunes(env.DB, fts, 24);
  return Response.json({ results: result.results });
};
```

- [ ] **Step 6: Replace inline sanitizer in `src/pages/browse.astro`**

Find the block starting `if (searchQuery.length >= 2) {` (around line 16). Replace lines 17-23 (the inline sanitize logic) with a call to the shared helper. The full updated block:

```typescript
if (searchQuery.length >= 2) {
  const fts = sanitizeFtsQuery(searchQuery);
  const r = fts ? await searchTunes(env.DB, fts, limit) : { results: [] };
  rows = (r.results ?? []) as Array<any>;
} else {
```

And add to the imports at the top of frontmatter:

```typescript
import { sanitizeFtsQuery } from '~/lib/fts';
```

- [ ] **Step 7: Write the failing e2e test for car-field search**

Create `tests/e2e/search-car-fields.spec.ts`:

```typescript
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
```

- [ ] **Step 8: Run, confirm fail**

```bash
npx playwright test tests/e2e/search-car-fields.spec.ts
```

Expected: FAIL — FTS doesn't index car columns yet, so empty results.

- [ ] **Step 9: Create migration `migrations/0003_fts_car_columns.sql`**

```sql
-- Sprint 2: extend tunes_fts to denormalize car make/model so search hits car queries.
-- Strategy: drop the old triggers + FTS table, recreate FTS with extra columns,
-- recreate triggers to JOIN cars on write, then rebuild the index from existing rows.

DROP TRIGGER IF EXISTS tunes_ai;
DROP TRIGGER IF EXISTS tunes_au;
DROP TRIGGER IF EXISTS tunes_ad;
DROP TABLE IF EXISTS tunes_fts;

CREATE VIRTUAL TABLE tunes_fts USING fts5(
  name, description, author_handle, car_make, car_model,
  content=''
);

-- INSERT trigger: pull car make/model via subquery at write time
CREATE TRIGGER tunes_ai AFTER INSERT ON tunes BEGIN
  INSERT INTO tunes_fts(rowid, name, description, author_handle, car_make, car_model)
  VALUES (
    new.id,
    new.name,
    new.description,
    new.author_handle,
    (SELECT make FROM cars WHERE id = new.car_id),
    (SELECT model FROM cars WHERE id = new.car_id)
  );
END;

CREATE TRIGGER tunes_au AFTER UPDATE ON tunes BEGIN
  DELETE FROM tunes_fts WHERE rowid = old.id;
  INSERT INTO tunes_fts(rowid, name, description, author_handle, car_make, car_model)
  VALUES (
    new.id,
    new.name,
    new.description,
    new.author_handle,
    (SELECT make FROM cars WHERE id = new.car_id),
    (SELECT model FROM cars WHERE id = new.car_id)
  );
END;

CREATE TRIGGER tunes_ad AFTER DELETE ON tunes BEGIN
  DELETE FROM tunes_fts WHERE rowid = old.id;
END;

-- Backfill from existing tunes
INSERT INTO tunes_fts(rowid, name, description, author_handle, car_make, car_model)
SELECT t.id, t.name, t.description, t.author_handle, c.make, c.model
FROM tunes t JOIN cars c ON c.id = t.car_id
WHERE t.status != 'deleted';
```

- [ ] **Step 10: Apply migration to local D1**

```bash
npx wrangler d1 execute fh6-tune-platform-local --local --file=migrations/0003_fts_car_columns.sql
```

Expected: 8 commands executed successfully.

- [ ] **Step 11: Run e2e tests, confirm pass**

```bash
npx playwright test tests/e2e/search-car-fields.spec.ts
```

Expected: 2 tests PASS.

- [ ] **Step 12: Commit**

```bash
git add migrations/0003_fts_car_columns.sql src/lib/fts.ts src/pages/api/search.ts src/pages/browse.astro tests/unit/fts.test.ts tests/e2e/search-car-fields.spec.ts
git commit -m "feat(search): index car make/model in FTS + extract sanitizer helper"
```

---

### Task 3: Report button for tunes and reviews

**Files:**
- Create: `src/components/ReportButton.astro`
- Modify: `src/pages/tune/[slug].astro` — embed ReportButton next to title; embed inside each review card
- Test: `tests/e2e/report-flow.spec.ts`

**Background:** `/api/report` already exists and accepts `{ target_kind: 'tune' | 'review', target_id, reason, turnstile_token }`. We need a small button that opens a dialog with a textarea, posts the report, and shows a thanks message. Turnstile script is already loaded on the tune detail page (Sprint 1 added it for ReviewForm).

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/report-flow.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

const SLUG = 'mazda-mx5-miata-na-1989-demo06';

test('report button opens dialog, submits report, shows thanks', async ({ page }) => {
  await page.goto(`/tune/${SLUG}`);

  // Click the tune-level report button
  await page.click('[data-report-btn][data-target-kind="tune"]');

  // Dialog should open
  const dialog = page.locator('[data-report-dialog]');
  await expect(dialog).toBeVisible();

  // Fill reason
  await page.fill('[data-report-dialog] textarea[name="reason"]', '測試檢舉內容');

  // wait for Turnstile dev key to settle
  await page.waitForFunction(() => {
    const inputs = document.querySelectorAll<HTMLInputElement>('[data-report-dialog] input[name="cf-turnstile-response"]');
    return Array.from(inputs).some((i) => i.value.length > 0);
  }, null, { timeout: 5000 });

  await page.click('[data-report-dialog] [data-report-submit]');

  // Success state
  await expect(page.locator('[data-report-status]')).toContainText('感謝您的回報');
});

test('report button visible on each review card', async ({ page }) => {
  await page.goto(`/tune/${SLUG}`);
  const reviewReportButtons = page.locator('[data-report-btn][data-target-kind="review"]');
  // The seeded MX-5 tune has 3 reviews
  expect(await reviewReportButtons.count()).toBeGreaterThanOrEqual(1);
});

test('report dialog closes on Cancel button', async ({ page }) => {
  await page.goto(`/tune/${SLUG}`);
  await page.click('[data-report-btn][data-target-kind="tune"]');
  await expect(page.locator('[data-report-dialog]')).toBeVisible();
  await page.click('[data-report-cancel]');
  await expect(page.locator('[data-report-dialog]')).not.toBeVisible();
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npx playwright test tests/e2e/report-flow.spec.ts
```

Expected: FAIL — `[data-report-btn]` doesn't exist.

- [ ] **Step 3: Create `src/components/ReportButton.astro`**

```astro
---
type Props = { targetKind: 'tune' | 'review'; targetId: number; label?: string };
const { targetKind, targetId, label = '檢舉' } = Astro.props;
const turnstileSiteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA';
---
<button type="button"
  data-report-btn
  data-target-kind={targetKind}
  data-target-id={targetId}
  class="font-mono text-[10px] text-text-dim hover:text-pink bg-transparent border-0 cursor-pointer underline">
  {label}
</button>

<dialog data-report-dialog
  data-target-kind={targetKind}
  data-target-id={targetId}
  class="m-auto p-0 bg-bg-card border border-pink text-text max-w-md w-[90vw] backdrop:bg-bg/70">
  <form class="p-5 space-y-3">
    <div class="font-mono text-[11px] text-pink tracking-wider3">＞ 檢舉這筆{targetKind === 'tune' ? '調校' : '評論'}</div>
    <label class="block">
      <span class="label-mono">原因</span>
      <textarea name="reason" required maxlength="500" rows="4"
        class="mt-1.5 w-full bg-bg border border-line text-text p-2.5"></textarea>
    </label>
    <div class="cf-turnstile" data-sitekey={turnstileSiteKey}></div>
    <div class="flex justify-end gap-2.5 items-center">
      <span data-report-status class="text-text-dim text-[12px]"></span>
      <button type="button" data-report-cancel class="bg-transparent border border-line text-text-mute px-4 py-2 font-mono text-[12px]">取消</button>
      <button type="submit" data-report-submit class="bg-pink text-bg px-4 py-2 font-mono font-bold text-[12px] border-0">送出</button>
    </div>
  </form>
</dialog>

<script>
  // One handler per ReportButton instance — the [data-target-id] disambiguates dialogs
  document.querySelectorAll<HTMLButtonElement>('[data-report-btn]').forEach((btn) => {
    const kind = btn.dataset.targetKind!;
    const id = btn.dataset.targetId!;
    const dialog = document.querySelector<HTMLDialogElement>(
      `dialog[data-report-dialog][data-target-kind="${kind}"][data-target-id="${id}"]`
    );
    if (!dialog) return;
    const form = dialog.querySelector<HTMLFormElement>('form')!;
    const status = dialog.querySelector<HTMLElement>('[data-report-status]')!;
    const cancel = dialog.querySelector<HTMLButtonElement>('[data-report-cancel]')!;

    btn.addEventListener('click', () => {
      status.textContent = '';
      dialog.showModal();
    });
    cancel.addEventListener('click', () => dialog.close());

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const reason = String(fd.get('reason') ?? '').trim();
      if (!reason) { status.textContent = '請輸入原因'; return; }
      const token = (form.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement)?.value;
      if (!token) { status.textContent = '驗證元件未就緒，請稍候'; return; }
      status.textContent = '送出中…';
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_kind: kind,
          target_id: Number(id),
          reason,
          turnstile_token: token
        })
      }).catch(() => null);
      if (!res) { status.textContent = '網路錯誤'; return; }
      if (res.ok) {
        status.textContent = '感謝您的回報';
        setTimeout(() => dialog.close(), 1200);
      } else {
        const data = await res.json().catch(() => ({}));
        const map: Record<string, string> = {
          rate_limited: '回報太頻繁，請稍後再試',
          turnstile_failed: '驗證失敗，請重新整理後再試',
          missing_fields: '請輸入原因',
          invalid_target_kind: '無效的目標'
        };
        status.textContent = map[data.error] ?? `錯誤：${data.error ?? res.status}`;
      }
    });
  });
</script>
```

- [ ] **Step 4: Embed ReportButton in `src/pages/tune/[slug].astro`**

Add to imports (top of frontmatter):

```typescript
import ReportButton from '~/components/ReportButton.astro';
```

In the template, inside the title cluster (the `<div>` containing the eyebrow + h1 + car name + stats row), append at the end of that `<div>` (after the stats `<div class="flex gap-5 ...">` closes):

```astro
        <div class="mt-3"><ReportButton targetKind="tune" targetId={tune.id} /></div>
```

Inside each review card (the `.map((r) => ...)` block in the reviews section), after the rating line (the `<div class="text-cyan font-mono text-[12px]">★ {r.rating}</div>`), add a per-review report button. The cleanest place is to replace the existing `<div class="flex justify-between items-center mb-2.5">` cluster with a 3-cell layout including the report. But the simpler insert is just adding a row at the bottom of each card:

```astro
            {r.body && <p class="m-0 leading-relaxed text-text-soft text-[13px]">{r.body}</p>}
            <div class="mt-2 text-right"><ReportButton targetKind="review" targetId={r.id} /></div>
```

This requires `r.id` to be selected from the reviews query. Verify `listReviews` in `src/lib/db.ts:141-147` already returns `id` — it does. Also update the `reviews` array typing in `tune/[slug].astro` to include `id: number`:

```typescript
const reviews = reviewsResult.results as Array<{ id: number; author_handle: string; rating: number; body: string | null; created_at: number }>;
```

- [ ] **Step 5: Run tests, confirm pass**

```bash
npx playwright test tests/e2e/report-flow.spec.ts
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ReportButton.astro src/pages/tune/\[slug\].astro tests/e2e/report-flow.spec.ts
git commit -m "feat: report dialog for tunes and reviews"
```

---

### Task 4: /about page

**Files:**
- Create: `src/pages/about.astro`
- Test: `tests/e2e/about-page.spec.ts`

**Background:** The Footer already links to `/about` (`src/components/Footer.astro:10`) but the page 404s. Sprint 2 ships the page.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/about-page.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('about page renders and links back home', async ({ page }) => {
  const response = await page.goto('/about');
  expect(response?.status()).toBe(200);
  await expect(page.locator('main h1')).toContainText('關於');
  await expect(page.locator('main a[href="/"]')).toBeVisible();
});

test('about page is linked from footer', async ({ page }) => {
  await page.goto('/');
  await page.click('footer a[href="/about"]');
  await page.waitForURL('**/about');
  expect(page.url()).toMatch(/\/about$/);
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npx playwright test tests/e2e/about-page.spec.ts
```

Expected: FAIL — `/about` 404s (or rewrites to the 404 page if Sprint 1's wildcard kicks in).

- [ ] **Step 3: Create `src/pages/about.astro`**

```astro
---
import Base from '~/layouts/Base.astro';
---
<Base title="關於" description="touge.gg — Forza Horizon 6 玩家調校資料庫。">
  <section class="px-6 py-12 max-w-3xl mx-auto">
    <div class="font-mono text-[11px] text-pink tracking-wider3 mb-3">＞ ABOUT</div>
    <h1 class="text-[40px] font-extrabold mb-6">關於 touge.gg</h1>

    <div class="space-y-5 text-[15px] leading-relaxed text-text-soft">
      <p>
        <strong class="text-cyan">touge.gg</strong> 是 Forza Horizon 6 玩家社群驅動的調校資料庫。
        我們不上傳調校檔本身——只記錄玩家在遊戲內生成的<strong>分享碼</strong>、車輛、類型、PI 等級、和你的調校數值。
        其他玩家在遊戲裡輸入分享碼，就能下載你的調校。
      </p>

      <h2 class="text-[22px] font-bold pt-4">為什麼存在</h2>
      <p>
        FH6 遊戲內的調校搜尋只能用車輛和類型過濾，很難找到「峠路下坡專用」、「灣岸直線設定」這種具體用途的調校。
        這個站把分散在 Reddit、Discord、YouTube 留言的調校集中起來，加上評分、評論、賽道推薦，讓你找到能用的東西。
      </p>

      <h2 class="text-[22px] font-bold pt-4">怎麼用</h2>
      <ul class="list-disc list-inside space-y-1.5">
        <li>瀏覽 <a href="/browse" class="text-cyan">/browse</a> 找調校</li>
        <li>用 Header 搜尋框搜車輛或調校名稱</li>
        <li>找到喜歡的就按「複製分享碼」，回遊戲內貼上</li>
        <li>跑過之後留評分 + 評論幫助其他玩家</li>
        <li>有自己的調校就到 <a href="/upload" class="text-cyan">/upload</a> 上傳</li>
      </ul>

      <h2 class="text-[22px] font-bold pt-4">不需要註冊</h2>
      <p>
        上傳時設一組編輯密碼，之後拿密碼就能改/刪自己的調校。我們不存帳號、不存 email、只存 IP 的每日 salt 雜湊（用來防濫用）。
      </p>

      <h2 class="text-[22px] font-bold pt-4">關於版權</h2>
      <p class="text-text-mute text-[13px]">
        本站與 Microsoft 或 Playground Games 無任何關聯。Forza Horizon™ 是 Microsoft 的商標。
        所有調校數值、分享碼皆由玩家自願上傳，本站不託管任何遊戲檔案。
      </p>
    </div>

    <div class="mt-10 pt-6 border-t border-line flex gap-3">
      <a href="/" class="bg-cyan text-bg px-5 py-2.5 font-mono font-bold uppercase tracking-wider2 no-underline">回首頁</a>
      <a href="/browse" class="border border-line text-text px-5 py-2.5 font-mono font-bold uppercase tracking-wider2 no-underline">瀏覽調校</a>
    </div>
  </section>
</Base>
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
npx playwright test tests/e2e/about-page.spec.ts
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/about.astro tests/e2e/about-page.spec.ts
git commit -m "feat: add /about page"
```

---

### Task 5: Cloudflare Pages deployment runbook

**Files:**
- Create: `docs/DEPLOY.md`
- Modify: `wrangler.toml` — placeholder IDs need to be replaced after creating real resources
- Modify: `.gitignore` — confirm `.dev.vars` is ignored

**Background:** The project currently has `wrangler.toml` with `database_id = "local-development-placeholder"` and `id = "local-development-placeholder"` for KV. Real deployment needs:
1. Real D1 created via `wrangler d1 create`
2. Real KV namespace via `wrangler kv namespace create`
3. Real Turnstile site key + secret from Cloudflare dashboard
4. Real `IP_HASH_SALT` and `EDIT_COOKIE_SECRET` set via `wrangler secret put`
5. `wrangler pages deploy` invocation

This task is a **runbook**, not a TDD cycle. The plan documents the exact commands so a future deployer (you or a teammate) can follow it without guesswork.

- [ ] **Step 1: Confirm `.dev.vars` is gitignored**

Check `.gitignore` — if `.dev.vars` is missing, add it:

```bash
grep -q '^\.dev\.vars$' .gitignore || echo '.dev.vars' >> .gitignore
```

Also confirm a `.dev.vars.example` exists for documentation. If not, create it:

```bash
# .dev.vars.example — copy to .dev.vars (gitignored) and fill in for local dev
TURNSTILE_SECRET_KEY="1x0000000000000000000000000000000AA"  # Cloudflare-provided always-passes test secret
IP_HASH_SALT="local-dev-salt-please-change-in-prod"
EDIT_COOKIE_SECRET="local-dev-cookie-secret-32-chars-min"
PUBLIC_TURNSTILE_SITE_KEY="1x00000000000000000000AA"  # always-passes test site key
```

- [ ] **Step 2: Write `docs/DEPLOY.md`**

```markdown
# Deploying touge.gg to Cloudflare Pages

First-time setup ~30 minutes. Subsequent deploys ~2 minutes.

## Prerequisites

- Cloudflare account (free tier is fine)
- `wrangler` CLI authed: `npx wrangler login`
- A registered domain (or use the free `*.pages.dev` URL)

## 1. Create the production D1 database

```bash
npx wrangler d1 create fh6-tune-platform-prod
```

Copy the `database_id` from the output. Update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "fh6-tune-platform-prod"
database_id = "<paste-the-id-here>"
```

Apply migrations to production:

```bash
npx wrangler d1 execute fh6-tune-platform-prod --remote --file=migrations/0001_initial_schema.sql
npx wrangler d1 execute fh6-tune-platform-prod --remote --file=migrations/0002_seed_cars_tracks.sql
npx wrangler d1 execute fh6-tune-platform-prod --remote --file=migrations/0003_fts_car_columns.sql
```

(Skip `scripts/demo-tunes.sql` — that's dev seed only.)

## 2. Create the production KV namespace

```bash
npx wrangler kv namespace create KV
```

Copy the `id` from output. Update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "KV"
id = "<paste-the-id-here>"
```

## 3. Set up Turnstile

1. Go to https://dash.cloudflare.com → Turnstile → "Add site"
2. Domain: your prod domain (or `*.pages.dev` for the free subdomain)
3. Widget type: Managed
4. Copy the **site key** and **secret key**
5. Set them:

```bash
# Secret (server-side) — set via wrangler
npx wrangler secret put TURNSTILE_SECRET_KEY
# (paste the secret key from Turnstile dashboard when prompted)
```

The **public** site key gets injected at build time via env var. Set it in the Cloudflare Pages project dashboard:
- Project → Settings → Environment variables → Production
- Add `PUBLIC_TURNSTILE_SITE_KEY` = `<your site key>`

## 4. Set remaining secrets

```bash
# Generate strong random values:
openssl rand -hex 32  # use output for IP_HASH_SALT
openssl rand -hex 32  # use output for EDIT_COOKIE_SECRET

npx wrangler secret put IP_HASH_SALT
npx wrangler secret put EDIT_COOKIE_SECRET
```

## 5. Build and deploy

```bash
npm run build
npx wrangler pages deploy ./dist --project-name=fh6-tune-platform
```

(First deploy will prompt you to create the Pages project — accept defaults.)

## 6. Verify

After deploy completes, visit the printed `*.pages.dev` URL and walk through:

- [ ] Homepage loads, shows 0 tunes (prod DB is empty until first upload)
- [ ] `/browse` shows empty state
- [ ] `/upload` form renders with all 51 cars in dropdown
- [ ] Upload a test tune — confirm it appears at `/tune/{slug}`
- [ ] `/tune/{slug}` review form: submit a 5-star review
- [ ] `/tune/{slug}` copy share code → download_count should increment
- [ ] `/browse?q=<car-name>` returns results
- [ ] `/404-fake-route` returns HTTP 404 with branded page
- [ ] `/about` renders

## 7. Custom domain (optional)

Pages → your project → Custom domains → Add. Follow the DNS instructions.

## Subsequent deploys

After the first setup:

```bash
npm run build && npx wrangler pages deploy ./dist --project-name=fh6-tune-platform
```

That's it.

## Migrating schema changes to prod

When you add a new migration file `migrations/000N_xxx.sql`:

```bash
npx wrangler d1 execute fh6-tune-platform-prod --remote --file=migrations/000N_xxx.sql
```

Always test the migration against local D1 (`--local`) first.

## Rolling back

If a deploy breaks prod:

```bash
# List recent deploys
npx wrangler pages deployment list --project-name=fh6-tune-platform

# Promote a previous deploy
npx wrangler pages deployment rollback <deployment-id> --project-name=fh6-tune-platform
```

D1 schema rollbacks have to be done manually with a reverse migration.
```

- [ ] **Step 3: Verify the runbook is internally consistent**

Do a paper read:
- All env vars mentioned in DEPLOY.md exist in `src/env.d.ts`? Yes: `PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `IP_HASH_SALT`, `EDIT_COOKIE_SECRET`.
- All migration files referenced exist? Yes: 0001, 0002, plus 0003 from Task 2 of this Sprint.
- Cloudflare Turnstile test keys mentioned are actually the documented always-pass ones? Yes — `1x0000000000000000000000000000000AA` (secret) and `1x00000000000000000000AA` (site key) are the documented dev keys.

- [ ] **Step 4: Commit**

```bash
git add docs/DEPLOY.md .gitignore .dev.vars.example
git commit -m "docs: add first-time Cloudflare Pages deployment runbook"
```

---

## After All Tasks: Final Verification

- [ ] **Run the entire test suite**

```bash
npm run check && npm test && npx playwright test
```

Expected: all pass. (May need to clear KV rate-limit keys between e2e runs — see Task 1 quirk in Sprint 1 plan.)

- [ ] **End-to-end smoke walk in browser**

Dev server: `npm run dev`. Then:
1. `/tune/toyota-supra-mk4-1994-demo04` — recommended tracks section visible (assuming Task 1 attached track 5)
2. Click 「檢舉」 on the tune → dialog opens → fill reason → submit → "感謝您的回報"
3. Click 「檢舉」 on a review card → dialog opens
4. `/about` renders
5. `/browse?q=supra` returns the Supra MK4 tune (Task 2 FTS extension)
6. `/browse?q=miata` returns the Miata tune

- [ ] **DEPLOY.md walk-through (optional, real deploy)**

If you want to actually push to prod now, follow `docs/DEPLOY.md` end to end. This is not required for the sprint to be considered complete — the doc itself is the deliverable.

- [ ] **Sprint 2 complete**

Site is launch-ready. Sprint 3 (per-field tune-values upload form + /tracks + /tuner + "my tunes") becomes the next planning target.
