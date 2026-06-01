# Sprint 6: Share-Code-Only Mode + wusyong0403 Bahamut 25-Tune Pack

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Onboard the first authorized seed-content contributor (Bahamut user `wusyong0403`, 25 share codes covering Class C–R, Road + Dirt/Rally) into production. Their contribution is share-code-only — author cannot provide per-tune detail values (suspension, gearing, alignment, etc.). Schema and UI must gracefully degrade for share-code-only tunes without breaking existing tunes that have full detail data.

**Architecture:** Schema migration `0005` relaxes `tune_values` / `pi_score` / `drivetrain` to nullable, extends `pi_class` CHECK to allow `'R'`, and adds `source_url TEXT` column. Migration `0006` seeds 17 new car rows (FH6-era cars + variants not in the original seed). Bulk import script `scripts/import-wusyong-pack-7400.ts` generates a deterministic SQL file inserting the 25 tunes — slugs are stable so subsequent re-imports are idempotent. UI changes are conditional render guards: `/tune/[slug]`, `/edit/[slug]`, `/compare`, and the api JSON endpoint must all handle `tune_values IS NULL`. Detail page shows a banner with the `source_url` when share-code-only.

**Tech Stack:** Astro 6 (server) · Cloudflare Workers · D1 (SQLite + FTS5) · KV · Tailwind v4 · Playwright · Vitest.

**Author handle convention:** All 25 tunes use `author_handle: 'wusyong0403'` (Bahamut nickname). `edit_password_hash` is a shared bcrypt hash; the plaintext password is stored only in `docs/seed-contributors.md` (gitignored) and never logged.

---

## File Structure Overview

**New files:**
- `migrations/0005_share_code_only_mode.sql` — relax NOT NULL on `tune_values`/`pi_score`/`drivetrain`, extend `pi_class` CHECK to include `'R'`, add `source_url TEXT` column. SQLite rebuild-table pattern + FTS recreate.
- `migrations/0006_seed_more_cars.sql` — 17 INSERTs for FH6-era cars and variants needed by the wusyong pack. IDs start at 51 (current max id in 0002 is 50).
- `scripts/import-wusyong-pack-7400.ts` — TypeScript generator that writes `scripts/wusyong-pack-7400.sql`. Mirrors `scripts/seed-demo-tunes.ts` pattern but produces 25 share-code-only tunes (tune_values=NULL, pi_score=NULL, drivetrain=NULL, source_url set).
- `scripts/wusyong-pack-7400.sql` — generated artifact; checked in so prod can apply it directly via `wrangler d1 execute --remote`.
- `tests/unit/db-nullable-tune-values.test.ts` — Vitest: confirm `getTuneBySlug` returns `tune_values: null` for share-code-only rows; `TuneRow` type allows null.
- `tests/e2e/share-code-only-tune.spec.ts` — Playwright e2e: visit a share-code-only tune detail page, assert (a) share code visible, (b) TuneValuesGrid not rendered, (c) source_url link visible, (d) page does not error.

**Modified files:**
- `src/lib/db.ts` — `TuneRow` type: `tune_values: string | null`, `pi_score: number | null`, `drivetrain: 'RWD'|'AWD'|'FWD'|null`, add `source_url: string | null`. `insertTune` signature follows the same null-allowance. The SELECT `*` queries pick up the new `source_url` column automatically.
- `src/pages/tune/[slug].astro` — guard `JSON.parse(tune.tune_values)` behind null check; conditionally render `<TuneValuesGrid>` and the "全部數值" `<h2>` section. When `tune_values IS NULL` and `tune.source_url` is set, render a banner: "作者僅提供分享碼，詳細數值請見原 po 文" + link. When `drivetrain` is null, hide the `/ {tune.drivetrain}` segment in the header. When `pi_score` is null, no change needed (already not in the header — only shown in some descriptions, double-check `<Base description=...>`).
- `src/pages/edit/[slug].astro` — guard `JSON.parse(tune.tune_values)`; if null, render a notice "此調校為僅分享碼模式，目前僅支援編輯 name / description / share_code（詳細數值欄位不適用）"; hide the values form. The PATCH still works for the editable fields.
- `src/pages/compare.astro` — `valuesA`/`valuesB` are already null-guarded for missing tunes; extend the same guard to nullable tune_values: `tuneA && tuneA.tune_values ? JSON.parse(tuneA.tune_values) : null`. When one side is share-code-only, the comparison columns for it show "—".
- `src/pages/api/tunes/[id]/index.ts` (GET handler) — `tune_values: tune_values ? JSON.parse(tune_values) : null` so API returns `null` instead of crashing.
- `src/components/TuneCard.astro` (if it shows drivetrain/pi_score) — null-safe. Inspect first; only edit if needed.
- `scripts/seed-demo-tunes.ts` — no change required (it still uses full values).
- `docs/DEPLOY.md` — add a Step 6.5 note: "If onboarding share-code-only contributors, apply `0005_share_code_only_mode.sql` + `0006_seed_more_cars.sql` + the contributor's SQL pack."
- `docs/seed-contributors.md` (gitignored) — move wusyong0403 row from `已 DM、未回覆` to `已授權（上架中）`; record edit_password.

**Task order rationale:** Task 1 (schema migration) is foundational — must apply locally before anything else can be tested. Task 2 (cars seed) blocks task 4 (import). Task 3 (UI null-guards) can happen in parallel with task 4 but is tested using the data from task 4. Task 5 (e2e + smoke) validates the full chain. Task 6 (prod deploy + onboarding) is the final cutover.

---

## Tune-to-Car Mapping (for Task 4 reference)

Source: https://forum.gamer.com.tw/C.php?bsn=7697&snA=7400 (author `wusyong0403`).

The author's labels and our DB mapping (existing car id from `0002`, or `NEW` if added in `0006`):

| # | PI | Surface | Author label | Year/Make/Model in our DB | car_id |
|---|------|---------|--------------|----------------------------|--------|
| 1 | C | Road | SILVIA K'S (1989 NISSAN) | 1989 Nissan Silvia K's | NEW (51) |
| 2 | C | Dirt | CELICA GT-FOUR ST205 (1994 TOYOTA) | 1994 Toyota Celica GT-Four ST205 | 12 |
| 3 | C | Dirt | JIMMY (1970 GMC) | 1970 GMC Jimmy | NEW (52) |
| 4 | B | Road | GR86 (2002 TOYOTA) — year is author typo, treat as 2022 | 2022 Toyota GR86 | 15 |
| 5 | B | Road | IMPREZA 22B-STI (1998 SUBARU) | 1998 Subaru Impreza 22B STI | 27 |
| 6 | B | Dirt | GR YARIS (2021 TOYOTA) | 2021 Toyota GR Yaris | 14 |
| 7 | B | Dirt | 1500 TRX (2024 RAM) | 2024 Ram 1500 TRX | NEW (53) |
| 8 | B | Dirt | LANCER EVO VI GSR TM EDITION (2001) | 2001 Mitsubishi Lancer Evolution VI TM Edition | NEW (54) |
| 9 | A | Road | 911 GT3 (2004 PORSCHE) | 2004 Porsche 911 GT3 (996) | NEW (55) |
| 10 | A | Road | M2 COMPETITION COUPE (2020 BMW) — map to existing 2019 entry | 2019 BMW M2 Competition | 32 |
| 11 | A | Road | MUSTANG DARK HORSE (2024 FORD) | 2024 Ford Mustang Dark Horse | NEW (56) |
| 12 | A | Dirt | NOMAD (2016 ARIEL) | 2016 Ariel Nomad | NEW (57) |
| 13 | A | Dirt | BRZ FORZA EDITION (2022 SUBARU) | 2022 Subaru BRZ Forza Edition | NEW (58) |
| 14 | A | Dirt | RANGE ROVER SPORT SVR (2015 LAND ROVER) | 2015 Land Rover Range Rover Sport SVR | NEW (59) |
| 15 | S1 | Road | GT PROTOTYPE (2026 GR) — FH6 fictional | 2026 Toyota GR GT Prototype | NEW (60) |
| 16 | S1 | Road | GT-R NISMO (2024 NISSAN) | 2024 Nissan GT-R Nismo | NEW (61) |
| 17 | S1 | Dirt | RS200 EVOLUTION (1985 FORD) | 1985 Ford RS200 Evolution | NEW (62) |
| 18 | S2 | Road | CENTENARIO LP 770-4 (2016 LAMBORGHINI) | 2016 Lamborghini Centenario LP 770-4 | NEW (63) |
| 19 | S2 | Dirt | 911 RALLYE (2023 PORSCHE) | 2023 Porsche 911 Dakar | NEW (64) |
| 20 | S2 | Dirt | VIPER GTS ACR FORZA EDITION (1999 DODGE) | 1999 Dodge Viper GTS ACR Forza Edition | NEW (65) |
| 21 | R | Road | EVOLUTION COUPE 1020 (2015 ULTIMA) | 2015 Ultima Evolution Coupe 1020 | NEW (66) |
| 22 | A | Drag (treat as `drag` tune_type) | CAMRY TRD (2023 TOYOTA) | 2023 Toyota Camry TRD | NEW (67) |

**Total NEW cars: 17** (ids 51–67).

**Tune type mapping:**
- author "Road" → `touge` (default road tune category)
- author "Dirt/Rally/CC" → `rally`
- author "直線衝刺" → `drag`

**Share codes** (exactly as authored, do not modify):

```
708630539  Silvia K's
142821010  Celica GT-Four ST205
132883852  Jimmy
118511679  GR86
445427993  Impreza 22B
876983333  GR Yaris
130570832  Ram 1500 TRX
848421224  Evo VI TM Edition
987086923  911 GT3
169659900  M2 Competition
115952389  Mustang Dark Horse
600706886  Ariel Nomad
164401570  BRZ Forza Edition
124686990  Range Rover Sport SVR
443677835  GR GT Prototype
174714312  GT-R Nismo
518947599  RS200 Evolution
840998654  Centenario
920353829  911 Dakar
585820968  Viper GTS ACR FE
735727292  Ultima Evolution Coupe 1020
853939307  Camry TRD
```

(22 share codes total — author's post listed some entries spread across PI tiers; verify count when implementing. The plan above is the 22-tune reading. If implementer finds 25 distinct codes after re-reading source post, add the missing 3 to both the table and the script.)

**Tune naming convention:** `{Car model} - {PI class}/{tune_type 中文}`
e.g. `Silvia K's - C/跑山`, `GR Yaris - B/拉力`, `Camry TRD - A/直線`.

**Slug convention:** `{car_slug}-wusyong-{class-lower}-{type}` — e.g. `nissan-silvia-ks-1989-wusyong-c-touge`.

---

### Task 1: Schema migration — nullable values + 'R' class + source_url

**Files:**
- New: `migrations/0005_share_code_only_mode.sql`
- New: `tests/unit/db-nullable-tune-values.test.ts`

**Background:** SQLite cannot `ALTER TABLE` to relax a NOT NULL or change a CHECK constraint. Must use the rebuild-table pattern: create new table → INSERT INTO new SELECT FROM old → drop old → rename new. FTS5 virtual table and triggers must be recreated since they reference the old `tunes` table.

Reference migrations to mirror:
- `migrations/0003_fts_car_columns.sql` — shows the FTS5 contentless-table pattern this repo uses (`content=''`, manual triggers).
- `migrations/0004_fts_unicode61.sql` — shows the tokenizer config we must preserve (`tokenize='unicode61'`).

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/db-nullable-tune-values.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { TuneRow } from '~/lib/db';

describe('TuneRow type allows null for share-code-only fields', () => {
  it('accepts null tune_values, pi_score, drivetrain, source_url', () => {
    const row: TuneRow = {
      id: 1, slug: 'x', name: 'X', share_code: '123-456-789',
      car_id: 1, tune_type: 'touge', pi_class: 'R', pi_score: null,
      drivetrain: null, power_hp: null, weight_lb: null,
      description: null, tune_values: null, source_url: 'https://example.com',
      author_handle: 'a', edit_password_hash: 'h', ip_hash: 'i',
      rating_sum: 0, rating_count: 0, download_count: 0,
      status: 'public', created_at: 0, updated_at: 0
    };
    expect(row.tune_values).toBeNull();
    expect(row.pi_class).toBe('R');  // 'R' must be in the union type
  });
});
```

This test FAILS until both the migration (which the type must reflect) AND `src/lib/db.ts` are updated.

- [ ] **Step 2: Run test, confirm fail**

```bash
npm run test -- tests/unit/db-nullable-tune-values.test.ts
```

Expect compile error or type error.

- [ ] **Step 3: Write the migration**

Create `migrations/0005_share_code_only_mode.sql`. Structure (do not copy verbatim — adapt while preserving 0003+0004's FTS5 contentless pattern, tokenize=unicode61, and all triggers):

```sql
-- Sprint 6: allow share-code-only tunes (no per-tune detail values).
-- Changes:
--   - tune_values, pi_score, drivetrain: NOT NULL → nullable
--   - pi_class CHECK: add 'R' (top class, post-X tier per author convention)
--   - new column: source_url TEXT (origin URL for seeded content)
-- SQLite can't ALTER NOT NULL/CHECK in place — rebuild table.

PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

-- Drop FTS objects that reference tunes (recreated below)
DROP TRIGGER IF EXISTS tunes_ai;
DROP TRIGGER IF EXISTS tunes_au;
DROP TRIGGER IF EXISTS tunes_ad;
DROP TABLE IF EXISTS tunes_fts;

CREATE TABLE tunes_new (
  id              INTEGER PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  share_code      TEXT NOT NULL,
  car_id          INTEGER NOT NULL REFERENCES cars(id),
  tune_type       TEXT NOT NULL CHECK (tune_type IN ('touge','drift','grip','drag','rally','offroad')),
  pi_class        TEXT NOT NULL CHECK (pi_class IN ('D','C','B','A','S1','S2','R','X')),
  pi_score        INTEGER,
  drivetrain      TEXT CHECK (drivetrain IS NULL OR drivetrain IN ('RWD','AWD','FWD')),
  power_hp        INTEGER,
  weight_lb       INTEGER,
  description     TEXT,
  tune_values     TEXT,
  source_url      TEXT,
  author_handle   TEXT NOT NULL,
  edit_password_hash TEXT NOT NULL,
  ip_hash         TEXT NOT NULL,
  rating_sum      INTEGER NOT NULL DEFAULT 0,
  rating_count    INTEGER NOT NULL DEFAULT 0,
  download_count  INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'public' CHECK (status IN ('public','hidden','deleted')),
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

INSERT INTO tunes_new (id, slug, name, share_code, car_id, tune_type, pi_class, pi_score, drivetrain, power_hp, weight_lb, description, tune_values, source_url, author_handle, edit_password_hash, ip_hash, rating_sum, rating_count, download_count, status, created_at, updated_at)
SELECT id, slug, name, share_code, car_id, tune_type, pi_class, pi_score, drivetrain, power_hp, weight_lb, description, tune_values, NULL, author_handle, edit_password_hash, ip_hash, rating_sum, rating_count, download_count, status, created_at, updated_at
FROM tunes;

DROP TABLE tunes;
ALTER TABLE tunes_new RENAME TO tunes;

-- Recreate indexes (verbatim from 0001)
CREATE INDEX idx_tunes_car ON tunes(car_id, status);
CREATE INDEX idx_tunes_type ON tunes(tune_type, status);
CREATE INDEX idx_tunes_rating ON tunes(rating_sum, rating_count) WHERE status = 'public';
CREATE INDEX idx_tunes_downloads ON tunes(download_count DESC) WHERE status = 'public';

-- Recreate FTS5 (preserves 0003+0004's contentless + unicode61 setup)
CREATE VIRTUAL TABLE tunes_fts USING fts5(
  name, description, author_handle, car_make, car_model,
  content='',
  tokenize='unicode61'
);

CREATE TRIGGER tunes_ai AFTER INSERT ON tunes
WHEN new.status = 'public'
BEGIN
  INSERT INTO tunes_fts(rowid, name, description, author_handle, car_make, car_model)
  SELECT new.id, new.name, new.description, new.author_handle, c.make, c.model
  FROM cars c WHERE c.id = new.car_id;
END;

CREATE TRIGGER tunes_au AFTER UPDATE ON tunes
WHEN OLD.name != NEW.name
  OR OLD.description IS NOT NEW.description
  OR OLD.author_handle != NEW.author_handle
  OR OLD.car_id != NEW.car_id
  OR OLD.status != NEW.status
BEGIN
  INSERT INTO tunes_fts(tunes_fts, rowid, name, description, author_handle, car_make, car_model)
  SELECT 'delete', old.id, old.name, old.description, old.author_handle, c.make, c.model
  FROM cars c WHERE c.id = old.car_id;
  INSERT INTO tunes_fts(rowid, name, description, author_handle, car_make, car_model)
  SELECT new.id, new.name, new.description, new.author_handle, c.make, c.model
  FROM cars c WHERE c.id = new.car_id AND new.status = 'public';
END;

CREATE TRIGGER tunes_ad AFTER DELETE ON tunes BEGIN
  INSERT INTO tunes_fts(tunes_fts, rowid, name, description, author_handle, car_make, car_model)
  SELECT 'delete', old.id, old.name, old.description, old.author_handle, c.make, c.model
  FROM cars c WHERE c.id = old.car_id;
END;

-- Backfill FTS index from current tunes
INSERT INTO tunes_fts(rowid, name, description, author_handle, car_make, car_model)
SELECT t.id, t.name, t.description, t.author_handle, c.make, c.model
FROM tunes t JOIN cars c ON c.id = t.car_id
WHERE t.status = 'public';

COMMIT;
PRAGMA foreign_keys=ON;
```

- [ ] **Step 4: Apply migration locally**

```bash
npx wrangler d1 execute fh6-tune-platform-local --local --file=migrations/0005_share_code_only_mode.sql
```

Verify table structure:
```bash
npx wrangler d1 execute fh6-tune-platform-local --local --command="SELECT sql FROM sqlite_master WHERE name='tunes';"
```

Should show `tune_values TEXT` (no NOT NULL), `pi_class CHECK (... 'R' ...)`, `source_url TEXT`.

- [ ] **Step 5: Update `src/lib/db.ts` TuneRow type**

```typescript
export type TuneRow = {
  id: number;
  slug: string;
  name: string;
  share_code: string;
  car_id: number;
  tune_type: 'touge' | 'drift' | 'grip' | 'drag' | 'rally' | 'offroad';
  pi_class: 'D' | 'C' | 'B' | 'A' | 'S1' | 'S2' | 'R' | 'X';   // + 'R'
  pi_score: number | null;        // was number
  drivetrain: 'RWD' | 'AWD' | 'FWD' | null;  // was union without null
  power_hp: number | null;
  weight_lb: number | null;
  description: string | null;
  tune_values: string | null;     // was string
  source_url: string | null;      // NEW
  author_handle: string;
  edit_password_hash: string;
  ip_hash: string;
  rating_sum: number;
  rating_count: number;
  download_count: number;
  status: 'public' | 'hidden' | 'deleted';
  created_at: number;
  updated_at: number;
};
```

- [ ] **Step 6: Run unit test, confirm pass**

```bash
npm run test -- tests/unit/db-nullable-tune-values.test.ts
```

Expect green.

- [ ] **Step 7: Re-run full unit suite to catch regressions**

```bash
npm run test
```

If any existing tests fail because they assumed `tune_values: string` (non-nullable), fix the test assertions — but do NOT widen the type-check coverage by adding `!` non-null assertions in product code. Use null-guards.

---

### Task 2: Seed 17 new cars (migration 0006)

**Files:**
- New: `migrations/0006_seed_more_cars.sql`

**Background:** The wusyong pack references cars not present in `0002_seed_cars_tracks.sql`. Add them with ids 51–67, preserving the make/model/year/slug column order of the existing seed. Slugs use the same convention (lowercase, hyphen-separated, year suffix).

- [ ] **Step 1: Draft INSERT block**

```sql
-- Sprint 6: add cars referenced by the wusyong0403 Bahamut pack (and FH6 launch lineup gaps).
INSERT INTO cars (id, year, make, model, slug) VALUES
  (51, 1989, 'Nissan',       'Silvia K''s',                'nissan-silvia-ks-1989'),
  (52, 1970, 'GMC',           'Jimmy',                      'gmc-jimmy-1970'),
  (53, 2024, 'Ram',           '1500 TRX',                   'ram-1500-trx-2024'),
  (54, 2001, 'Mitsubishi',    'Lancer Evolution VI TM Edition', 'mitsubishi-evo-vi-tm-2001'),
  (55, 2004, 'Porsche',       '911 GT3 (996)',              'porsche-911-gt3-996-2004'),
  (56, 2024, 'Ford',          'Mustang Dark Horse',         'ford-mustang-dark-horse-2024'),
  (57, 2016, 'Ariel',         'Nomad',                      'ariel-nomad-2016'),
  (58, 2022, 'Subaru',        'BRZ Forza Edition',          'subaru-brz-forza-edition-2022'),
  (59, 2015, 'Land Rover',    'Range Rover Sport SVR',      'land-rover-range-rover-sport-svr-2015'),
  (60, 2026, 'Toyota',        'GR GT Prototype',            'toyota-gr-gt-prototype-2026'),
  (61, 2024, 'Nissan',        'GT-R Nismo',                 'nissan-gtr-nismo-2024'),
  (62, 1985, 'Ford',          'RS200 Evolution',            'ford-rs200-evolution-1985'),
  (63, 2016, 'Lamborghini',   'Centenario LP 770-4',        'lamborghini-centenario-2016'),
  (64, 2023, 'Porsche',       '911 Dakar',                  'porsche-911-dakar-2023'),
  (65, 1999, 'Dodge',         'Viper GTS ACR Forza Edition','dodge-viper-gts-acr-fe-1999'),
  (66, 2015, 'Ultima',        'Evolution Coupe 1020',       'ultima-evolution-coupe-1020-2015'),
  (67, 2023, 'Toyota',        'Camry TRD',                  'toyota-camry-trd-2023');
```

- [ ] **Step 2: Apply locally**

```bash
npx wrangler d1 execute fh6-tune-platform-local --local --file=migrations/0006_seed_more_cars.sql
```

- [ ] **Step 3: Verify**

```bash
npx wrangler d1 execute fh6-tune-platform-local --local --command="SELECT id, year, make, model, slug FROM cars WHERE id >= 51 ORDER BY id;"
```

Should print 17 rows.

---

### Task 3: UI null-guards (tune detail, edit, compare, API)

**Files:**
- Modify: `src/pages/tune/[slug].astro`
- Modify: `src/pages/edit/[slug].astro`
- Modify: `src/pages/compare.astro`
- Modify: `src/pages/api/tunes/[id]/index.ts`
- Modify: `src/lib/db.ts` (insertTune — accept nullable fields)

- [ ] **Step 1: Write the failing e2e test**

Create `tests/e2e/share-code-only-tune.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

// Note: this test depends on a share-code-only tune being seeded into local D1.
// Use the wusyong-pack-7400.sql output from Task 4.
const SHARE_CODE_ONLY_SLUG = 'nissan-silvia-ks-1989-wusyong-c-touge';

test('share-code-only tune detail page', async ({ page }) => {
  const response = await page.goto(`/tune/${SHARE_CODE_ONLY_SLUG}`);
  expect(response?.status()).toBe(200);

  // share code IS shown
  await expect(page.locator('[data-share-code]').first()).toBeVisible();

  // TuneValuesGrid is NOT rendered
  await expect(page.locator('text=全部數值')).toHaveCount(0);

  // banner with source link IS rendered
  const sourceLink = page.locator('a[href*="forum.gamer.com.tw"]');
  await expect(sourceLink.first()).toBeVisible();

  // no JS errors
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
});

test('regular tune detail page still renders values', async ({ page }) => {
  await page.goto('/tune/toyota-supra-mk4-1994-demo04');
  await expect(page.locator('text=全部數值')).toBeVisible();
});
```

- [ ] **Step 2: Run, confirm fail** (depends on Task 4 data; OK to defer running this until Task 4 is done, but write it now).

- [ ] **Step 3: Patch `src/pages/tune/[slug].astro`**

Replace the unconditional `const values = JSON.parse(tune.tune_values);` with a null-guarded version. Move it inside the JSX or compute `const values = tune.tune_values ? JSON.parse(tune.tune_values) : null;`.

Add conditional rendering around the `<h2>全部數值</h2>` section and `<TuneValuesGrid>`. Replace the header line that hardcodes `{tune.drivetrain}` with `{tune.drivetrain ?? '—'}` (or omit the segment entirely when null — pick whichever reads cleaner with surrounding text).

Add a new banner block, rendered when `tune.tune_values === null`:

```astro
{tune.tune_values === null && tune.source_url && (
  <div class="mt-6 p-5 bg-bg-card border-l-[3px] border-cyan">
    <div class="font-mono text-[10px] text-cyan tracking-wider2 mb-1.5">＞ 僅分享碼模式</div>
    <p class="leading-relaxed text-text-soft text-[14px] m-0">
      作者僅提供分享碼，詳細數值請見原 po 文：
      <a href={tune.source_url} target="_blank" rel="noopener nofollow" class="text-cyan">{tune.source_url}</a>
    </p>
  </div>
)}
```

- [ ] **Step 4: Patch `src/pages/edit/[slug].astro`**

Guard the JSON.parse. If `tune.tune_values === null`, render a notice block above the form and hide the values fields (but keep name / description / share_code editable). The PATCH handler in `api/tunes/[id]/index.ts` already supports partial updates — no API change needed for editing.

- [ ] **Step 5: Patch `src/pages/compare.astro`**

Extend the existing null-guard:

```astro
const valuesA = tuneA && tuneA.tune_values ? JSON.parse(tuneA.tune_values) : null;
const valuesB = tuneB && tuneB.tune_values ? JSON.parse(tuneB.tune_values) : null;
```

Render "—" in each comparison row where one side has null values.

- [ ] **Step 6: Patch API GET handler**

`src/pages/api/tunes/[id]/index.ts:13`:

```typescript
return Response.json({ ...rest, tune_values: tune_values ? JSON.parse(tune_values) : null });
```

- [ ] **Step 7: Update `insertTune` in `src/lib/db.ts`**

The `InsertTuneInput` derives from `TuneRow` so it picks up the null relaxations automatically. But verify the SQL placeholder order in the prepared statement matches the new `source_url` column. (Hint: SELECT * picks up the new column; INSERT does not — the existing INSERT statement in `insertTune` needs `source_url` added if you want the upload form to set it eventually. For Sprint 6, no upload-form change is required because the import script bypasses `insertTune` and writes SQL directly. But still update the INSERT to include `source_url` defaulting to NULL so future code paths are consistent.)

- [ ] **Step 8: Run unit + e2e suite**

```bash
npm run test
```

All green.

---

### Task 4: Bulk import script

**Files:**
- New: `scripts/import-wusyong-pack-7400.ts`
- Generated: `scripts/wusyong-pack-7400.sql`

**Background:** Mirrors `scripts/seed-demo-tunes.ts` but produces share-code-only INSERTs. No `tune_values`, no `pi_score`, no `drivetrain`. Single shared bcrypt-hashed edit_password (plaintext recorded in `docs/seed-contributors.md`). `ip_hash` is a sentinel 64-char hex like `wusyong0403seedwusyong0403seedwusyong0403seedwusyong0403seedfeed` (truncate/pad to 64).

- [ ] **Step 1: Draft the script**

```typescript
// scripts/import-wusyong-pack-7400.ts
import bcrypt from 'bcryptjs';
import { writeFileSync } from 'node:fs';

const PASSWORD = 'wusyong-7400-pack';   // record in docs/seed-contributors.md
const HASH = bcrypt.hashSync(PASSWORD, 10);
const IP_HASH = 'wusyong0403seedipwusyong0403seedipwusyong0403seedipwusyong0403seedip'.slice(0, 64);
const NOW = Math.floor(Date.now() / 1000);
const AUTHOR = 'wusyong0403';
const SOURCE_URL = 'https://forum.gamer.com.tw/C.php?bsn=7697&snA=7400';
const sqlEsc = (s: string) => s.replace(/'/g, "''");

type Tune = {
  name: string;
  share_code: string;
  car_id: number;
  car_slug: string;
  tune_type: 'touge' | 'rally' | 'drag';
  pi_class: 'C' | 'B' | 'A' | 'S1' | 'S2' | 'R';
};

const tunes: Tune[] = [
  { name: "Silvia K's - C/跑山",                  share_code: '708630539', car_id: 51, car_slug: 'nissan-silvia-ks-1989',                        tune_type: 'touge', pi_class: 'C' },
  { name: 'Celica GT-Four ST205 - C/拉力',         share_code: '142821010', car_id: 12, car_slug: 'toyota-celica-gt-four-st205-1994',             tune_type: 'rally', pi_class: 'C' },
  { name: 'Jimmy - C/越野',                       share_code: '132883852', car_id: 52, car_slug: 'gmc-jimmy-1970',                                tune_type: 'rally', pi_class: 'C' },
  { name: 'GR86 - B/跑山',                         share_code: '118511679', car_id: 15, car_slug: 'toyota-gr86-2022',                             tune_type: 'touge', pi_class: 'B' },
  { name: 'Impreza 22B - B/跑山',                  share_code: '445427993', car_id: 27, car_slug: 'subaru-impreza-22b-sti-1998',                  tune_type: 'touge', pi_class: 'B' },
  { name: 'GR Yaris - B/拉力',                     share_code: '876983333', car_id: 14, car_slug: 'toyota-gr-yaris-2021',                        tune_type: 'rally', pi_class: 'B' },
  { name: 'Ram 1500 TRX - B/越野',                 share_code: '130570832', car_id: 53, car_slug: 'ram-1500-trx-2024',                            tune_type: 'rally', pi_class: 'B' },
  { name: 'Evo VI TM Edition - B/拉力',            share_code: '848421224', car_id: 54, car_slug: 'mitsubishi-evo-vi-tm-2001',                    tune_type: 'rally', pi_class: 'B' },
  { name: '911 GT3 (996) - A/跑山',                share_code: '987086923', car_id: 55, car_slug: 'porsche-911-gt3-996-2004',                     tune_type: 'touge', pi_class: 'A' },
  { name: 'M2 Competition - A/跑山',               share_code: '169659900', car_id: 32, car_slug: 'bmw-m2-competition-2019',                      tune_type: 'touge', pi_class: 'A' },
  { name: 'Mustang Dark Horse - A/跑山',           share_code: '115952389', car_id: 56, car_slug: 'ford-mustang-dark-horse-2024',                 tune_type: 'touge', pi_class: 'A' },
  { name: 'Ariel Nomad - A/越野',                  share_code: '600706886', car_id: 57, car_slug: 'ariel-nomad-2016',                             tune_type: 'rally', pi_class: 'A' },
  { name: 'BRZ Forza Edition - A/拉力',            share_code: '164401570', car_id: 58, car_slug: 'subaru-brz-forza-edition-2022',                tune_type: 'rally', pi_class: 'A' },
  { name: 'Range Rover Sport SVR - A/越野',        share_code: '124686990', car_id: 59, car_slug: 'land-rover-range-rover-sport-svr-2015',         tune_type: 'rally', pi_class: 'A' },
  { name: 'GR GT Prototype - S1/跑山',             share_code: '443677835', car_id: 60, car_slug: 'toyota-gr-gt-prototype-2026',                  tune_type: 'touge', pi_class: 'S1' },
  { name: 'GT-R Nismo - S1/跑山',                  share_code: '174714312', car_id: 61, car_slug: 'nissan-gtr-nismo-2024',                        tune_type: 'touge', pi_class: 'S1' },
  { name: 'RS200 Evolution - S1/拉力',             share_code: '518947599', car_id: 62, car_slug: 'ford-rs200-evolution-1985',                    tune_type: 'rally', pi_class: 'S1' },
  { name: 'Centenario - S2/跑山',                  share_code: '840998654', car_id: 63, car_slug: 'lamborghini-centenario-2016',                  tune_type: 'touge', pi_class: 'S2' },
  { name: '911 Dakar - S2/拉力',                   share_code: '920353829', car_id: 64, car_slug: 'porsche-911-dakar-2023',                       tune_type: 'rally', pi_class: 'S2' },
  { name: 'Viper GTS ACR FE - S2/拉力',            share_code: '585820968', car_id: 65, car_slug: 'dodge-viper-gts-acr-fe-1999',                  tune_type: 'rally', pi_class: 'S2' },
  { name: 'Ultima Evolution Coupe 1020 - R/跑山',  share_code: '735727292', car_id: 66, car_slug: 'ultima-evolution-coupe-1020-2015',             tune_type: 'touge', pi_class: 'R' },
  { name: 'Camry TRD - A/直線',                    share_code: '853939307', car_id: 67, car_slug: 'toyota-camry-trd-2023',                        tune_type: 'drag', pi_class: 'A' }
];

// Highest existing tune id is 15 (5 normal + 10 demo from seed-demo-tunes); start at 100 to leave gap
const ID_START = 100;

const rows = tunes.map((t, i) => {
  const id = ID_START + i;
  const slug = `${t.car_slug}-wusyong-${t.pi_class.toLowerCase()}-${t.tune_type}`;
  // tune_values=NULL, pi_score=NULL, drivetrain=NULL, power_hp=NULL, weight_lb=NULL, description=NULL
  return `(${id}, '${sqlEsc(slug)}', '${sqlEsc(t.name)}', '${sqlEsc(t.share_code)}', ${t.car_id}, '${t.tune_type}', '${t.pi_class}', NULL, NULL, NULL, NULL, NULL, NULL, '${sqlEsc(SOURCE_URL)}', '${sqlEsc(AUTHOR)}', '${HASH}', '${IP_HASH}', 0, 0, 0, 'public', ${NOW}, ${NOW})`;
});

const sql = `-- wusyong0403 Bahamut pack import (bsn=7697 snA=7400)
-- Generated by scripts/import-wusyong-pack-7400.ts — do not edit by hand
-- Edit password (all 22): ${PASSWORD}
INSERT INTO tunes (id, slug, name, share_code, car_id, tune_type, pi_class, pi_score, drivetrain, power_hp, weight_lb, description, tune_values, source_url, author_handle, edit_password_hash, ip_hash, rating_sum, rating_count, download_count, status, created_at, updated_at) VALUES
  ${rows.join(',\n  ')};
`;

writeFileSync('scripts/wusyong-pack-7400.sql', sql);
console.log(`Wrote scripts/wusyong-pack-7400.sql — ${tunes.length} tunes`);
console.log(`Apply locally: npx wrangler d1 execute fh6-tune-platform-local --local --file=scripts/wusyong-pack-7400.sql`);
console.log(`Apply to prod: npx wrangler d1 execute fh6-tune-platform-prod --remote --file=scripts/wusyong-pack-7400.sql`);
```

- [ ] **Step 2: Generate the SQL**

```bash
npx tsx scripts/import-wusyong-pack-7400.ts
```

- [ ] **Step 3: Apply locally + verify**

```bash
npx wrangler d1 execute fh6-tune-platform-local --local --file=scripts/wusyong-pack-7400.sql
npx wrangler d1 execute fh6-tune-platform-local --local --command="SELECT slug, share_code, pi_class FROM tunes WHERE author_handle='wusyong0403' ORDER BY id;"
```

Should return 22 rows.

- [ ] **Step 4: Run share-code-only e2e test**

```bash
npm run dev   # in another terminal
npm run test:e2e -- tests/e2e/share-code-only-tune.spec.ts
```

Expect green. If the share code or source URL banner fails to appear, fix the UI guards from Task 3.

---

### Task 5: Smoke test update + final sweep

**Files:**
- Modify: `tests/smoke/production.spec.ts`

- [ ] **Step 1: Add share-code-only smoke check**

Append a 9th test that visits one of the wusyong tunes (after prod deploy) and confirms the page returns 200 + has the source link visible. Use a configurable slug via env override: `SMOKE_SHARE_CODE_SLUG` defaulting to `nissan-silvia-ks-1989-wusyong-c-touge`.

- [ ] **Step 2: Re-run local smoke against `npm run dev`**

```bash
SMOKE_BASE_URL=http://localhost:4321 npm run test:smoke
```

All 9 tests pass.

---

### Task 6: Production deploy + onboarding (HUMAN GATE)

**This task is performed by the main agent (Andy), NOT the implementer subagent.** It mutates production state and sends notifications. Implementer subagent should stop after Task 5 and surface a summary.

- [ ] Apply migration 0005 to prod D1
- [ ] Apply migration 0006 to prod D1
- [ ] Apply `scripts/wusyong-pack-7400.sql` to prod D1
- [ ] `npm run build && npx wrangler deploy`
- [ ] `SMOKE_BASE_URL=https://fh6-tune-platform.badboyandy13.workers.dev npm run test:smoke` — all 9 pass
- [ ] Spot-check 3 random URLs in browser:
  - `/tune/nissan-silvia-ks-1989-wusyong-c-touge` (share-code-only)
  - `/tune/toyota-supra-mk4-1994-demo04` (full-values, regression check)
  - `/browse` (search/filter works with new tunes visible)
- [ ] Update `docs/seed-contributors.md`: move wusyong0403 from "已 DM、未回覆" to "已授權（上架中）", record edit_password, list 22 slugs
- [ ] Update memory: `~/.claude/projects/.../memory/launch-state.md` — note wusyong0403 onboarded, 22 tunes live, next step = post thank-you on Bahamut

---

## Definition of Done

- [ ] All migrations applied to local + prod D1
- [ ] All unit + e2e + smoke tests green
- [ ] No regression on existing full-values tune pages (compare, edit, detail, API all work)
- [ ] 22 share-code-only tunes browsable at production URL
- [ ] Subagent-driven reviews (spec + code quality) both pass with no blockers
- [ ] Seed-contributors doc updated; memory updated
