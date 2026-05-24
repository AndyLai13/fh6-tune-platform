# Sprint 3: Discovery Pages + Per-Field Upload Form

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the discovery surfaces a community site needs — browse by track, browse by tuner, "my tunes" personal list — and replace the JSON-paste upload textarea with a per-field tune values form that real users can actually use.

**Architecture:** All new pages are SSR Astro routes hitting D1 via the existing `lib/db.ts` helpers (with two new helpers added: `listTunesForTrack`, `listTunesForTuner`). The TuneValuesForm becomes a shared Astro island used by both `/upload` and `/edit/[slug]`, eliminating the JSON-paste textarea. `/my` is fully client-side, reading the existing `localStorage['mytunes']` array populated on upload.

**Tech Stack:** Astro 6 (server output) · Cloudflare Pages · D1 (SQLite + FTS5) · KV · Tailwind v4 · Playwright · Vitest.

---

## File Structure Overview

**New files:**
- `src/pages/tracks/index.astro` — list all tracks grouped by region
- `src/pages/tracks/[slug].astro` — track detail + tunes that recommend it
- `src/pages/tuner/[handle].astro` — public tunes by author_handle
- `src/pages/my.astro` — personal tune list from localStorage
- `src/components/TuneValuesForm.astro` — per-field form replacing JSON textarea
- `src/data/tune-value-fields.ts` — declarative field metadata (label, group, range, key, axis) driving the form
- `tests/e2e/tracks-pages.spec.ts`
- `tests/e2e/tuner-profile.spec.ts`
- `tests/e2e/my-tunes-page.spec.ts`
- `tests/e2e/upload-perfield.spec.ts`

**Modified files:**
- `src/lib/db.ts` — add `listTunesForTrack(db, trackId)`, `listTunesForTuner(db, handle)`, `listAllTracks(db)`
- `src/components/Header.astro` — add `/tracks` and `/my` nav links (uses existing `nav.tracks` i18n key + new `nav.my` key)
- `src/i18n/en.json` — add `nav.my` key
- `src/pages/upload.astro` — replace the JSON `<textarea>` with `<TuneValuesForm initial={sample} />`; submit handler reads fields by name from `data-tune-field` instead of parsing JSON
- `src/pages/edit/[slug].astro` — same swap
- `src/components/TuneCard.astro` — make author handle a link to `/tuner/{handle}`

**Task order rationale:** Build smallest-first to ship value fast and prove patterns. Task 1 (/my) is pure client. Task 2 (/tracks list) is a single query. Task 3 (/tracks/[slug]) extends Task 2. Task 4 (/tuner) parallels track detail. Task 5 (TuneValuesForm) is the biggest and goes last — by then the codebase rhythm is set.

---

### Task 1: /my — local-storage tune list

**Files:**
- Create: `src/pages/my.astro`
- Modify: `src/components/Header.astro` — add nav link
- Modify: `src/i18n/en.json` — add `nav.my` key
- Test: `tests/e2e/my-tunes-page.spec.ts`

**Background:** `src/pages/upload.astro:161-163` already pushes `{ slug, editUrl, savedAt }` to `localStorage['mytunes']` on every successful upload. We just need a page that reads it back. No D1, no API call needed.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/my-tunes-page.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('my page shows seeded localStorage entries', async ({ page }) => {
  await page.goto('/my');
  // seed localStorage from inside the page context
  await page.evaluate(() => {
    localStorage.setItem('mytunes', JSON.stringify([
      { slug: 'toyota-supra-mk4-1994-demo04', editUrl: '/edit/toyota-supra-mk4-1994-demo04', savedAt: Date.now() - 86400000 },
      { slug: 'mazda-mx5-miata-na-1989-demo06', editUrl: '/edit/mazda-mx5-miata-na-1989-demo06', savedAt: Date.now() }
    ]));
  });
  await page.reload();
  await expect(page.locator('[data-my-tune]')).toHaveCount(2);
  await expect(page.locator('a[href="/tune/toyota-supra-mk4-1994-demo04"]')).toBeVisible();
  await expect(page.locator('a[href="/edit/toyota-supra-mk4-1994-demo04"]')).toBeVisible();
});

test('my page shows empty state when localStorage is empty', async ({ page }) => {
  await page.goto('/my');
  await page.evaluate(() => localStorage.removeItem('mytunes'));
  await page.reload();
  await expect(page.locator('[data-my-empty]')).toBeVisible();
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npx playwright test tests/e2e/my-tunes-page.spec.ts
```

Expected: FAIL — `/my` route doesn't exist.

- [ ] **Step 3: Create `src/pages/my.astro`**

```astro
---
import Base from '~/layouts/Base.astro';
---
<Base title="我的調校" description="本機保存的調校列表。">
  <section class="px-6 py-10 max-w-4xl mx-auto">
    <div class="font-mono text-[11px] text-pink tracking-wider3 mb-2">＞ 我的調校</div>
    <h1 class="text-[32px] font-extrabold mb-6">我的調校</h1>
    <p class="text-text-mute text-[13px] mb-6">這份列表只存在你的瀏覽器 localStorage 裡。換瀏覽器或清快取會消失。</p>

    <div data-my-empty class="hidden bg-bg-card border-l-[3px] border-line p-5">
      <div class="font-mono text-[11px] text-text-dim tracking-wider2 mb-2">＞ 空空如也</div>
      <p class="text-text-mute m-0 mb-4">還沒有上傳過任何調校。</p>
      <a href="/upload" class="bg-cyan text-bg px-5 py-2.5 font-mono font-bold uppercase tracking-wider2 no-underline">+ 上傳第一筆</a>
    </div>

    <ul data-my-list class="hidden m-0 p-0 list-none space-y-2"></ul>
  </section>

  <script>
    type MyTune = { slug: string; editUrl: string; savedAt: number };
    const raw = localStorage.getItem('mytunes');
    const list = raw ? (JSON.parse(raw) as MyTune[]) : [];
    const listEl = document.querySelector<HTMLElement>('[data-my-list]')!;
    const emptyEl = document.querySelector<HTMLElement>('[data-my-empty]')!;

    if (list.length === 0) {
      emptyEl.classList.remove('hidden');
    } else {
      listEl.classList.remove('hidden');
      // Newest first
      list.sort((a, b) => b.savedAt - a.savedAt);
      for (const t of list) {
        const li = document.createElement('li');
        li.setAttribute('data-my-tune', '');
        li.className = 'bg-bg-card border-l-[3px] border-cyan p-4 flex justify-between items-center';
        const d = new Date(t.savedAt).toISOString().slice(0, 10);
        li.innerHTML = `
          <div>
            <a href="/tune/${t.slug}" class="font-mono text-[13px] text-text no-underline">/tune/${t.slug}</a>
            <div class="font-mono text-[10px] text-text-dim mt-0.5">儲存於 ${d}</div>
          </div>
          <a href="${t.editUrl}" class="font-mono text-[11px] text-cyan no-underline">編輯 →</a>
        `;
        listEl.appendChild(li);
      }
    }
  </script>
</Base>
```

- [ ] **Step 4: Add nav link in Header**

In `src/i18n/en.json` add the key (existing keys keep their position):

```json
{
  "nav.browse": "瀏覽",
  "nav.upload": "上傳",
  "nav.tuners": "熱門調校師",
  "nav.tracks": "賽道",
  "nav.news": "消息",
  "nav.my": "我的",
  "search.placeholder": "搜尋車輛、賽道、調校師…",
  "cta.upload": "+ 上傳調校",
  "footer.disclaimer": "本站與 Microsoft / Playground Games 無關"
}
```

In `src/components/Header.astro`, find the `<nav>` block (lines 13-16) and add the `/my` link:

```astro
    <nav class="flex gap-5 text-[13px] font-medium">
      <a href="/browse" class:list={[isActive('/browse') ? 'text-text border-b-2 border-cyan pb-1' : 'text-text-mute']}>{t['nav.browse']}</a>
      <a href="/tracks" class:list={[isActive('/tracks') ? 'text-text border-b-2 border-cyan pb-1' : 'text-text-mute']}>{t['nav.tracks']}</a>
      <a href="/upload" class:list={[isActive('/upload') ? 'text-text border-b-2 border-cyan pb-1' : 'text-text-mute']}>{t['nav.upload']}</a>
      <a href="/my" class:list={[isActive('/my') ? 'text-text border-b-2 border-cyan pb-1' : 'text-text-mute']}>{t['nav.my']}</a>
    </nav>
```

(Note: `/tracks` link added here in preparation for Task 2; visiting it will 404 until Task 2 lands, which is fine within the sprint.)

- [ ] **Step 5: Run tests, confirm pass**

```bash
npx playwright test tests/e2e/my-tunes-page.spec.ts
```

Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/my.astro src/components/Header.astro src/i18n/en.json tests/e2e/my-tunes-page.spec.ts
git commit -m "feat: /my page reads localStorage and lists user's tunes"
```

---

### Task 2: /tracks — list all tracks grouped by region

**Files:**
- Create: `src/pages/tracks/index.astro`
- Modify: `src/lib/db.ts` — add `listAllTracks`
- Test: `tests/e2e/tracks-pages.spec.ts` (this test file will get extended in Task 3)

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/tracks-pages.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('/tracks lists all seeded tracks grouped by region', async ({ page }) => {
  await page.goto('/tracks');
  await expect(page.locator('main h1')).toContainText('賽道');

  // All 10 seeded tracks should render
  const trackLinks = page.locator('a[href^="/tracks/"]');
  expect(await trackLinks.count()).toBe(10);

  // Region headers appear
  await expect(page.locator('main')).toContainText('Touge');
  await expect(page.locator('main')).toContainText('Circuit');
  await expect(page.locator('main')).toContainText('Off-road');

  // Specific tracks visible
  await expect(page.locator('a[href="/tracks/mt-akina-downhill"]')).toBeVisible();
  await expect(page.locator('a[href="/tracks/suzuka-circuit"]')).toBeVisible();
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npx playwright test tests/e2e/tracks-pages.spec.ts
```

Expected: FAIL — `/tracks` 404s.

- [ ] **Step 3: Add `listAllTracks` to `src/lib/db.ts`**

After the existing `getTrackBySlug` function (around line 36-38), add:

```typescript
export async function listAllTracks(db: D1Database) {
  return db.prepare(`
    SELECT id, name, slug, surface, length_km, region
    FROM tracks
    ORDER BY region, name
  `).all<{ id: number; name: string; slug: string; surface: string; length_km: number | null; region: string | null }>();
}
```

- [ ] **Step 4: Create `src/pages/tracks/index.astro`**

```astro
---
import Base from '~/layouts/Base.astro';
import { listAllTracks } from '~/lib/db';
import { env } from 'cloudflare:workers';

export const prerender = false;

const result = await listAllTracks(env.DB);
const tracks = result.results as Array<{ id: number; name: string; slug: string; surface: string; length_km: number | null; region: string | null }>;

const byRegion = new Map<string, typeof tracks>();
for (const t of tracks) {
  const region = t.region ?? '其他';
  if (!byRegion.has(region)) byRegion.set(region, []);
  byRegion.get(region)!.push(t);
}
---
<Base title="賽道" description="FH6 全部賽道列表。">
  <section class="px-6 py-10 max-w-4xl mx-auto">
    <div class="font-mono text-[11px] text-pink tracking-wider3 mb-2">＞ TRACKS</div>
    <h1 class="text-[32px] font-extrabold mb-6">賽道 · {tracks.length} 條</h1>

    <div class="space-y-8">
      {Array.from(byRegion.entries()).map(([region, list]) => (
        <div>
          <h2 class="font-mono text-[12px] text-cyan tracking-wider3 mb-3 pb-2 border-b border-line">＞ {region.toUpperCase()}</h2>
          <ul class="m-0 p-0 list-none grid grid-cols-1 md:grid-cols-2 gap-2">
            {list.map((t) => (
              <li>
                <a href={`/tracks/${t.slug}`}
                   class="block bg-bg-card border border-line p-3 no-underline hover:border-cyan">
                  <div class="text-text font-semibold text-[14px]">{t.name}</div>
                  <div class="font-mono text-[11px] text-text-dim mt-0.5">
                    {t.surface}{t.length_km && ` · ${t.length_km} km`}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  </section>
</Base>
```

- [ ] **Step 5: Run tests, confirm pass**

```bash
npx playwright test tests/e2e/tracks-pages.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts src/pages/tracks/index.astro tests/e2e/tracks-pages.spec.ts
git commit -m "feat: /tracks lists all tracks grouped by region"
```

---

### Task 3: /tracks/[slug] — track detail + tunes that recommend it

**Files:**
- Create: `src/pages/tracks/[slug].astro`
- Modify: `src/lib/db.ts` — add `listTunesForTrack`
- Test: append to `tests/e2e/tracks-pages.spec.ts`

- [ ] **Step 1: Append the failing test**

Add to `tests/e2e/tracks-pages.spec.ts`:

```typescript
import { execSync } from 'node:child_process';

test('/tracks/{slug} shows track info and recommending tunes', async ({ page }) => {
  // Attach Tsukuba (id 5) to the Supra demo so we have something to find
  execSync(
    `npx wrangler d1 execute fh6-tune-platform-local --local --command="DELETE FROM tune_tracks WHERE track_id = 5; INSERT INTO tune_tracks (tune_id, track_id) SELECT id, 5 FROM tunes WHERE slug = 'toyota-supra-mk4-1994-demo04';"`,
    { stdio: 'pipe' }
  );

  await page.goto('/tracks/tsukuba-circuit');
  await expect(page.locator('main h1')).toContainText('Tsukuba Circuit');
  await expect(page.locator('main')).toContainText('Circuit');

  // The Supra tune linked via tune_tracks should appear
  await expect(page.locator('a[href="/tune/toyota-supra-mk4-1994-demo04"]')).toBeVisible();
});

test('/tracks/{unknown} returns 404', async ({ page }) => {
  const response = await page.goto('/tracks/this-track-does-not-exist');
  expect(response?.status()).toBe(404);
});
```

- [ ] **Step 2: Run, confirm new tests fail**

```bash
npx playwright test tests/e2e/tracks-pages.spec.ts
```

Expected: original 1 test passes, 2 new tests FAIL (`/tracks/{slug}` route doesn't exist).

- [ ] **Step 3: Add `listTunesForTrack` to `src/lib/db.ts`**

Below `listAllTracks`, add:

```typescript
export async function listTunesForTrack(db: D1Database, trackId: number) {
  return db.prepare(`
    SELECT t.*, c.year AS car_year, c.make AS car_make, c.model AS car_model, c.slug AS car_slug
    FROM tunes t
    JOIN tune_tracks tt ON tt.tune_id = t.id
    JOIN cars c ON c.id = t.car_id
    WHERE tt.track_id = ? AND t.status = 'public'
    ORDER BY t.download_count DESC
  `).bind(trackId).all();
}
```

- [ ] **Step 4: Create `src/pages/tracks/[slug].astro`**

```astro
---
import Base from '~/layouts/Base.astro';
import TuneCard from '~/components/TuneCard.astro';
import { getTrackBySlug, listTunesForTrack } from '~/lib/db';
import { env } from 'cloudflare:workers';

export const prerender = false;

const slug = Astro.params.slug!;
const track = await getTrackBySlug(env.DB, slug) as { id: number; name: string; slug: string; surface: string; length_km: number | null; region: string | null } | null;
if (!track) {
  Astro.response.status = 404;
  return Astro.rewrite('/404');
}

const tunesResult = await listTunesForTrack(env.DB, track.id);
const tunes = tunesResult.results as Array<any>;
---
<Base title={track.name} description={`Tunes recommended for ${track.name}.`}>
  <section class="px-6 py-10 max-w-6xl mx-auto">
    <div class="font-mono text-[11px] text-pink tracking-wider3 mb-2">＞ TRACK / {track.region ?? '—'}</div>
    <h1 class="text-[36px] md:text-[48px] font-extrabold mb-2">{track.name}</h1>
    <div class="font-mono text-[12px] text-text-mute mb-8">
      {track.surface}{track.length_km && ` · ${track.length_km} km`}{track.region && ` · ${track.region}`}
    </div>

    <h2 class="text-[20px] font-bold mb-4">推薦此賽道的調校 · {tunes.length}</h2>

    {tunes.length === 0 ? (
      <div data-empty-state class="bg-bg-card border-l-[3px] border-line p-5">
        <p class="text-text-mute m-0">還沒有調校推薦這條賽道。</p>
      </div>
    ) : (
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {tunes.map((r: any, i: number) => (
          <TuneCard
            slug={r.slug} name={r.name} shareCode={r.share_code}
            carYear={r.car_year} carMake={r.car_make} carModel={r.car_model}
            piClass={r.pi_class} tuneType={r.tune_type} drivetrain={r.drivetrain}
            rating={r.rating_count > 0 ? r.rating_sum / r.rating_count : 0}
            downloads={r.download_count} authorHandle={r.author_handle}
            accent={i % 3 === 1 ? 'pink' : 'cyan'} />
        ))}
      </div>
    )}
  </section>
</Base>
```

- [ ] **Step 5: Run tests, confirm pass**

```bash
npx playwright test tests/e2e/tracks-pages.spec.ts
```

Expected: 3 tests PASS (including the original /tracks listing test).

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts src/pages/tracks/\[slug\].astro tests/e2e/tracks-pages.spec.ts
git commit -m "feat: /tracks/{slug} shows tunes recommending this track"
```

---

### Task 4: /tuner/[handle] — public tunes by author

**Files:**
- Create: `src/pages/tuner/[handle].astro`
- Modify: `src/lib/db.ts` — add `listTunesForTuner`
- Modify: `src/components/TuneCard.astro` — make `@handle` a link to `/tuner/{handle}`
- Test: `tests/e2e/tuner-profile.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/tuner-profile.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('/tuner/{handle} lists all tunes by that author', async ({ page }) => {
  // demo seed: 'two_j_zee' is the author of the 2JZ Supra demo
  await page.goto('/tuner/two_j_zee');
  await expect(page.locator('main h1')).toContainText('two_j_zee');
  await expect(page.locator('a[href="/tune/toyota-supra-mk4-1994-demo04"]')).toBeVisible();
});

test('/tuner/{unknown} shows empty state, not 404', async ({ page }) => {
  // Unknown handles render the page with empty state — same UX as a tuner who hasn't uploaded
  const response = await page.goto('/tuner/nobody_here_12345');
  expect(response?.status()).toBe(200);
  await expect(page.locator('[data-empty-state]')).toBeVisible();
});

test('clicking author handle on a tune card navigates to tuner profile', async ({ page }) => {
  await page.goto('/browse');
  // First card has author handle as a link
  const firstHandle = page.locator('a[href^="/tuner/"]').first();
  const href = await firstHandle.getAttribute('href');
  expect(href).toMatch(/^\/tuner\/.+/);
  await firstHandle.click();
  await expect(page.locator('main h1')).toContainText('@');
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npx playwright test tests/e2e/tuner-profile.spec.ts
```

Expected: FAIL — `/tuner/{handle}` 404s and TuneCard handle isn't a link.

- [ ] **Step 3: Add `listTunesForTuner` to `src/lib/db.ts`**

Below `listTunesForTrack`, add:

```typescript
export async function listTunesForTuner(db: D1Database, handle: string) {
  return db.prepare(`
    SELECT t.*, c.year AS car_year, c.make AS car_make, c.model AS car_model, c.slug AS car_slug
    FROM tunes t
    JOIN cars c ON c.id = t.car_id
    WHERE t.author_handle = ? AND t.status = 'public'
    ORDER BY t.created_at DESC
  `).bind(handle).all();
}
```

- [ ] **Step 4: Create `src/pages/tuner/[handle].astro`**

```astro
---
import Base from '~/layouts/Base.astro';
import TuneCard from '~/components/TuneCard.astro';
import { listTunesForTuner } from '~/lib/db';
import { env } from 'cloudflare:workers';

export const prerender = false;

const handle = Astro.params.handle!;
const tunesResult = await listTunesForTuner(env.DB, handle);
const tunes = tunesResult.results as Array<any>;

const totalDownloads = tunes.reduce((sum: number, t: any) => sum + (t.download_count ?? 0), 0);
const ratedCount = tunes.filter((t: any) => t.rating_count > 0).length;
const avgRating = ratedCount > 0
  ? tunes.reduce((sum: number, t: any) => t.rating_count > 0 ? sum + (t.rating_sum / t.rating_count) : sum, 0) / ratedCount
  : 0;
---
<Base title={`@${handle}`} description={`${handle} 的調校列表。`}>
  <section class="px-6 py-10 max-w-6xl mx-auto">
    <div class="font-mono text-[11px] text-pink tracking-wider3 mb-2">＞ TUNER</div>
    <h1 class="text-[36px] md:text-[48px] font-extrabold mb-2">@{handle}</h1>
    <div class="font-mono text-[12px] text-text-mute mb-8">
      {tunes.length} 筆調校 · ↓ {totalDownloads.toLocaleString()} 次下載
      {ratedCount > 0 && ` · ★ ${avgRating.toFixed(1)} 平均評分`}
    </div>

    {tunes.length === 0 ? (
      <div data-empty-state class="bg-bg-card border-l-[3px] border-line p-5">
        <div class="font-mono text-[11px] text-text-dim tracking-wider2 mb-2">＞ 空空如也</div>
        <p class="text-text-mute m-0">@{handle} 還沒有公開的調校。</p>
      </div>
    ) : (
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {tunes.map((r: any, i: number) => (
          <TuneCard
            slug={r.slug} name={r.name} shareCode={r.share_code}
            carYear={r.car_year} carMake={r.car_make} carModel={r.car_model}
            piClass={r.pi_class} tuneType={r.tune_type} drivetrain={r.drivetrain}
            rating={r.rating_count > 0 ? r.rating_sum / r.rating_count : 0}
            downloads={r.download_count} authorHandle={r.author_handle}
            accent={i % 3 === 1 ? 'pink' : 'cyan'} />
        ))}
      </div>
    )}
  </section>
</Base>
```

- [ ] **Step 5: Update `src/components/TuneCard.astro` — make `@handle` a link**

Find the line `<span>@{authorHandle}</span>` (around line 31) and replace with:

```astro
    <a href={`/tuner/${authorHandle}`} class="text-text-dim hover:text-cyan no-underline">@{authorHandle}</a>
```

- [ ] **Step 6: Run tests, confirm pass**

```bash
npx playwright test tests/e2e/tuner-profile.spec.ts
```

Expected: 3 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db.ts src/pages/tuner/\[handle\].astro src/components/TuneCard.astro tests/e2e/tuner-profile.spec.ts
git commit -m "feat: /tuner/{handle} profile page + clickable author links on cards"
```

---

### Task 5: Per-field TuneValuesForm replacing JSON paste

**Files:**
- Create: `src/data/tune-value-fields.ts` — declarative metadata
- Create: `src/components/TuneValuesForm.astro` — the form component
- Modify: `src/pages/upload.astro` — swap JSON textarea for `<TuneValuesForm />`
- Modify: `src/pages/edit/[slug].astro` — same swap
- Test: `tests/e2e/upload-perfield.spec.ts`

**Background:** `TuneValues` (in `src/data/tune-schema.ts`) has 30 numeric fields across 9 sections. `validateTuneValues` (in `src/lib/tune-values.ts`) walks the same 30-field SCHEMA array enforcing ranges. The form mirrors that structure with labeled `<input type="number">` per field, grouped visually by section (tires, gearing, alignment, etc.). On submit, the upload handler builds the nested object from `name="tires.pressure_f"` etc. paths.

The field metadata is declarative — `tune-value-fields.ts` lists every field's path, label, group, range key, and axis (F/R or undefined). The form maps over that. The upload submit handler reads `FormData` entries beginning with `tv.` (tune-values namespace) and reconstructs the nested object before posting.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/upload-perfield.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('upload form renders per-field inputs grouped by section', async ({ page }) => {
  await page.goto('/upload');

  // Section legends (9 sections) — match the legend visible text from the form
  for (const section of ['輪胎', '變速箱', '定位', '防傾桿', '彈簧', '阻尼', '空力', '煞車', '差速器']) {
    await expect(page.locator(`text=${section}`).first()).toBeVisible();
  }

  // Specific fields visible as named inputs
  await expect(page.locator('input[name="tv.tires.pressure_f"]')).toBeVisible();
  await expect(page.locator('input[name="tv.gearing.final"]')).toBeVisible();
  await expect(page.locator('input[name="tv.diff.accel_pct"]')).toBeVisible();

  // The old JSON textarea is gone
  await expect(page.locator('textarea[name="_tune_values_json"]')).toHaveCount(0);
});

test('per-field inputs are pre-filled with sample values', async ({ page }) => {
  await page.goto('/upload');
  // Sample value for tires.pressure_f is 28.5 (from sampleTuneValues)
  await expect(page.locator('input[name="tv.tires.pressure_f"]')).toHaveValue('28.5');
});

test('edit page renders per-field inputs from the loaded tune', async ({ page }) => {
  await page.goto('/edit/toyota-supra-mk4-1994-demo04');
  // The demo seed uses sampleTuneValues() for all tunes, so we know the values
  await expect(page.locator('input[name="tv.tires.pressure_f"]')).toBeVisible();
  await expect(page.locator('input[name="tv.tires.pressure_f"]')).toHaveValue('28.5');
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npx playwright test tests/e2e/upload-perfield.spec.ts
```

Expected: all 3 fail — `tv.tires.pressure_f` doesn't exist, old textarea still present.

- [ ] **Step 3: Create `src/data/tune-value-fields.ts`**

```typescript
// Declarative metadata driving TuneValuesForm.astro.
// `path` mirrors src/data/tune-schema.ts dotted property; `range` keys src/data/tune-schema.ts:TUNE_VALUE_RANGES.

export type TuneFieldGroup = {
  key: keyof import('~/data/tune-schema').TuneValues;
  legend: string;
  fields: Array<{
    path: string;          // e.g. 'tires.pressure_f' (joined with 'tv.' in form name attr)
    label: string;
    range: string;         // key into TUNE_VALUE_RANGES
    axis?: 'F' | 'R';      // 'F'/'R' renders with an axis chip
    unit?: string;
    step?: string;         // HTML number input step; defaults to 0.1
  }>;
};

export const TUNE_FIELD_GROUPS: TuneFieldGroup[] = [
  { key: 'tires', legend: '輪胎', fields: [
    { path: 'tires.pressure_f', label: '胎壓', range: 'pressure', axis: 'F', unit: 'psi' },
    { path: 'tires.pressure_r', label: '胎壓', range: 'pressure', axis: 'R', unit: 'psi' }
  ]},
  { key: 'gearing', legend: '變速箱', fields: [
    { path: 'gearing.final', label: '終傳比', range: 'final', step: '0.01' },
    { path: 'gearing.g1', label: '1 檔', range: 'gear', step: '0.01' },
    { path: 'gearing.g2', label: '2 檔', range: 'gear', step: '0.01' },
    { path: 'gearing.g3', label: '3 檔', range: 'gear', step: '0.01' },
    { path: 'gearing.g4', label: '4 檔', range: 'gear', step: '0.01' },
    { path: 'gearing.g5', label: '5 檔', range: 'gear', step: '0.01' },
    { path: 'gearing.g6', label: '6 檔', range: 'gear', step: '0.01' }
  ]},
  { key: 'alignment', legend: '定位', fields: [
    { path: 'alignment.camber_f', label: '外傾角', range: 'camber', axis: 'F', unit: '°' },
    { path: 'alignment.camber_r', label: '外傾角', range: 'camber', axis: 'R', unit: '°' },
    { path: 'alignment.toe_f', label: '束角', range: 'toe', axis: 'F', unit: '°' },
    { path: 'alignment.toe_r', label: '束角', range: 'toe', axis: 'R', unit: '°' },
    { path: 'alignment.caster', label: '後傾角', range: 'caster', unit: '°' }
  ]},
  { key: 'antiroll', legend: '防傾桿', fields: [
    { path: 'antiroll.stiffness_f', label: '硬度', range: 'arb', axis: 'F' },
    { path: 'antiroll.stiffness_r', label: '硬度', range: 'arb', axis: 'R' }
  ]},
  { key: 'springs', legend: '彈簧', fields: [
    { path: 'springs.rate_f', label: '彈簧係數', range: 'spring_rate', axis: 'F', unit: 'lb/in', step: '1' },
    { path: 'springs.rate_r', label: '彈簧係數', range: 'spring_rate', axis: 'R', unit: 'lb/in', step: '1' },
    { path: 'springs.height_f', label: '車身高度', range: 'height', axis: 'F', unit: 'in' },
    { path: 'springs.height_r', label: '車身高度', range: 'height', axis: 'R', unit: 'in' }
  ]},
  { key: 'damping', legend: '阻尼', fields: [
    { path: 'damping.rebound_f', label: '回彈', range: 'damp', axis: 'F' },
    { path: 'damping.rebound_r', label: '回彈', range: 'damp', axis: 'R' },
    { path: 'damping.bump_f', label: '壓縮', range: 'damp', axis: 'F' },
    { path: 'damping.bump_r', label: '壓縮', range: 'damp', axis: 'R' }
  ]},
  { key: 'aero', legend: '空力', fields: [
    { path: 'aero.front', label: '前下擾流', range: 'aero_lb', unit: 'lb', step: '1' },
    { path: 'aero.rear', label: '後尾翼', range: 'aero_lb', unit: 'lb', step: '1' }
  ]},
  { key: 'brakes', legend: '煞車', fields: [
    { path: 'brakes.balance_pct_f', label: '前後分配', range: 'brake_pct', unit: '% F', step: '1' },
    { path: 'brakes.pressure_pct', label: '煞車力', range: 'brake_pct', unit: '%', step: '1' }
  ]},
  { key: 'diff', legend: '差速器', fields: [
    { path: 'diff.accel_pct', label: '加速鎖定', range: 'diff_pct', unit: '%', step: '1' },
    { path: 'diff.decel_pct', label: '減速鎖定', range: 'diff_pct', unit: '%', step: '1' }
  ]}
];
```

- [ ] **Step 4: Create `src/components/TuneValuesForm.astro`**

```astro
---
import type { TuneValues } from '~/data/tune-schema';
import { TUNE_VALUE_RANGES } from '~/data/tune-schema';
import { TUNE_FIELD_GROUPS } from '~/data/tune-value-fields';

type Props = { initial: TuneValues };
const { initial } = Astro.props;

function getInitial(path: string): number {
  return path.split('.').reduce((acc: any, key) => (acc == null ? acc : acc[key]), initial) as number;
}
---
<div data-tune-values-form class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-px bg-line font-mono">
  {TUNE_FIELD_GROUPS.map((group) => (
    <div class="bg-bg-card p-4">
      <div class="text-[10px] text-pink uppercase tracking-wider3 mb-3">{group.legend}</div>
      <div class="space-y-2">
        {group.fields.map((f) => {
          const range = TUNE_VALUE_RANGES[f.range];
          const initialVal = getInitial(f.path);
          return (
            <label class="grid grid-cols-[1fr_auto] gap-2 items-center text-[12px]">
              <span class="text-text-dim">
                {f.label}{f.axis && <span class="ml-1 text-text-mute text-[10px]">[{f.axis}]</span>}
                {f.unit && <span class="ml-1 text-text-dim text-[10px]">{f.unit}</span>}
              </span>
              <input
                type="number"
                name={`tv.${f.path}`}
                data-tune-field={f.path}
                value={initialVal}
                min={range.min}
                max={range.max}
                step={f.step ?? '0.1'}
                required
                class="w-20 bg-bg border border-line text-text px-2 py-1 text-right font-mono text-[12px]"
              />
            </label>
          );
        })}
      </div>
    </div>
  ))}
</div>
```

- [ ] **Step 5: Modify `src/pages/upload.astro` — swap textarea for component**

In the imports (top of frontmatter), add:

```typescript
import TuneValuesForm from '~/components/TuneValuesForm.astro';
```

Find the fieldset 03 block (around lines 74-78):

```astro
      <fieldset class="bg-bg-card border border-line p-5">
        <legend class="font-mono text-[11px] text-text tracking-wider3">03 ＞ 調校數值（從 FH6 貼上）</legend>
        <p class="text-text-dim text-[12px] mt-2">MVP 暫用：直接以 JSON 貼上調校數值。v1.1 將提供逐欄輸入。</p>
        <textarea name="_tune_values_json" rows="10" class="mt-2 w-full bg-bg border border-line text-text font-mono text-[11px] p-2">{JSON.stringify(sample, null, 2)}</textarea>
      </fieldset>
```

Replace with:

```astro
      <fieldset class="bg-bg-card border border-line p-5">
        <legend class="font-mono text-[11px] text-text tracking-wider3">03 ＞ 調校數值</legend>
        <p class="text-text-dim text-[12px] mt-2 mb-3">數值已預填合理範例，按 FH6 內顯示的數字逐欄輸入即可。</p>
        <TuneValuesForm initial={sample} />
      </fieldset>
```

In the script block, find where `tune_values` is assembled from the JSON textarea (around lines 149-150):

```typescript
        tune_values: JSON.parse(String(fd.get('_tune_values_json'))),
```

Replace with logic that walks FormData entries with the `tv.` prefix and reconstructs the nested object:

```typescript
        tune_values: buildTuneValues(fd),
```

Then add the helper at the top of the script block (after `const form = ...; const status = ...;`):

```typescript
    function buildTuneValues(fd: FormData): Record<string, any> {
      const out: Record<string, any> = {};
      for (const [key, value] of fd.entries()) {
        if (!key.startsWith('tv.')) continue;
        const path = key.slice(3).split('.');
        let cur = out;
        for (let i = 0; i < path.length - 1; i++) {
          cur[path[i]] = cur[path[i]] ?? {};
          cur = cur[path[i]];
        }
        cur[path[path.length - 1]] = Number(value);
      }
      return out;
    }
```

- [ ] **Step 6: Modify `src/pages/edit/[slug].astro` — same swap**

In the imports (top of frontmatter), add:

```typescript
import TuneValuesForm from '~/components/TuneValuesForm.astro';
```

Find the existing tune values textarea block (around lines 29-31):

```astro
      <label class="block">
        <span class="label-mono">調校數值 (JSON)</span>
        <textarea name="tune_values" rows="20" class="mt-1.5 w-full bg-bg border border-line text-text font-mono text-[11px] p-2">{JSON.stringify(values, null, 2)}</textarea>
      </label>
```

Replace with:

```astro
      <fieldset class="block">
        <span class="label-mono">調校數值</span>
        <div class="mt-2">
          <TuneValuesForm initial={values} />
        </div>
      </fieldset>
```

In the script block, replace the `tune_values: JSON.parse(fd.get('tune_values'))` line (around line 52) with the same buildTuneValues approach:

```javascript
    function buildTuneValues(fd) {
      const out = {};
      for (const [key, value] of fd.entries()) {
        if (!key.startsWith('tv.')) continue;
        const path = key.slice(3).split('.');
        let cur = out;
        for (let i = 0; i < path.length - 1; i++) {
          cur[path[i]] = cur[path[i]] ?? {};
          cur = cur[path[i]];
        }
        cur[path[path.length - 1]] = Number(value);
      }
      return out;
    }
```

And update the body assembly:

```javascript
      const body = {
        edit_password: fd.get('edit_password'),
        updates: {
          name: fd.get('name'),
          description: fd.get('description'),
          tune_values: buildTuneValues(fd)
        }
      };
```

- [ ] **Step 7: Run tests, confirm pass**

```bash
npx playwright test tests/e2e/upload-perfield.spec.ts
```

Expected: 3 tests PASS.

- [ ] **Step 8: Full regression check**

```bash
npx playwright test tests/e2e/upload-flow.spec.ts
```

The existing upload-flow test asserts `input[name="name"]` and `input[name="share_code"]` and the form `<select name="car_id">` — all still present. Should pass without changes.

- [ ] **Step 9: Commit**

```bash
git add src/data/tune-value-fields.ts src/components/TuneValuesForm.astro src/pages/upload.astro src/pages/edit/\[slug\].astro tests/e2e/upload-perfield.spec.ts
git commit -m "feat: per-field TuneValuesForm replaces JSON paste in upload/edit"
```

---

## After All Tasks: Final Verification

- [ ] **Run the whole suite**

```bash
# Reset KV + reseed demo to clear cross-test pollution
npx wrangler kv key list --binding=KV --local 2>&1 | grep -oE '"rl:[^"]+"' | xargs -I{} npx wrangler kv key delete --binding=KV --local {}
npx wrangler d1 execute fh6-tune-platform-local --local --file=scripts/demo-tunes.sql
# Re-attach Tsukuba ↔ Supra so recommended-tracks + /tracks/{slug} tests pass cleanly
npx wrangler d1 execute fh6-tune-platform-local --local --command="DELETE FROM tune_tracks; INSERT INTO tune_tracks (tune_id, track_id) SELECT id, 5 FROM tunes WHERE slug = 'toyota-supra-mk4-1994-demo04';"

npm run check && npm test && npx playwright test
```

Expected: all pass.

- [ ] **Manual browser walk**

```bash
npm run dev
# Then visit:
#  /my (empty initially → upload a fake one → reappears)
#  /tracks (10 tracks grouped by region)
#  /tracks/tsukuba-circuit (Supra recommends it)
#  /tuner/two_j_zee (the 2JZ Supra tune)
#  /upload (per-field form, all 30 inputs pre-filled with sample values)
#  /edit/toyota-supra-mk4-1994-demo04 (password 'demoseed42', per-field form populated from existing data)
```

- [ ] **Sprint 3 complete**

Site now has the discovery surfaces a real community uses. Sprint 4 (advanced features: share-code normalization, tune-compare, RSS) becomes the next planning target.
