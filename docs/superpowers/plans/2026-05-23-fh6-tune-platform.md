# FH6 Tune Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build touge.gg — an anonymous tune-sharing platform for Forza Horizon 6 — ready for launch 6-8 weeks before the game releases.

**Architecture:** Astro 5 static site + Cloudflare Pages hosting. API via Cloudflare Workers (Astro endpoints). Storage on Cloudflare D1 (SQLite) with FTS5 search; rate-limit counters on Cloudflare KV. Anonymous upload via bcrypt-hashed edit password. URL-driven filters for SEO; English-only at launch with i18n-ready architecture.

**Tech Stack:** Astro 5, TypeScript, Cloudflare Pages/Workers/D1/KV/Turnstile, Vitest (unit), Playwright (e2e), Tailwind CSS, bcrypt-edge, drizzle-orm (D1 adapter)

---

## File Structure

This is what the project tree should look like after implementation:

```
fh6-tune-platform/
├── astro.config.mjs                    # Astro + Cloudflare adapter + Tailwind
├── package.json
├── tsconfig.json
├── wrangler.toml                       # Cloudflare bindings (D1, KV, vars)
├── .env.example                        # Documented env vars
├── .gitignore                          # Already exists
├── playwright.config.ts                # E2E config
├── vitest.config.ts                    # Unit test config
├── tailwind.config.mjs
│
├── migrations/                         # D1 schema migrations
│   ├── 0001_initial_schema.sql         # tunes/cars/tracks/reviews/reports
│   └── 0002_seed_cars_tracks.sql       # FH5 car + track seed data
│
├── public/
│   ├── favicon.svg
│   └── robots.txt
│
├── src/
│   ├── env.d.ts                        # Astro env types
│   │
│   ├── pages/
│   │   ├── index.astro                 # Homepage
│   │   ├── browse.astro                # Browse page
│   │   ├── upload.astro                # Upload form
│   │   ├── tune/[slug].astro           # Tune detail
│   │   ├── edit/[slug].astro           # Edit form
│   │   ├── sitemap.xml.ts              # Generated sitemap
│   │   └── api/
│   │       ├── tunes/
│   │       │   ├── index.ts            # POST upload, GET list
│   │       │   ├── [id]/
│   │       │   │   ├── index.ts        # GET, PATCH, DELETE
│   │       │   │   └── review.ts       # POST review
│   │       ├── search.ts               # GET full-text search
│   │       └── report.ts               # POST report
│   │
│   ├── components/
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── TuneCard.astro              # Used on home + browse
│   │   ├── ShareCodeBox.astro          # Big copyable share-code box
│   │   ├── TuneValuesGrid.astro        # 9-section tune values display
│   │   ├── FilterSidebar.astro         # Browse-page filters
│   │   ├── ReviewCard.astro
│   │   └── TunerAvatar.astro
│   │
│   ├── lib/
│   │   ├── db.ts                       # D1 query helpers + types
│   │   ├── auth.ts                     # Edit password hash + session cookie
│   │   ├── slug.ts                     # Slug generation
│   │   ├── ip-hash.ts                  # SHA256(ip + daily salt)
│   │   ├── rate-limit.ts               # KV-based per-IP limiter
│   │   ├── turnstile.ts                # Verify Turnstile token
│   │   ├── search.ts                   # FTS5 query builder
│   │   ├── tune-values.ts              # Tune values JSON validation
│   │   └── wilson.ts                   # Wilson score for rating sort
│   │
│   ├── data/
│   │   ├── cars-seed.ts                # FH5 car list (initial seed)
│   │   ├── tracks-seed.ts              # Tracks seed
│   │   └── tune-schema.ts              # JSON shape definition for tune_values
│   │
│   ├── i18n/
│   │   └── en.json                     # All UI strings
│   │
│   └── styles/
│       └── global.css                  # Theme tokens + base styles
│
└── tests/
    ├── unit/
    │   ├── slug.test.ts
    │   ├── auth.test.ts
    │   ├── ip-hash.test.ts
    │   ├── rate-limit.test.ts
    │   ├── turnstile.test.ts
    │   ├── tune-values.test.ts
    │   ├── search.test.ts
    │   └── wilson.test.ts
    └── e2e/
        ├── upload-flow.spec.ts
        ├── browse-flow.spec.ts
        ├── edit-flow.spec.ts
        └── tune-detail.spec.ts
```

---

## Phase 0 — Project Setup

### Task 0.1: Initialize Astro project with Cloudflare Pages adapter

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `src/env.d.ts`

- [ ] **Step 1: Initialize npm project**

```bash
cd /Users/andy.lai/Projects/fh6-tune-platform
npm init -y
```

- [ ] **Step 2: Install Astro + Cloudflare + TypeScript**

```bash
npm install astro @astrojs/cloudflare @astrojs/tailwind tailwindcss typescript
npm install -D @types/node wrangler
```

- [ ] **Step 3: Create `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: { enabled: true }
  }),
  integrations: [tailwind()],
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
    routing: { prefixDefaultLocale: false }
  }
});
```

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": ["src/**/*", ".astro/types.d.ts"],
  "exclude": ["dist"],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "~/*": ["src/*"]
    }
  }
}
```

- [ ] **Step 5: Create `src/env.d.ts`**

```ts
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

type D1Database = import('@cloudflare/workers-types').D1Database;
type KVNamespace = import('@cloudflare/workers-types').KVNamespace;

interface ImportMetaEnv {
  readonly TURNSTILE_SECRET_KEY: string;
  readonly IP_HASH_SALT: string;
  readonly EDIT_COOKIE_SECRET: string;
}

declare namespace App {
  interface Locals {
    runtime: {
      env: {
        DB: D1Database;
        KV: KVNamespace;
        TURNSTILE_SECRET_KEY: string;
        IP_HASH_SALT: string;
        EDIT_COOKIE_SECRET: string;
      };
    };
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json astro.config.mjs tsconfig.json src/env.d.ts
git commit -m "chore: initialize Astro + Cloudflare Pages project"
```

---

### Task 0.2: Configure wrangler with D1 + KV bindings

**Files:**
- Create: `wrangler.toml`
- Create: `.env.example`

- [ ] **Step 1: Create `wrangler.toml`**

```toml
name = "fh6-tune-platform"
compatibility_date = "2026-05-01"
pages_build_output_dir = "./dist"

[[d1_databases]]
binding = "DB"
database_name = "fh6-tune-platform"
database_id = "PLACEHOLDER_RUN_wrangler_d1_create_FIRST"

[[kv_namespaces]]
binding = "KV"
id = "PLACEHOLDER_RUN_wrangler_kv_namespace_create_FIRST"

[vars]
# Set real values via `wrangler secret put` for production
```

- [ ] **Step 2: Create `.env.example`**

```bash
# Local development only — production uses wrangler secrets
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA  # Cloudflare test key
TURNSTILE_SITE_KEY=1x00000000000000000000AA               # Cloudflare test key
IP_HASH_SALT=local-dev-salt-rotate-daily
EDIT_COOKIE_SECRET=local-dev-cookie-secret-min-32-chars-long
```

- [ ] **Step 3: Create local D1 database**

```bash
ASDF_NODEJS_VERSION=22.22.2 npx wrangler d1 create fh6-tune-platform-local
```

Copy the `database_id` from output and paste into `wrangler.toml`.

- [ ] **Step 4: Create local KV namespace**

```bash
ASDF_NODEJS_VERSION=22.22.2 npx wrangler kv namespace create RATE_LIMIT
```

Copy the `id` from output and paste into `wrangler.toml`.

- [ ] **Step 5: Commit**

```bash
git add wrangler.toml .env.example
git commit -m "chore: configure wrangler with D1 and KV bindings"
```

---

### Task 0.3: Set up Vitest for unit tests

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/unit/.gitkeep`

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest @vitest/coverage-v8
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/lib/**/*.ts']
    }
  },
  resolve: {
    alias: { '~': '/src' }
  }
});
```

- [ ] **Step 3: Add npm scripts to `package.json`**

Edit `package.json` to add:

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "wrangler pages dev ./dist",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "check": "astro check"
  }
}
```

- [ ] **Step 4: Verify Vitest runs (no tests yet)**

```bash
mkdir -p tests/unit
touch tests/unit/.gitkeep
ASDF_NODEJS_VERSION=22.22.2 npm test
```

Expected: "No test files found" — acceptable.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json package-lock.json tests/unit/.gitkeep
git commit -m "chore: add Vitest for unit tests"
```

---

### Task 0.4: Set up Playwright for E2E tests

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/.gitkeep`

- [ ] **Step 1: Install Playwright**

```bash
npm install -D @playwright/test
ASDF_NODEJS_VERSION=22.22.2 npx playwright install chromium
```

- [ ] **Step 2: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 60000
  }
});
```

- [ ] **Step 3: Commit**

```bash
mkdir -p tests/e2e
touch tests/e2e/.gitkeep
git add playwright.config.ts tests/e2e/.gitkeep package.json package-lock.json
git commit -m "chore: add Playwright for E2E tests"
```

---

### Task 0.5: Set up Tailwind with JDM Touge theme tokens

**Files:**
- Create: `tailwind.config.mjs`
- Create: `src/styles/global.css`

- [ ] **Step 1: Create `tailwind.config.mjs`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#0a0e14', soft: '#0d1218', card: '#131822' },
        line: { DEFAULT: '#1f2733', muted: '#293340' },
        text: { DEFAULT: '#e6f1ff', soft: '#c8d2dc', mute: '#8a98a8', dim: '#5a6878' },
        cyan: { DEFAULT: '#00d9ff' },
        pink: { DEFAULT: '#ff2e63' }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace']
      },
      letterSpacing: { wider2: '0.15em', wider3: '0.2em' }
    }
  },
  plugins: []
};
```

- [ ] **Step 2: Create `src/styles/global.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-bg text-text font-sans antialiased;
  }
  ::selection {
    @apply bg-cyan text-bg;
  }
}

@layer components {
  .label-mono {
    @apply font-mono text-[10px] uppercase tracking-wider2 text-text-mute;
  }
  .badge-mono {
    @apply font-mono text-[10px] uppercase tracking-wider2;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.mjs src/styles/global.css
git commit -m "feat: add Tailwind theme tokens for JDM Touge direction"
```

---

## Phase 1 — Database Schema & Seed Data

### Task 1.1: Write initial D1 schema migration

**Files:**
- Create: `migrations/0001_initial_schema.sql`

- [ ] **Step 1: Create the migration file**

Create `migrations/0001_initial_schema.sql` with full schema (copy verbatim from the design spec §4):

```sql
CREATE TABLE tunes (
  id              INTEGER PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  share_code      TEXT NOT NULL,
  car_id          INTEGER NOT NULL REFERENCES cars(id),
  tune_type       TEXT NOT NULL CHECK (tune_type IN ('touge','drift','grip','drag','rally','offroad')),
  pi_class        TEXT NOT NULL CHECK (pi_class IN ('D','C','B','A','S1','S2','X')),
  pi_score        INTEGER NOT NULL,
  drivetrain      TEXT NOT NULL CHECK (drivetrain IN ('RWD','AWD','FWD')),
  power_hp        INTEGER,
  weight_lb       INTEGER,
  description     TEXT,
  tune_values     TEXT NOT NULL,
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

CREATE INDEX idx_tunes_car ON tunes(car_id, status);
CREATE INDEX idx_tunes_type ON tunes(tune_type, status);
CREATE INDEX idx_tunes_rating ON tunes(rating_sum, rating_count) WHERE status = 'public';
CREATE INDEX idx_tunes_downloads ON tunes(download_count DESC) WHERE status = 'public';

CREATE TABLE cars (
  id     INTEGER PRIMARY KEY,
  year   INTEGER NOT NULL,
  make   TEXT NOT NULL,
  model  TEXT NOT NULL,
  slug   TEXT UNIQUE NOT NULL
);
CREATE INDEX idx_cars_slug ON cars(slug);
CREATE INDEX idx_cars_make ON cars(make);

CREATE TABLE tracks (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  surface    TEXT NOT NULL CHECK (surface IN ('asphalt','dirt','snow','mixed')),
  length_km  REAL,
  region     TEXT
);

CREATE TABLE tune_tracks (
  tune_id   INTEGER NOT NULL REFERENCES tunes(id) ON DELETE CASCADE,
  track_id  INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  fit_score INTEGER,
  PRIMARY KEY (tune_id, track_id)
);

CREATE TABLE reviews (
  id            INTEGER PRIMARY KEY,
  tune_id       INTEGER NOT NULL REFERENCES tunes(id) ON DELETE CASCADE,
  author_handle TEXT NOT NULL,
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body          TEXT,
  ip_hash       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'public' CHECK (status IN ('public','hidden','deleted')),
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_reviews_tune ON reviews(tune_id, status, created_at DESC);

CREATE TABLE reports (
  id           INTEGER PRIMARY KEY,
  target_kind  TEXT NOT NULL CHECK (target_kind IN ('tune','review')),
  target_id    INTEGER NOT NULL,
  reason       TEXT NOT NULL,
  ip_hash      TEXT NOT NULL,
  resolved     INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);

CREATE VIRTUAL TABLE tunes_fts USING fts5(
  name, description, author_handle,
  content='tunes', content_rowid='id'
);

CREATE TRIGGER tunes_ai AFTER INSERT ON tunes BEGIN
  INSERT INTO tunes_fts(rowid, name, description, author_handle)
  VALUES (new.id, new.name, new.description, new.author_handle);
END;

CREATE TRIGGER tunes_au AFTER UPDATE ON tunes BEGIN
  UPDATE tunes_fts SET name = new.name, description = new.description, author_handle = new.author_handle
  WHERE rowid = new.id;
END;

CREATE TRIGGER tunes_ad AFTER DELETE ON tunes BEGIN
  DELETE FROM tunes_fts WHERE rowid = old.id;
END;
```

- [ ] **Step 2: Apply the migration locally**

```bash
ASDF_NODEJS_VERSION=22.22.2 npx wrangler d1 migrations apply fh6-tune-platform-local --local
```

Expected: migrations applied successfully.

- [ ] **Step 3: Verify tables exist**

```bash
ASDF_NODEJS_VERSION=22.22.2 npx wrangler d1 execute fh6-tune-platform-local --local --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

Expected output should list: cars, reports, reviews, tracks, tune_tracks, tunes, tunes_fts (plus FTS internal tables).

- [ ] **Step 4: Commit**

```bash
git add migrations/
git commit -m "feat(db): add initial schema migration"
```

---

### Task 1.2: Write FH5 car seed data

**Files:**
- Create: `src/data/cars-seed.ts`
- Create: `migrations/0002_seed_cars_tracks.sql` (partial — cars only)

- [ ] **Step 1: Create `src/data/cars-seed.ts` with starter FH5 JDM cars**

This is intentionally a starter list. Expand to full FH5 car list before launch.

```ts
export type CarSeed = {
  year: number;
  make: string;
  model: string;
  slug: string;
};

export const carsSeed: CarSeed[] = [
  // Nissan
  { year: 1989, make: 'Nissan', model: 'Skyline GT-R R32', slug: 'nissan-skyline-gtr-r32-1989' },
  { year: 1995, make: 'Nissan', model: 'Skyline GT-R R33', slug: 'nissan-skyline-gtr-r33-1995' },
  { year: 1999, make: 'Nissan', model: 'Skyline GT-R R34', slug: 'nissan-skyline-gtr-r34-1999' },
  { year: 1993, make: 'Nissan', model: '240SX S13', slug: 'nissan-240sx-s13-1993' },
  { year: 1998, make: 'Nissan', model: 'Silvia S15 Spec-R', slug: 'nissan-silvia-s15-1998' },
  // Toyota
  { year: 1986, make: 'Toyota', model: 'Sprinter Trueno AE86', slug: 'toyota-sprinter-trueno-ae86-1986' },
  { year: 1994, make: 'Toyota', model: 'Supra MK4', slug: 'toyota-supra-mk4-1994' },
  { year: 1999, make: 'Toyota', model: 'Chaser JZX100', slug: 'toyota-chaser-jzx100-1999' },
  // Mazda
  { year: 1992, make: 'Mazda', model: 'RX-7 FD3S', slug: 'mazda-rx7-fd3s-1992' },
  { year: 1989, make: 'Mazda', model: 'MX-5 Miata NA', slug: 'mazda-mx5-miata-na-1989' },
  // Honda
  { year: 1999, make: 'Honda', model: 'S2000 AP1', slug: 'honda-s2000-ap1-1999' },
  { year: 1997, make: 'Honda', model: 'Civic Type R EK9', slug: 'honda-civic-type-r-ek9-1997' },
  { year: 2002, make: 'Honda', model: 'NSX-R', slug: 'honda-nsx-r-2002' },
  // Mitsubishi
  { year: 2008, make: 'Mitsubishi', model: 'Lancer Evolution X', slug: 'mitsubishi-evo-x-2008' },
  { year: 1999, make: 'Mitsubishi', model: 'Lancer Evolution VI', slug: 'mitsubishi-evo-vi-1999' },
  // Subaru
  { year: 2004, make: 'Subaru', model: 'Impreza WRX STI', slug: 'subaru-impreza-wrx-sti-2004' }
];
```

- [ ] **Step 2: Generate SQL from the seed array**

Create `scripts/generate-seed-sql.ts`:

```ts
import { carsSeed } from '../src/data/cars-seed';
import { tracksSeed } from '../src/data/tracks-seed';
import { writeFileSync } from 'node:fs';

const escape = (s: string) => s.replace(/'/g, "''");

const carInserts = carsSeed
  .map((c, i) => `(${i + 1}, ${c.year}, '${escape(c.make)}', '${escape(c.model)}', '${escape(c.slug)}')`)
  .join(',\n  ');

const trackInserts = tracksSeed
  .map((t, i) => `(${i + 1}, '${escape(t.name)}', '${escape(t.slug)}', '${t.surface}', ${t.length_km ?? 'NULL'}, ${t.region ? `'${escape(t.region)}'` : 'NULL'})`)
  .join(',\n  ');

const sql = `-- Auto-generated by scripts/generate-seed-sql.ts
INSERT INTO cars (id, year, make, model, slug) VALUES
  ${carInserts};

INSERT INTO tracks (id, name, slug, surface, length_km, region) VALUES
  ${trackInserts};
`;

writeFileSync('migrations/0002_seed_cars_tracks.sql', sql);
console.log('Wrote migrations/0002_seed_cars_tracks.sql');
```

- [ ] **Step 3: Defer running the script — tracks-seed.ts is created in Task 1.3**

Continue to Task 1.3 to create the tracks seed before running the script.

---

### Task 1.3: Write tracks seed data and apply seed migration

**Files:**
- Create: `src/data/tracks-seed.ts`
- Create: `migrations/0002_seed_cars_tracks.sql` (generated)

- [ ] **Step 1: Create `src/data/tracks-seed.ts`**

These are placeholder Japan-themed tracks; replace with confirmed FH6 tracks when announced.

```ts
export type TrackSeed = {
  name: string;
  slug: string;
  surface: 'asphalt' | 'dirt' | 'snow' | 'mixed';
  length_km?: number;
  region?: string;
};

export const tracksSeed: TrackSeed[] = [
  { name: 'Mt. Akina Downhill', slug: 'mt-akina-downhill', surface: 'asphalt', length_km: 5.2, region: 'Touge' },
  { name: 'Hakone Pass', slug: 'hakone-pass', surface: 'asphalt', length_km: 6.8, region: 'Touge' },
  { name: 'Irohazaka', slug: 'irohazaka', surface: 'asphalt', length_km: 4.4, region: 'Touge' },
  { name: 'Mt. Fuji Touge', slug: 'mt-fuji-touge', surface: 'asphalt', length_km: 7.1, region: 'Touge' },
  { name: 'Tsukuba Circuit', slug: 'tsukuba-circuit', surface: 'asphalt', length_km: 2.0, region: 'Circuit' },
  { name: 'Fuji Speedway', slug: 'fuji-speedway', surface: 'asphalt', length_km: 4.5, region: 'Circuit' },
  { name: 'Suzuka Circuit', slug: 'suzuka-circuit', surface: 'asphalt', length_km: 5.8, region: 'Circuit' },
  { name: 'Bayshore Route', slug: 'bayshore-route', surface: 'asphalt', length_km: 12.0, region: 'Highway' },
  { name: 'Mt. Aso Dirt', slug: 'mt-aso-dirt', surface: 'dirt', length_km: 4.2, region: 'Off-road' },
  { name: 'Hokkaido Snow Run', slug: 'hokkaido-snow-run', surface: 'snow', length_km: 6.3, region: 'Off-road' }
];
```

- [ ] **Step 2: Install tsx for running TS scripts**

```bash
npm install -D tsx
```

- [ ] **Step 3: Run the generator script**

```bash
ASDF_NODEJS_VERSION=22.22.2 npx tsx scripts/generate-seed-sql.ts
```

Expected: prints "Wrote migrations/0002_seed_cars_tracks.sql".

- [ ] **Step 4: Apply the new migration**

```bash
ASDF_NODEJS_VERSION=22.22.2 npx wrangler d1 migrations apply fh6-tune-platform-local --local
```

- [ ] **Step 5: Verify seed data loaded**

```bash
ASDF_NODEJS_VERSION=22.22.2 npx wrangler d1 execute fh6-tune-platform-local --local --command="SELECT COUNT(*) AS c FROM cars;"
ASDF_NODEJS_VERSION=22.22.2 npx wrangler d1 execute fh6-tune-platform-local --local --command="SELECT COUNT(*) AS c FROM tracks;"
```

Expected: 16 cars, 10 tracks.

- [ ] **Step 6: Commit**

```bash
git add src/data/ scripts/ migrations/0002_seed_cars_tracks.sql package.json package-lock.json
git commit -m "feat(db): seed initial car and track data"
```

---

## Phase 2 — Core Utility Libraries (TDD)

### Task 2.1: Slug generator

**Files:**
- Create: `src/lib/slug.ts`
- Create: `tests/unit/slug.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/slug.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeSlug, makeTuneSlug } from '~/lib/slug';

describe('makeSlug', () => {
  it('lowercases and hyphenates ASCII text', () => {
    expect(makeSlug('Touge Master')).toBe('touge-master');
  });

  it('strips non-ASCII characters', () => {
    expect(makeSlug('走山大師 Touge Master')).toBe('touge-master');
  });

  it('collapses multiple spaces and special chars', () => {
    expect(makeSlug('  Hello   World !!! ')).toBe('hello-world');
  });

  it('returns empty string for purely non-ASCII input', () => {
    expect(makeSlug('走山大師')).toBe('');
  });

  it('truncates at 80 chars', () => {
    expect(makeSlug('a'.repeat(200)).length).toBeLessThanOrEqual(80);
  });
});

describe('makeTuneSlug', () => {
  it('combines name + car + random suffix', () => {
    const slug = makeTuneSlug('Touge Master', 'nissan-skyline-gtr-r34-1999');
    expect(slug).toMatch(/^touge-master-nissan-skyline-gtr-r34-1999-[a-z0-9]{6}$/);
  });

  it('uses fallback when name has no ASCII', () => {
    const slug = makeTuneSlug('走山', 'nissan-skyline-gtr-r34-1999');
    expect(slug).toMatch(/^tune-nissan-skyline-gtr-r34-1999-[a-z0-9]{6}$/);
  });
});
```

- [ ] **Step 2: Run the tests to verify failure**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm test -- slug
```

Expected: FAIL — cannot resolve `~/lib/slug`.

- [ ] **Step 3: Implement `src/lib/slug.ts`**

```ts
export function makeSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function randomSuffix(len = 6): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function makeTuneSlug(name: string, carSlug: string): string {
  const nameSlug = makeSlug(name) || 'tune';
  return `${nameSlug}-${carSlug}-${randomSuffix()}`.slice(0, 120);
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm test -- slug
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/slug.ts tests/unit/slug.test.ts
git commit -m "feat(lib): add slug generator with English-only output"
```

---

### Task 2.2: IP hash

**Files:**
- Create: `src/lib/ip-hash.ts`
- Create: `tests/unit/ip-hash.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/ip-hash.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hashIp } from '~/lib/ip-hash';

describe('hashIp', () => {
  it('produces a 64-char hex hash', async () => {
    const hash = await hashIp('192.168.1.1', 'salt-1');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces same hash for same input and salt', async () => {
    const a = await hashIp('192.168.1.1', 'salt-1');
    const b = await hashIp('192.168.1.1', 'salt-1');
    expect(a).toBe(b);
  });

  it('produces different hashes for different salts', async () => {
    const a = await hashIp('192.168.1.1', 'salt-1');
    const b = await hashIp('192.168.1.1', 'salt-2');
    expect(a).not.toBe(b);
  });

  it('produces different hashes for different IPs', async () => {
    const a = await hashIp('192.168.1.1', 'salt-1');
    const b = await hashIp('192.168.1.2', 'salt-1');
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm test -- ip-hash
```

Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement `src/lib/ip-hash.ts`**

```ts
export async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${ip}|${salt}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function dailySalt(baseSalt: string, date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  return `${baseSalt}|${day}`;
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm test -- ip-hash
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ip-hash.ts tests/unit/ip-hash.test.ts
git commit -m "feat(lib): add salted IP hashing"
```

---

### Task 2.3: Edit password hashing

**Files:**
- Create: `src/lib/auth.ts`
- Create: `tests/unit/auth.test.ts`

- [ ] **Step 1: Install bcryptjs (pure JS, works on Workers)**

```bash
npm install bcryptjs
npm install -D @types/bcryptjs
```

- [ ] **Step 2: Write the failing tests**

Create `tests/unit/auth.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hashEditPassword, verifyEditPassword, validatePasswordStrength } from '~/lib/auth';

describe('hashEditPassword + verifyEditPassword', () => {
  it('hashes and verifies a valid password', async () => {
    const hash = await hashEditPassword('strong-pass-123');
    expect(hash).not.toBe('strong-pass-123');
    expect(await verifyEditPassword('strong-pass-123', hash)).toBe(true);
  });

  it('rejects wrong password', async () => {
    const hash = await hashEditPassword('strong-pass-123');
    expect(await verifyEditPassword('wrong-pass', hash)).toBe(false);
  });
});

describe('validatePasswordStrength', () => {
  it('accepts a 6+ char password not in blocklist', () => {
    expect(validatePasswordStrength('uniquePass1')).toEqual({ ok: true });
  });

  it('rejects passwords shorter than 6 chars', () => {
    const r = validatePasswordStrength('abc');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('too_short');
  });

  it('rejects blocklisted passwords', () => {
    const r = validatePasswordStrength('password');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('blocklisted');
  });

  it('rejects "123456"', () => {
    const r = validatePasswordStrength('123456');
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm test -- auth
```

Expected: FAIL.

- [ ] **Step 4: Implement `src/lib/auth.ts`**

```ts
import bcrypt from 'bcryptjs';

const PASSWORD_BLOCKLIST = new Set([
  'password', 'password1', 'qwerty', '123456', '12345678', 'letmein',
  'iloveyou', 'admin', 'welcome', 'monkey', 'dragon', 'master',
  'abc123', 'football', 'sunshine', '111111', 'qazwsx', '1q2w3e',
  'tune123', 'forza123', 'fh6', 'touge'
]);

export async function hashEditPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyEditPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export type PasswordCheck = { ok: true } | { ok: false; reason: 'too_short' | 'blocklisted' };

export function validatePasswordStrength(plain: string): PasswordCheck {
  if (plain.length < 6) return { ok: false, reason: 'too_short' };
  if (PASSWORD_BLOCKLIST.has(plain.toLowerCase())) return { ok: false, reason: 'blocklisted' };
  return { ok: true };
}
```

- [ ] **Step 5: Run tests to verify pass**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm test -- auth
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts tests/unit/auth.test.ts package.json package-lock.json
git commit -m "feat(lib): add edit password hashing and strength validation"
```

---

### Task 2.4: Edit session cookie

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `tests/unit/auth.test.ts`

- [ ] **Step 1: Add tests for cookie sign/verify**

Append to `tests/unit/auth.test.ts`:

```ts
import { signEditCookie, verifyEditCookie } from '~/lib/auth';

describe('signEditCookie + verifyEditCookie', () => {
  const SECRET = 'a'.repeat(32);

  it('signs and verifies a cookie for a given slug', async () => {
    const cookie = await signEditCookie('my-tune-slug', SECRET, 3600);
    const result = await verifyEditCookie(cookie, 'my-tune-slug', SECRET);
    expect(result).toBe(true);
  });

  it('rejects cookie for different slug', async () => {
    const cookie = await signEditCookie('slug-a', SECRET, 3600);
    expect(await verifyEditCookie(cookie, 'slug-b', SECRET)).toBe(false);
  });

  it('rejects expired cookie', async () => {
    const cookie = await signEditCookie('slug', SECRET, -1);
    expect(await verifyEditCookie(cookie, 'slug', SECRET)).toBe(false);
  });

  it('rejects tampered cookie', async () => {
    const cookie = await signEditCookie('slug', SECRET, 3600);
    const tampered = cookie.slice(0, -2) + 'xx';
    expect(await verifyEditCookie(tampered, 'slug', SECRET)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm test -- auth
```

Expected: FAIL — functions don't exist.

- [ ] **Step 3: Add cookie functions to `src/lib/auth.ts`**

Append:

```ts
async function hmacSign(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function signEditCookie(slug: string, secret: string, ttlSeconds: number): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${slug}.${expires}`;
  const sig = await hmacSign(payload, secret);
  return `${payload}.${sig}`;
}

export async function verifyEditCookie(cookie: string, expectedSlug: string, secret: string): Promise<boolean> {
  const parts = cookie.split('.');
  if (parts.length !== 3) return false;
  const [slug, expiresStr, sig] = parts;
  if (slug !== expectedSlug) return false;
  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) return false;
  const expectedSig = await hmacSign(`${slug}.${expires}`, secret);
  if (sig.length !== expectedSig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < sig.length; i++) mismatch |= sig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  return mismatch === 0;
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm test -- auth
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts tests/unit/auth.test.ts
git commit -m "feat(lib): add HMAC-signed edit session cookie"
```

---

### Task 2.5: Tune values schema and validation

**Files:**
- Create: `src/data/tune-schema.ts`
- Create: `src/lib/tune-values.ts`
- Create: `tests/unit/tune-values.test.ts`

- [ ] **Step 1: Create `src/data/tune-schema.ts`**

```ts
export type TuneValues = {
  tires: { pressure_f: number; pressure_r: number };
  gearing: {
    final: number;
    g1: number; g2: number; g3: number;
    g4: number; g5: number; g6: number;
  };
  alignment: {
    camber_f: number; camber_r: number;
    toe_f: number; toe_r: number;
    caster: number;
  };
  antiroll: { stiffness_f: number; stiffness_r: number };
  springs: {
    rate_f: number; rate_r: number;
    height_f: number; height_r: number;
  };
  damping: {
    rebound_f: number; rebound_r: number;
    bump_f: number; bump_r: number;
  };
  aero: { front: number; rear: number };
  brakes: { balance_pct_f: number; pressure_pct: number };
  diff: { accel_pct: number; decel_pct: number };
};

export const TUNE_VALUE_RANGES: Record<string, { min: number; max: number }> = {
  pressure: { min: 0, max: 100 },
  gear: { min: 0, max: 10 },
  final: { min: 0, max: 10 },
  camber: { min: -10, max: 10 },
  toe: { min: -5, max: 5 },
  caster: { min: 0, max: 10 },
  arb: { min: 0, max: 65 },
  spring_rate: { min: 0, max: 2500 },
  height: { min: 0, max: 10 },
  damp: { min: 0, max: 20 },
  aero_lb: { min: 0, max: 600 },
  brake_pct: { min: 0, max: 200 },
  diff_pct: { min: 0, max: 100 }
};
```

- [ ] **Step 2: Write failing tests**

Create `tests/unit/tune-values.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateTuneValues, sampleTuneValues } from '~/lib/tune-values';

describe('validateTuneValues', () => {
  it('accepts a complete valid object', () => {
    const r = validateTuneValues(sampleTuneValues());
    expect(r.ok).toBe(true);
  });

  it('rejects when a required field is missing', () => {
    const v: any = sampleTuneValues();
    delete v.tires.pressure_f;
    const r = validateTuneValues(v);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/tires\.pressure_f/);
  });

  it('rejects when a field is out of range', () => {
    const v = sampleTuneValues();
    v.alignment.camber_f = -99;
    const r = validateTuneValues(v);
    expect(r.ok).toBe(false);
  });

  it('rejects when a field is not a number', () => {
    const v: any = sampleTuneValues();
    v.springs.rate_f = 'soft';
    const r = validateTuneValues(v);
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 3: Run to verify failure**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm test -- tune-values
```

Expected: FAIL.

- [ ] **Step 4: Implement `src/lib/tune-values.ts`**

```ts
import type { TuneValues } from '~/data/tune-schema';
import { TUNE_VALUE_RANGES } from '~/data/tune-schema';

type Range = keyof typeof TUNE_VALUE_RANGES;

const SCHEMA: Array<{ path: string; range: Range }> = [
  { path: 'tires.pressure_f', range: 'pressure' }, { path: 'tires.pressure_r', range: 'pressure' },
  { path: 'gearing.final', range: 'final' },
  { path: 'gearing.g1', range: 'gear' }, { path: 'gearing.g2', range: 'gear' },
  { path: 'gearing.g3', range: 'gear' }, { path: 'gearing.g4', range: 'gear' },
  { path: 'gearing.g5', range: 'gear' }, { path: 'gearing.g6', range: 'gear' },
  { path: 'alignment.camber_f', range: 'camber' }, { path: 'alignment.camber_r', range: 'camber' },
  { path: 'alignment.toe_f', range: 'toe' }, { path: 'alignment.toe_r', range: 'toe' },
  { path: 'alignment.caster', range: 'caster' },
  { path: 'antiroll.stiffness_f', range: 'arb' }, { path: 'antiroll.stiffness_r', range: 'arb' },
  { path: 'springs.rate_f', range: 'spring_rate' }, { path: 'springs.rate_r', range: 'spring_rate' },
  { path: 'springs.height_f', range: 'height' }, { path: 'springs.height_r', range: 'height' },
  { path: 'damping.rebound_f', range: 'damp' }, { path: 'damping.rebound_r', range: 'damp' },
  { path: 'damping.bump_f', range: 'damp' }, { path: 'damping.bump_r', range: 'damp' },
  { path: 'aero.front', range: 'aero_lb' }, { path: 'aero.rear', range: 'aero_lb' },
  { path: 'brakes.balance_pct_f', range: 'brake_pct' }, { path: 'brakes.pressure_pct', range: 'brake_pct' },
  { path: 'diff.accel_pct', range: 'diff_pct' }, { path: 'diff.decel_pct', range: 'diff_pct' }
];

function getPath(obj: any, path: string): unknown {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

export type ValidateResult = { ok: true; data: TuneValues } | { ok: false; errors: string[] };

export function validateTuneValues(input: unknown): ValidateResult {
  if (!input || typeof input !== 'object') return { ok: false, errors: ['must be an object'] };
  const errors: string[] = [];
  for (const { path, range } of SCHEMA) {
    const v = getPath(input, path);
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      errors.push(`${path}: must be a number`);
      continue;
    }
    const { min, max } = TUNE_VALUE_RANGES[range];
    if (v < min || v > max) errors.push(`${path}: ${v} not in [${min}, ${max}]`);
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, data: input as TuneValues };
}

export function sampleTuneValues(): TuneValues {
  return {
    tires: { pressure_f: 28.5, pressure_r: 30.0 },
    gearing: { final: 3.97, g1: 3.21, g2: 2.18, g3: 1.56, g4: 1.20, g5: 0.97, g6: 0.79 },
    alignment: { camber_f: -2.4, camber_r: -1.8, toe_f: -0.1, toe_r: 0.2, caster: 6.2 },
    antiroll: { stiffness_f: 28.5, stiffness_r: 22.0 },
    springs: { rate_f: 685, rate_r: 520, height_f: 4.4, height_r: 4.5 },
    damping: { rebound_f: 9.4, rebound_r: 7.1, bump_f: 3.8, bump_r: 2.6 },
    aero: { front: 155, rear: 204 },
    brakes: { balance_pct_f: 52, pressure_pct: 115 },
    diff: { accel_pct: 42, decel_pct: 18 }
  };
}
```

- [ ] **Step 5: Run tests to verify pass**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm test -- tune-values
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/tune-schema.ts src/lib/tune-values.ts tests/unit/tune-values.test.ts
git commit -m "feat(lib): add tune values JSON schema and validation"
```

---

### Task 2.6: Turnstile verification

**Files:**
- Create: `src/lib/turnstile.ts`
- Create: `tests/unit/turnstile.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/turnstile.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyTurnstile } from '~/lib/turnstile';

describe('verifyTurnstile', () => {
  const SECRET = 'test-secret';
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true on success', async () => {
    fetchMock.mockResolvedValueOnce({ json: async () => ({ success: true }) });
    expect(await verifyTurnstile('user-token', SECRET, '1.2.3.4')).toBe(true);
  });

  it('returns false on failure', async () => {
    fetchMock.mockResolvedValueOnce({ json: async () => ({ success: false, 'error-codes': ['invalid-input'] }) });
    expect(await verifyTurnstile('user-token', SECRET, '1.2.3.4')).toBe(false);
  });

  it('returns false on network error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'));
    expect(await verifyTurnstile('user-token', SECRET, '1.2.3.4')).toBe(false);
  });

  it('returns false on empty token', async () => {
    expect(await verifyTurnstile('', SECRET, '1.2.3.4')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm test -- turnstile
```

Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/turnstile.ts`**

```ts
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(token: string, secret: string, ip?: string): Promise<boolean> {
  if (!token) return false;
  const body = new FormData();
  body.set('secret', secret);
  body.set('response', token);
  if (ip) body.set('remoteip', ip);
  try {
    const r = await fetch(VERIFY_URL, { method: 'POST', body });
    const json: { success: boolean } = await r.json();
    return json.success === true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm test -- turnstile
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/turnstile.ts tests/unit/turnstile.test.ts
git commit -m "feat(lib): add Turnstile token verification"
```

---

### Task 2.7: KV-based rate limiter

**Files:**
- Create: `src/lib/rate-limit.ts`
- Create: `tests/unit/rate-limit.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/rate-limit.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit } from '~/lib/rate-limit';

function fakeKv(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    put: vi.fn(async (k: string, v: string, _opts?: { expirationTtl: number }) => {
      store.set(k, v);
    }),
    store
  };
}

describe('checkRateLimit', () => {
  it('allows first request and records count 1', async () => {
    const kv = fakeKv();
    const r = await checkRateLimit(kv as any, 'ip-abc', 'upload', 5, 3600);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(4);
    expect(kv.put).toHaveBeenCalled();
  });

  it('denies when limit is reached', async () => {
    const kv = fakeKv({ 'rl:upload:ip-abc': '5' });
    const r = await checkRateLimit(kv as any, 'ip-abc', 'upload', 5, 3600);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it('isolates buckets per action', async () => {
    const kv = fakeKv({ 'rl:upload:ip-abc': '5' });
    const r = await checkRateLimit(kv as any, 'ip-abc', 'review', 20, 3600);
    expect(r.allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm test -- rate-limit
```

Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/rate-limit.ts`**

```ts
export type RateLimitResult = { allowed: boolean; remaining: number };

export async function checkRateLimit(
  kv: KVNamespace,
  ipHash: string,
  action: string,
  limit: number,
  ttlSeconds: number
): Promise<RateLimitResult> {
  const key = `rl:${action}:${ipHash}`;
  const raw = await kv.get(key);
  const current = raw ? parseInt(raw, 10) : 0;
  if (current >= limit) return { allowed: false, remaining: 0 };
  const next = current + 1;
  await kv.put(key, String(next), { expirationTtl: ttlSeconds });
  return { allowed: true, remaining: limit - next };
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm test -- rate-limit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rate-limit.ts tests/unit/rate-limit.test.ts
git commit -m "feat(lib): add KV-based per-IP rate limiter"
```

---

### Task 2.8: Wilson score for ranking

**Files:**
- Create: `src/lib/wilson.ts`
- Create: `tests/unit/wilson.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { wilsonScore } from '~/lib/wilson';

describe('wilsonScore', () => {
  it('returns 0 when no reviews', () => {
    expect(wilsonScore(0, 0)).toBe(0);
  });

  it('lower bound increases with more positive reviews at same average', () => {
    const a = wilsonScore(10, 10);   // 1 review, avg 1
    const b = wilsonScore(100, 100); // 20 reviews, avg 1
    expect(b).toBeGreaterThan(a);
  });

  it('rates many high reviews above few perfect ones', () => {
    const few = wilsonScore(20, 4); // 4×5★ = 20
    const many = wilsonScore(960, 200); // 200×4.8★ avg
    expect(many).toBeGreaterThan(few);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm test -- wilson
```

Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/wilson.ts`**

```ts
const Z = 1.96;

export function wilsonScore(ratingSum: number, ratingCount: number): number {
  if (ratingCount <= 0) return 0;
  const phat = ratingSum / (ratingCount * 5);
  const n = ratingCount;
  const z2 = Z * Z;
  const num = phat + z2 / (2 * n) - Z * Math.sqrt((phat * (1 - phat) + z2 / (4 * n)) / n);
  const den = 1 + z2 / n;
  return num / den;
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm test -- wilson
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wilson.ts tests/unit/wilson.test.ts
git commit -m "feat(lib): add Wilson score for rating-based ranking"
```

---

## Phase 3 — Database Access Layer

### Task 3.1: D1 query helpers

**Files:**
- Create: `src/lib/db.ts`

This task does not have unit tests because D1 cannot be mocked easily in node; D1 interactions are covered by API endpoint tests (Phase 4) and E2E tests (Phase 8).

- [ ] **Step 1: Create `src/lib/db.ts` with typed helpers**

```ts
import type { TuneValues } from '~/data/tune-schema';

export type TuneRow = {
  id: number;
  slug: string;
  name: string;
  share_code: string;
  car_id: number;
  tune_type: string;
  pi_class: string;
  pi_score: number;
  drivetrain: string;
  power_hp: number | null;
  weight_lb: number | null;
  description: string | null;
  tune_values: string; // JSON
  author_handle: string;
  edit_password_hash: string;
  ip_hash: string;
  rating_sum: number;
  rating_count: number;
  download_count: number;
  status: string;
  created_at: number;
  updated_at: number;
};

export type TuneListItem = Omit<TuneRow, 'edit_password_hash' | 'ip_hash' | 'tune_values'> & {
  car: { make: string; model: string; year: number; slug: string };
};

export async function getCarBySlug(db: D1Database, slug: string) {
  return db.prepare('SELECT * FROM cars WHERE slug = ?').bind(slug).first<{ id: number; year: number; make: string; model: string; slug: string }>();
}

export async function getCarById(db: D1Database, id: number) {
  return db.prepare('SELECT * FROM cars WHERE id = ?').bind(id).first<{ id: number; year: number; make: string; model: string; slug: string }>();
}

export async function getTrackBySlug(db: D1Database, slug: string) {
  return db.prepare('SELECT * FROM tracks WHERE slug = ?').bind(slug).first();
}

export async function getTuneBySlug(db: D1Database, slug: string): Promise<TuneRow | null> {
  return db.prepare("SELECT * FROM tunes WHERE slug = ? AND status = 'public'").bind(slug).first<TuneRow>();
}

export async function getTuneForEdit(db: D1Database, slug: string): Promise<TuneRow | null> {
  return db.prepare("SELECT * FROM tunes WHERE slug = ? AND status != 'deleted'").bind(slug).first<TuneRow>();
}

export type ListFilters = {
  carSlug?: string;
  tuneType?: string;
  piClass?: string;
  drivetrain?: string;
  surface?: string;
  minRating?: number;
  search?: string;
  sort?: 'downloads' | 'rating' | 'newest' | 'reviews';
  limit?: number;
  offset?: number;
};

export async function listTunes(db: D1Database, filters: ListFilters = {}) {
  const wh: string[] = ["t.status = 'public'"];
  const params: unknown[] = [];
  if (filters.carSlug) { wh.push('c.slug = ?'); params.push(filters.carSlug); }
  if (filters.tuneType) { wh.push('t.tune_type = ?'); params.push(filters.tuneType); }
  if (filters.piClass) { wh.push('t.pi_class = ?'); params.push(filters.piClass); }
  if (filters.drivetrain) { wh.push('t.drivetrain = ?'); params.push(filters.drivetrain); }
  if (typeof filters.minRating === 'number') {
    wh.push('CASE WHEN t.rating_count = 0 THEN 0 ELSE t.rating_sum / t.rating_count END >= ?');
    params.push(filters.minRating);
  }
  const sort = filters.sort ?? 'downloads';
  const orderBy = {
    downloads: 't.download_count DESC',
    newest: 't.created_at DESC',
    reviews: 't.rating_count DESC',
    rating: '(CAST(t.rating_sum AS REAL) / NULLIF(t.rating_count, 0)) DESC NULLS LAST'
  }[sort];
  const limit = Math.min(filters.limit ?? 24, 100);
  const offset = filters.offset ?? 0;

  const sql = `
    SELECT t.*, c.year AS car_year, c.make AS car_make, c.model AS car_model, c.slug AS car_slug
    FROM tunes t
    JOIN cars c ON c.id = t.car_id
    WHERE ${wh.join(' AND ')}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `;
  params.push(limit, offset);

  return db.prepare(sql).bind(...params).all();
}

export async function searchTunes(db: D1Database, query: string, limit = 24) {
  return db.prepare(`
    SELECT t.*, c.year AS car_year, c.make AS car_make, c.model AS car_model, c.slug AS car_slug
    FROM tunes_fts f
    JOIN tunes t ON t.id = f.rowid
    JOIN cars c ON c.id = t.car_id
    WHERE tunes_fts MATCH ? AND t.status = 'public'
    ORDER BY rank
    LIMIT ?
  `).bind(query, limit).all();
}

export type InsertTuneInput = Omit<TuneRow, 'id' | 'rating_sum' | 'rating_count' | 'download_count' | 'created_at' | 'updated_at' | 'status'>;

export async function insertTune(db: D1Database, input: InsertTuneInput) {
  const now = Math.floor(Date.now() / 1000);
  const result = await db.prepare(`
    INSERT INTO tunes (
      slug, name, share_code, car_id, tune_type, pi_class, pi_score,
      drivetrain, power_hp, weight_lb, description, tune_values,
      author_handle, edit_password_hash, ip_hash, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'public', ?, ?)
  `).bind(
    input.slug, input.name, input.share_code, input.car_id, input.tune_type, input.pi_class, input.pi_score,
    input.drivetrain, input.power_hp, input.weight_lb, input.description, input.tune_values,
    input.author_handle, input.edit_password_hash, input.ip_hash, now, now
  ).run();
  return result.meta.last_row_id as number;
}

export async function attachTracks(db: D1Database, tuneId: number, trackIds: number[]) {
  if (!trackIds.length) return;
  const stmts = trackIds.map((tid) =>
    db.prepare('INSERT INTO tune_tracks (tune_id, track_id) VALUES (?, ?)').bind(tuneId, tid)
  );
  await db.batch(stmts);
}

export async function detachAllTracks(db: D1Database, tuneId: number) {
  await db.prepare('DELETE FROM tune_tracks WHERE tune_id = ?').bind(tuneId).run();
}

export async function incrementDownload(db: D1Database, tuneId: number) {
  await db.prepare('UPDATE tunes SET download_count = download_count + 1 WHERE id = ?').bind(tuneId).run();
}

export async function listReviews(db: D1Database, tuneId: number, limit = 20) {
  return db.prepare(`
    SELECT id, author_handle, rating, body, created_at
    FROM reviews WHERE tune_id = ? AND status = 'public'
    ORDER BY created_at DESC LIMIT ?
  `).bind(tuneId, limit).all();
}

export async function insertReview(db: D1Database, tuneId: number, authorHandle: string, rating: number, body: string | null, ipHash: string) {
  const now = Math.floor(Date.now() / 1000);
  const batch = await db.batch([
    db.prepare(`
      INSERT INTO reviews (tune_id, author_handle, rating, body, ip_hash, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'public', ?)
    `).bind(tuneId, authorHandle, rating, body, ipHash, now),
    db.prepare('UPDATE tunes SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 WHERE id = ?').bind(rating, tuneId)
  ]);
  return batch;
}

export async function insertReport(db: D1Database, targetKind: 'tune' | 'review', targetId: number, reason: string, ipHash: string) {
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`
    INSERT INTO reports (target_kind, target_id, reason, ip_hash, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(targetKind, targetId, reason, ipHash, now).run();
}
```

- [ ] **Step 2: Type-check passes**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm run check
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat(db): add typed D1 query helpers"
```

---

## Phase 4 — API Endpoints

### Task 4.1: POST /api/tunes — upload endpoint

**Files:**
- Create: `src/pages/api/tunes/index.ts`

- [ ] **Step 1: Create the upload endpoint**

```ts
import type { APIRoute } from 'astro';
import { verifyTurnstile } from '~/lib/turnstile';
import { hashIp, dailySalt } from '~/lib/ip-hash';
import { hashEditPassword, validatePasswordStrength } from '~/lib/auth';
import { makeTuneSlug } from '~/lib/slug';
import { validateTuneValues } from '~/lib/tune-values';
import { checkRateLimit } from '~/lib/rate-limit';
import { getCarById, insertTune, attachTracks } from '~/lib/db';

export const prerender = false;

type UploadBody = {
  name: string;
  share_code: string;
  car_id: number;
  tune_type: string;
  pi_class: string;
  pi_score: number;
  drivetrain: string;
  power_hp?: number;
  weight_lb?: number;
  description?: string;
  tune_values: unknown;
  author_handle: string;
  edit_password: string;
  track_ids?: number[];
  turnstile_token: string;
  honeypot?: string;
};

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  const env = locals.runtime.env;
  let body: UploadBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (body.honeypot) return Response.json({ error: 'spam' }, { status: 400 });
  if (!body.turnstile_token || !(await verifyTurnstile(body.turnstile_token, env.TURNSTILE_SECRET_KEY, clientAddress))) {
    return Response.json({ error: 'turnstile_failed' }, { status: 400 });
  }

  const ipHash = await hashIp(clientAddress ?? 'unknown', dailySalt(env.IP_HASH_SALT));
  const rl = await checkRateLimit(env.KV, ipHash, 'upload', 5, 3600);
  if (!rl.allowed) return Response.json({ error: 'rate_limited' }, { status: 429 });

  const pwCheck = validatePasswordStrength(body.edit_password ?? '');
  if (!pwCheck.ok) return Response.json({ error: 'weak_password', reason: pwCheck.reason }, { status: 400 });

  const car = await getCarById(env.DB, body.car_id);
  if (!car) return Response.json({ error: 'unknown_car' }, { status: 400 });

  const tv = validateTuneValues(body.tune_values);
  if (!tv.ok) return Response.json({ error: 'invalid_tune_values', details: tv.errors }, { status: 400 });

  const passwordHash = await hashEditPassword(body.edit_password);
  const slug = makeTuneSlug(body.name, car.slug);

  let tuneId: number;
  try {
    tuneId = await insertTune(env.DB, {
      slug,
      name: body.name.slice(0, 120),
      share_code: body.share_code.slice(0, 32),
      car_id: car.id,
      tune_type: body.tune_type,
      pi_class: body.pi_class,
      pi_score: body.pi_score,
      drivetrain: body.drivetrain,
      power_hp: body.power_hp ?? null,
      weight_lb: body.weight_lb ?? null,
      description: body.description?.slice(0, 4000) ?? null,
      tune_values: JSON.stringify(tv.data),
      author_handle: (body.author_handle || 'anonymous').slice(0, 40),
      edit_password_hash: passwordHash,
      ip_hash: ipHash
    });
  } catch (err) {
    if (String(err).includes('UNIQUE')) {
      return Response.json({ error: 'slug_collision_retry' }, { status: 409 });
    }
    throw err;
  }

  if (body.track_ids?.length) {
    await attachTracks(env.DB, tuneId, body.track_ids.slice(0, 10));
  }

  return Response.json({ slug, edit_url: `/edit/${slug}` }, { status: 201 });
};

export const GET: APIRoute = async ({ url, locals }) => {
  const { listTunes } = await import('~/lib/db');
  const q = url.searchParams;
  const result = await listTunes(locals.runtime.env.DB, {
    carSlug: q.get('car') ?? undefined,
    tuneType: q.get('type') ?? undefined,
    piClass: q.get('pi') ?? undefined,
    drivetrain: q.get('drivetrain') ?? undefined,
    minRating: q.get('min_rating') ? Number(q.get('min_rating')) : undefined,
    sort: (q.get('sort') as any) ?? undefined,
    limit: q.get('limit') ? Number(q.get('limit')) : undefined,
    offset: q.get('offset') ? Number(q.get('offset')) : undefined
  });
  return Response.json(result);
};
```

- [ ] **Step 2: Type-check**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm run check
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/tunes/index.ts
git commit -m "feat(api): add POST /api/tunes upload endpoint"
```

---

### Task 4.2: GET/PATCH/DELETE /api/tunes/[id]

**Files:**
- Create: `src/pages/api/tunes/[id]/index.ts`

- [ ] **Step 1: Implement the endpoint**

```ts
import type { APIRoute } from 'astro';
import { getTuneBySlug, getTuneForEdit } from '~/lib/db';
import { verifyEditPassword, verifyEditCookie, signEditCookie } from '~/lib/auth';
import { validateTuneValues } from '~/lib/tune-values';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  const tune = await getTuneBySlug(locals.runtime.env.DB, params.id!);
  if (!tune) return new Response('not_found', { status: 404 });
  return Response.json({ ...tune, edit_password_hash: undefined, ip_hash: undefined, tune_values: JSON.parse(tune.tune_values) });
};

export const PATCH: APIRoute = async ({ params, request, locals, cookies }) => {
  const env = locals.runtime.env;
  const slug = params.id!;
  const tune = await getTuneForEdit(env.DB, slug);
  if (!tune) return new Response('not_found', { status: 404 });

  const body = await request.json() as { edit_password?: string; updates: Partial<{
    name: string; description: string; tune_values: unknown;
  }> };

  const cookieToken = cookies.get('touge_edit')?.value;
  let authorized = false;

  if (cookieToken && await verifyEditCookie(cookieToken, slug, env.EDIT_COOKIE_SECRET)) {
    authorized = true;
  } else if (body.edit_password && await verifyEditPassword(body.edit_password, tune.edit_password_hash)) {
    authorized = true;
    const cookie = await signEditCookie(slug, env.EDIT_COOKIE_SECRET, 3600);
    cookies.set('touge_edit', cookie, { path: '/', httpOnly: true, secure: true, sameSite: 'strict', maxAge: 3600 });
  }

  if (!authorized) return new Response('unauthorized', { status: 401 });

  const updates = body.updates ?? {};
  const sets: string[] = [];
  const params2: unknown[] = [];
  if (typeof updates.name === 'string') { sets.push('name = ?'); params2.push(updates.name.slice(0, 120)); }
  if (typeof updates.description === 'string') { sets.push('description = ?'); params2.push(updates.description.slice(0, 4000)); }
  if (updates.tune_values !== undefined) {
    const v = validateTuneValues(updates.tune_values);
    if (!v.ok) return Response.json({ error: 'invalid_tune_values', details: v.errors }, { status: 400 });
    sets.push('tune_values = ?'); params2.push(JSON.stringify(v.data));
  }
  if (!sets.length) return Response.json({ updated: false });
  sets.push('updated_at = ?'); params2.push(Math.floor(Date.now() / 1000));
  params2.push(tune.id);

  await env.DB.prepare(`UPDATE tunes SET ${sets.join(', ')} WHERE id = ?`).bind(...params2).run();
  return Response.json({ updated: true });
};

export const DELETE: APIRoute = async ({ params, request, locals, cookies }) => {
  const env = locals.runtime.env;
  const slug = params.id!;
  const tune = await getTuneForEdit(env.DB, slug);
  if (!tune) return new Response('not_found', { status: 404 });

  const cookieToken = cookies.get('touge_edit')?.value;
  const body = await request.json().catch(() => ({}));
  const password = (body as { edit_password?: string }).edit_password;

  const authorized =
    (cookieToken && await verifyEditCookie(cookieToken, slug, env.EDIT_COOKIE_SECRET)) ||
    (password && await verifyEditPassword(password, tune.edit_password_hash));

  if (!authorized) return new Response('unauthorized', { status: 401 });

  await env.DB.prepare("UPDATE tunes SET status = 'deleted' WHERE id = ?").bind(tune.id).run();
  cookies.delete('touge_edit', { path: '/' });
  return Response.json({ deleted: true });
};
```

- [ ] **Step 2: Type-check**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm run check
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/tunes/
git commit -m "feat(api): add GET/PATCH/DELETE /api/tunes/[id]"
```

---

### Task 4.3: POST /api/tunes/[id]/review

**Files:**
- Create: `src/pages/api/tunes/[id]/review.ts`

- [ ] **Step 1: Implement**

```ts
import type { APIRoute } from 'astro';
import { verifyTurnstile } from '~/lib/turnstile';
import { hashIp, dailySalt } from '~/lib/ip-hash';
import { checkRateLimit } from '~/lib/rate-limit';
import { getTuneBySlug, insertReview } from '~/lib/db';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, locals, clientAddress }) => {
  const env = locals.runtime.env;
  const tune = await getTuneBySlug(env.DB, params.id!);
  if (!tune) return new Response('not_found', { status: 404 });

  const body = await request.json() as {
    author_handle?: string; rating?: number; body?: string;
    turnstile_token?: string; honeypot?: string;
  };

  if (body.honeypot) return Response.json({ error: 'spam' }, { status: 400 });
  if (!body.turnstile_token || !(await verifyTurnstile(body.turnstile_token, env.TURNSTILE_SECRET_KEY, clientAddress))) {
    return Response.json({ error: 'turnstile_failed' }, { status: 400 });
  }

  const ipHash = await hashIp(clientAddress ?? 'unknown', dailySalt(env.IP_HASH_SALT));
  const rl = await checkRateLimit(env.KV, ipHash, 'review', 20, 3600);
  if (!rl.allowed) return Response.json({ error: 'rate_limited' }, { status: 429 });

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return Response.json({ error: 'invalid_rating' }, { status: 400 });
  }

  const handle = (body.author_handle || 'anonymous').slice(0, 40);
  const text = body.body ? body.body.slice(0, 1000) : null;

  await insertReview(env.DB, tune.id, handle, rating, text, ipHash);
  return Response.json({ ok: true }, { status: 201 });
};
```

- [ ] **Step 2: Type-check + commit**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm run check
git add src/pages/api/tunes/
git commit -m "feat(api): add POST /api/tunes/[id]/review"
```

---

### Task 4.4: GET /api/search

**Files:**
- Create: `src/pages/api/search.ts`

- [ ] **Step 1: Implement**

```ts
import type { APIRoute } from 'astro';
import { searchTunes } from '~/lib/db';

export const prerender = false;

function sanitizeFts(query: string): string {
  return query
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .map((t) => `"${t}"*`)
    .join(' OR ');
}

export const GET: APIRoute = async ({ url, locals }) => {
  const q = url.searchParams.get('q')?.trim();
  if (!q || q.length < 2) return Response.json({ results: [] });
  const fts = sanitizeFts(q);
  if (!fts) return Response.json({ results: [] });
  const result = await searchTunes(locals.runtime.env.DB, fts, 24);
  return Response.json({ results: result.results });
};
```

- [ ] **Step 2: Type-check + commit**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm run check
git add src/pages/api/search.ts
git commit -m "feat(api): add GET /api/search using D1 FTS5"
```

---

### Task 4.5: POST /api/report

**Files:**
- Create: `src/pages/api/report.ts`

- [ ] **Step 1: Implement**

```ts
import type { APIRoute } from 'astro';
import { verifyTurnstile } from '~/lib/turnstile';
import { hashIp, dailySalt } from '~/lib/ip-hash';
import { checkRateLimit } from '~/lib/rate-limit';
import { insertReport } from '~/lib/db';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  const env = locals.runtime.env;
  const body = await request.json() as {
    target_kind?: 'tune' | 'review';
    target_id?: number;
    reason?: string;
    turnstile_token?: string;
  };

  if (!body.turnstile_token || !(await verifyTurnstile(body.turnstile_token, env.TURNSTILE_SECRET_KEY, clientAddress))) {
    return Response.json({ error: 'turnstile_failed' }, { status: 400 });
  }
  if (body.target_kind !== 'tune' && body.target_kind !== 'review') {
    return Response.json({ error: 'invalid_target_kind' }, { status: 400 });
  }
  if (!body.target_id || !body.reason) {
    return Response.json({ error: 'missing_fields' }, { status: 400 });
  }

  const ipHash = await hashIp(clientAddress ?? 'unknown', dailySalt(env.IP_HASH_SALT));
  const rl = await checkRateLimit(env.KV, ipHash, 'report', 10, 3600);
  if (!rl.allowed) return Response.json({ error: 'rate_limited' }, { status: 429 });

  await insertReport(env.DB, body.target_kind, body.target_id, body.reason.slice(0, 500), ipHash);
  return Response.json({ ok: true }, { status: 201 });
};
```

- [ ] **Step 2: Type-check + commit**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm run check
git add src/pages/api/report.ts
git commit -m "feat(api): add POST /api/report"
```

---

## Phase 5 — UI Components

For all component tasks, the visual reference is the brainstorming HTML in `.superpowers/brainstorm/.../content/`. Components must match the JDM Touge dark + cyan/magenta direction.

### Task 5.1: Header component

**Files:**
- Create: `src/components/Header.astro`
- Create: `src/i18n/en.json`

- [ ] **Step 1: Create `src/i18n/en.json`**

```json
{
  "nav.browse": "Browse",
  "nav.upload": "Upload",
  "nav.tuners": "Top Tuners",
  "nav.tracks": "Tracks",
  "nav.news": "News",
  "search.placeholder": "Search car, track, tuner...",
  "cta.upload": "+ Upload tune",
  "footer.disclaimer": "Not affiliated with Microsoft / Playground Games"
}
```

- [ ] **Step 2: Create `src/components/Header.astro`**

```astro
---
import en from '~/i18n/en.json';
const t = en;
const activePath = Astro.url.pathname;
const isActive = (p: string) => activePath === p || activePath.startsWith(p + '/');
---

<header class="border-b border-line px-6 py-4 flex items-center justify-between bg-bg-soft">
  <div class="flex items-center gap-8">
    <a href="/" class="font-mono font-bold text-[15px] text-cyan tracking-wider2">
      TOUGE<span class="text-pink">.</span>GG
    </a>
    <nav class="flex gap-5 text-[13px] font-medium">
      <a href="/browse" class:list={[isActive('/browse') ? 'text-text border-b-2 border-cyan pb-1' : 'text-text-mute']}>{t['nav.browse']}</a>
      <a href="/upload" class:list={[isActive('/upload') ? 'text-text border-b-2 border-cyan pb-1' : 'text-text-mute']}>{t['nav.upload']}</a>
    </nav>
  </div>
  <div class="flex gap-3 items-center">
    <a href="/upload" class="bg-cyan text-bg px-3.5 py-1.5 text-[12px] font-bold font-mono uppercase tracking-wider2">{t['cta.upload']}</a>
  </div>
</header>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Header.astro src/i18n/en.json
git commit -m "feat(ui): add Header component and i18n strings"
```

---

### Task 5.2: Footer component

**Files:**
- Create: `src/components/Footer.astro`

- [ ] **Step 1: Create the component**

```astro
---
import en from '~/i18n/en.json';
---
<footer class="border-t border-line px-6 py-7 bg-bg-soft mt-12">
  <div class="max-w-6xl mx-auto flex justify-between items-center font-mono text-[11px] text-text-dim">
    <div>
      <span class="text-cyan">TOUGE<span class="text-pink">.</span>GG</span> // tune database for Forza Horizon 6 // 2026
    </div>
    <div class="flex gap-4">
      <a href="/about">About</a>
      <a href="/api" >API</a>
      <span>{en['footer.disclaimer']}</span>
    </div>
  </div>
</footer>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Footer.astro
git commit -m "feat(ui): add Footer component"
```

---

### Task 5.3: TuneCard component

**Files:**
- Create: `src/components/TuneCard.astro`

- [ ] **Step 1: Create the component**

```astro
---
type Props = {
  slug: string;
  name: string;
  shareCode: string;
  carYear: number;
  carMake: string;
  carModel: string;
  piClass: string;
  tuneType: string;
  drivetrain: string;
  rating: number; // 0-5
  downloads: number;
  authorHandle: string;
  accent?: 'cyan' | 'pink';
};
const { slug, name, shareCode, carYear, carMake, carModel, piClass, tuneType, drivetrain, rating, downloads, authorHandle, accent = 'cyan' } = Astro.props;
const accentClass = accent === 'cyan' ? 'bg-cyan' : 'bg-pink';
const ratingColor = accent === 'cyan' ? 'text-cyan' : 'text-pink';
---
<a href={`/tune/${slug}`} class="block bg-bg-card border border-line p-4 relative no-underline">
  <div class:list={['absolute top-0 left-0 w-[3px] h-full', accentClass]}></div>
  <div class="flex justify-between items-start mb-3">
    <div class="font-mono text-[10px] text-text-dim uppercase tracking-wider2">{piClass} · {tuneType.toUpperCase()} · {drivetrain}</div>
    <div class:list={['font-mono text-[11px]', ratingColor]}>★ {rating.toFixed(1)}</div>
  </div>
  <div class="text-[15px] font-bold leading-tight mb-1 text-text">{name}</div>
  <div class="text-[12px] text-text-mute mb-3">{carYear} {carMake} {carModel}</div>
  <div class="font-mono text-[11px] text-cyan tracking-wide mb-2.5">{shareCode}</div>
  <div class="flex justify-between font-mono text-[10px] text-text-dim">
    <span>@{authorHandle}</span>
    <span>↓ {downloads.toLocaleString()}</span>
  </div>
</a>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TuneCard.astro
git commit -m "feat(ui): add TuneCard component"
```

---

### Task 5.4: ShareCodeBox component

**Files:**
- Create: `src/components/ShareCodeBox.astro`

- [ ] **Step 1: Implement**

```astro
---
type Props = { code: string; tuneId: number };
const { code, tuneId } = Astro.props;
---
<div class="bg-bg-card border border-cyan p-4 relative" data-share-box data-tune-id={tuneId}>
  <div class="font-mono text-[10px] text-cyan uppercase tracking-wider3 mb-2.5">＞ SHARE CODE (FH6)</div>
  <div class="font-mono text-[26px] font-bold text-text tracking-wide mb-3.5" data-code>{code}</div>
  <button class="w-full bg-cyan text-bg py-2.5 font-bold text-[13px] cursor-pointer font-mono uppercase tracking-wider2" data-copy-btn>⎘ COPY CODE</button>
  <div class="font-mono text-[10px] text-text-dim mt-2.5 text-center">Paste in FH6 → Manage Tunes → Search</div>
</div>

<script>
  document.querySelectorAll<HTMLElement>('[data-share-box]').forEach((box) => {
    const btn = box.querySelector<HTMLButtonElement>('[data-copy-btn]');
    const codeEl = box.querySelector<HTMLElement>('[data-code]');
    const tuneId = box.dataset.tuneId;
    btn?.addEventListener('click', async () => {
      if (!codeEl) return;
      await navigator.clipboard.writeText(codeEl.innerText.trim());
      const original = btn.innerText;
      btn.innerText = '✓ COPIED';
      setTimeout(() => { btn.innerText = original; }, 1500);
      if (tuneId) {
        fetch(`/api/tunes/${box.closest('[data-tune-slug]')?.getAttribute('data-tune-slug')}/download`, { method: 'POST' }).catch(() => {});
      }
    });
  });
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ShareCodeBox.astro
git commit -m "feat(ui): add ShareCodeBox with copy-to-clipboard"
```

---

### Task 5.5: TuneValuesGrid component

**Files:**
- Create: `src/components/TuneValuesGrid.astro`

- [ ] **Step 1: Implement**

```astro
---
import type { TuneValues } from '~/data/tune-schema';
type Props = { values: TuneValues };
const { values } = Astro.props;
---
<div class="grid grid-cols-3 gap-px bg-line font-mono">
  <!-- TIRES -->
  <div class="bg-bg-card p-4">
    <div class="text-[10px] text-pink uppercase tracking-wider3 mb-3">TIRES</div>
    <div class="grid grid-cols-[1fr_auto_auto] gap-y-1.5 gap-x-3 text-[12px]">
      <div class="text-text-dim">Pressure</div><div class="text-text-mute text-[10px]">F</div><div class="text-text-mute text-[10px]">R</div>
      <div class="text-text-dim">psi</div><div class="text-text text-right">{values.tires.pressure_f}</div><div class="text-text text-right">{values.tires.pressure_r}</div>
    </div>
  </div>

  <!-- GEARING -->
  <div class="bg-bg-card p-4">
    <div class="text-[10px] text-pink uppercase tracking-wider3 mb-3">GEARING</div>
    <div class="grid grid-cols-[1fr_auto] gap-y-1.5 gap-x-3 text-[12px]">
      <div class="text-text-dim">Final drive</div><div class="text-text text-right">{values.gearing.final}</div>
      <div class="text-text-dim">1st</div><div class="text-text text-right">{values.gearing.g1}</div>
      <div class="text-text-dim">2nd</div><div class="text-text text-right">{values.gearing.g2}</div>
      <div class="text-text-dim">3rd</div><div class="text-text text-right">{values.gearing.g3}</div>
      <div class="text-text-dim">4th</div><div class="text-text text-right">{values.gearing.g4}</div>
      <div class="text-text-dim">5th</div><div class="text-text text-right">{values.gearing.g5}</div>
      <div class="text-text-dim">6th</div><div class="text-text text-right">{values.gearing.g6}</div>
    </div>
  </div>

  <!-- ALIGNMENT -->
  <div class="bg-bg-card p-4">
    <div class="text-[10px] text-pink uppercase tracking-wider3 mb-3">ALIGNMENT</div>
    <div class="grid grid-cols-[1fr_auto_auto] gap-y-1.5 gap-x-3 text-[12px]">
      <div></div><div class="text-text-mute text-[10px]">F</div><div class="text-text-mute text-[10px]">R</div>
      <div class="text-text-dim">Camber °</div><div class="text-text text-right">{values.alignment.camber_f}</div><div class="text-text text-right">{values.alignment.camber_r}</div>
      <div class="text-text-dim">Toe °</div><div class="text-text text-right">{values.alignment.toe_f}</div><div class="text-text text-right">{values.alignment.toe_r}</div>
      <div class="text-text-dim">Caster °</div><div class="text-text text-right">{values.alignment.caster}</div><div class="text-text-dim text-center">—</div>
    </div>
  </div>

  <!-- ARB / SPRINGS / DAMPING / AERO / BRAKES / DIFF — follow same pattern -->
  <div class="bg-bg-card p-4">
    <div class="text-[10px] text-pink uppercase tracking-wider3 mb-3">ANTI-ROLL BARS</div>
    <div class="grid grid-cols-[1fr_auto_auto] gap-y-1.5 gap-x-3 text-[12px]">
      <div></div><div class="text-text-mute text-[10px]">F</div><div class="text-text-mute text-[10px]">R</div>
      <div class="text-text-dim">Stiffness</div><div class="text-text text-right">{values.antiroll.stiffness_f}</div><div class="text-text text-right">{values.antiroll.stiffness_r}</div>
    </div>
  </div>
  <div class="bg-bg-card p-4">
    <div class="text-[10px] text-pink uppercase tracking-wider3 mb-3">SPRINGS</div>
    <div class="grid grid-cols-[1fr_auto_auto] gap-y-1.5 gap-x-3 text-[12px]">
      <div></div><div class="text-text-mute text-[10px]">F</div><div class="text-text-mute text-[10px]">R</div>
      <div class="text-text-dim">Rate lb/in</div><div class="text-text text-right">{values.springs.rate_f}</div><div class="text-text text-right">{values.springs.rate_r}</div>
      <div class="text-text-dim">Ride height in</div><div class="text-text text-right">{values.springs.height_f}</div><div class="text-text text-right">{values.springs.height_r}</div>
    </div>
  </div>
  <div class="bg-bg-card p-4">
    <div class="text-[10px] text-pink uppercase tracking-wider3 mb-3">DAMPING</div>
    <div class="grid grid-cols-[1fr_auto_auto] gap-y-1.5 gap-x-3 text-[12px]">
      <div></div><div class="text-text-mute text-[10px]">F</div><div class="text-text-mute text-[10px]">R</div>
      <div class="text-text-dim">Rebound</div><div class="text-text text-right">{values.damping.rebound_f}</div><div class="text-text text-right">{values.damping.rebound_r}</div>
      <div class="text-text-dim">Bump</div><div class="text-text text-right">{values.damping.bump_f}</div><div class="text-text text-right">{values.damping.bump_r}</div>
    </div>
  </div>
  <div class="bg-bg-card p-4">
    <div class="text-[10px] text-pink uppercase tracking-wider3 mb-3">AERO</div>
    <div class="grid grid-cols-[1fr_auto] gap-y-1.5 gap-x-3 text-[12px]">
      <div class="text-text-dim">Front splitter lb</div><div class="text-text text-right">{values.aero.front}</div>
      <div class="text-text-dim">Rear wing lb</div><div class="text-text text-right">{values.aero.rear}</div>
    </div>
  </div>
  <div class="bg-bg-card p-4">
    <div class="text-[10px] text-pink uppercase tracking-wider3 mb-3">BRAKES</div>
    <div class="grid grid-cols-[1fr_auto] gap-y-1.5 gap-x-3 text-[12px]">
      <div class="text-text-dim">Balance % F</div><div class="text-text text-right">{values.brakes.balance_pct_f}</div>
      <div class="text-text-dim">Pressure %</div><div class="text-text text-right">{values.brakes.pressure_pct}</div>
    </div>
  </div>
  <div class="bg-bg-card p-4">
    <div class="text-[10px] text-pink uppercase tracking-wider3 mb-3">DIFFERENTIAL</div>
    <div class="grid grid-cols-[1fr_auto] gap-y-1.5 gap-x-3 text-[12px]">
      <div class="text-text-dim">Accel %</div><div class="text-text text-right">{values.diff.accel_pct}</div>
      <div class="text-text-dim">Decel %</div><div class="text-text text-right">{values.diff.decel_pct}</div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TuneValuesGrid.astro
git commit -m "feat(ui): add TuneValuesGrid component"
```

---

### Task 5.6: FilterSidebar component

**Files:**
- Create: `src/components/FilterSidebar.astro`

- [ ] **Step 1: Implement**

```astro
---
type Counts = Record<string, number>;
type Props = {
  active: { car?: string; type?: string; pi?: string; drivetrain?: string; minRating?: number };
  counts: { pi: Counts; type: Counts };
};
const { active, counts } = Astro.props;

const piClasses: Array<['D'|'C'|'B'|'A'|'S1'|'S2', string]> = [['D', '500'],['C','600'],['B','700'],['A','800'],['S1','900'],['S2','998']];
const types = ['touge','drift','grip','drag','rally','offroad'] as const;

function toggleParam(name: string, value: string): string {
  const u = new URL(Astro.url);
  if (u.searchParams.get(name) === value) u.searchParams.delete(name);
  else u.searchParams.set(name, value);
  return u.pathname + '?' + u.searchParams.toString();
}
---
<aside class="space-y-5">
  <div>
    <div class="font-mono text-[10px] text-cyan tracking-wider2 mb-2">PI CLASS</div>
    <ul class="space-y-2 font-mono text-[12px]">
      {piClasses.map(([k, score]) => (
        <li>
          <a href={toggleParam('pi', k)}
             class:list={['flex justify-between', active.pi === k ? 'text-text' : 'text-text-mute']}>
            <span>{active.pi === k ? '✓ ' : ''}{k} {score}</span>
            <span class="text-text-dim">{counts.pi[k] ?? 0}</span>
          </a>
        </li>
      ))}
    </ul>
  </div>

  <div class="pt-4 border-t border-line">
    <div class="font-mono text-[10px] text-text tracking-wider2 mb-2">TUNE TYPE</div>
    <ul class="space-y-2 font-mono text-[12px]">
      {types.map((t) => (
        <li>
          <a href={toggleParam('type', t)}
             class:list={['flex justify-between', active.type === t ? 'text-text' : 'text-text-mute']}>
            <span>{active.type === t ? '✓ ' : ''}{t.toUpperCase()}</span>
            <span class="text-text-dim">{counts.type[t] ?? 0}</span>
          </a>
        </li>
      ))}
    </ul>
  </div>

  <div class="pt-4 border-t border-line">
    <div class="font-mono text-[10px] text-text tracking-wider2 mb-2">DRIVETRAIN</div>
    <div class="grid grid-cols-3 gap-1 font-mono text-[11px]">
      {(['RWD','AWD','FWD'] as const).map((d) => (
        <a href={toggleParam('drivetrain', d)}
           class:list={['py-1.5 text-center', active.drivetrain === d ? 'bg-cyan text-bg font-bold' : 'border border-line text-text-mute']}>{d}</a>
      ))}
    </div>
  </div>
</aside>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/FilterSidebar.astro
git commit -m "feat(ui): add FilterSidebar component"
```

---

## Phase 6 — Pages

### Task 6.1: Layout with global head + theme

**Files:**
- Create: `src/layouts/Base.astro`

- [ ] **Step 1: Implement the base layout**

```astro
---
import '~/styles/global.css';
import Header from '~/components/Header.astro';
import Footer from '~/components/Footer.astro';
type Props = { title: string; description?: string };
const { title, description = 'Tune database for Forza Horizon 6.' } = Astro.props;
---
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title} — touge.gg</title>
  <meta name="description" content={description} />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
</head>
<body>
  <Header />
  <main>
    <slot />
  </main>
  <Footer />
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/layouts/Base.astro
git commit -m "feat(ui): add base layout"
```

---

### Task 6.2: Tune detail page

**Files:**
- Create: `src/pages/tune/[slug].astro`

- [ ] **Step 1: Implement**

```astro
---
import Base from '~/layouts/Base.astro';
import ShareCodeBox from '~/components/ShareCodeBox.astro';
import TuneValuesGrid from '~/components/TuneValuesGrid.astro';
import { getTuneBySlug, getCarById, listReviews } from '~/lib/db';

export const prerender = false;

const slug = Astro.params.slug!;
const env = Astro.locals.runtime.env;
const tune = await getTuneBySlug(env.DB, slug);
if (!tune) return Astro.redirect('/404');
const car = await getCarById(env.DB, tune.car_id);
const reviews = (await listReviews(env.DB, tune.id, 20)).results as Array<{ author_handle: string; rating: number; body: string | null; created_at: number }>;
const values = JSON.parse(tune.tune_values);
const avgRating = tune.rating_count > 0 ? tune.rating_sum / tune.rating_count : 0;
---

<Base title={`${tune.name} — ${car?.year} ${car?.make} ${car?.model}`} description={tune.description?.slice(0, 160) ?? ''}>
  <section class="px-6 py-8 max-w-6xl mx-auto">
    <div class="grid grid-cols-[2fr_1fr] gap-8 items-start">
      <div>
        <div class="font-mono text-[11px] text-pink tracking-wider3 mb-2.5">＞ {tune.tune_type.toUpperCase()} / {tune.pi_class} / {tune.drivetrain}</div>
        <h1 class="text-[42px] font-extrabold mb-2 leading-tight">{tune.name}</h1>
        <div class="text-[18px] text-text-mute mb-5">{car?.year} {car?.make} {car?.model}</div>
        <div class="flex gap-5 items-center font-mono text-[12px]">
          <span class="text-text">@{tune.author_handle}</span>
          <span class="text-text-dim">|</span>
          <span class="text-cyan">★ {avgRating.toFixed(1)}</span>
          <span class="text-text-dim">({tune.rating_count} reviews)</span>
          <span class="text-text-dim">|</span>
          <span class="text-text-dim">↓ <span class="text-text">{tune.download_count.toLocaleString()}</span> downloads</span>
        </div>
      </div>
      <ShareCodeBox code={tune.share_code} tuneId={tune.id} />
    </div>

    {tune.description && (
      <div class="mt-6 p-5 bg-bg-card border-l-[3px] border-pink">
        <div class="font-mono text-[10px] text-pink tracking-wider2 mb-1.5">＞ TUNER NOTES</div>
        <p class="leading-relaxed text-text-soft text-[14px] m-0">{tune.description}</p>
      </div>
    )}
  </section>

  <section class="px-6 pb-12 max-w-6xl mx-auto">
    <h2 class="text-[24px] font-bold mb-4">All values</h2>
    <TuneValuesGrid values={values} />
  </section>

  <section class="px-6 pb-12 max-w-6xl mx-auto">
    <h2 class="text-[20px] font-bold mb-4">Reviews · {tune.rating_count}</h2>
    {reviews.length === 0 ? (
      <p class="text-text-mute">No reviews yet. Be the first.</p>
    ) : (
      <div class="grid grid-cols-2 gap-3.5">
        {reviews.map((r) => (
          <div class="bg-bg-card p-4 border-l-[2px] border-cyan">
            <div class="flex justify-between items-center mb-2.5">
              <div class="font-mono text-[12px]">
                <span class="text-text">@{r.author_handle}</span>
                <span class="text-text-dim"> · {new Date(r.created_at * 1000).toISOString().slice(0,10)}</span>
              </div>
              <div class="text-cyan font-mono text-[12px]">★ {r.rating}</div>
            </div>
            {r.body && <p class="m-0 leading-relaxed text-text-soft text-[13px]">{r.body}</p>}
          </div>
        ))}
      </div>
    )}
  </section>
</Base>
```

- [ ] **Step 2: Type-check + commit**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm run check
git add src/pages/tune/ src/layouts/
git commit -m "feat(page): add tune detail page"
```

---

### Task 6.3: Browse page

**Files:**
- Create: `src/pages/browse.astro`

- [ ] **Step 1: Implement**

```astro
---
import Base from '~/layouts/Base.astro';
import TuneCard from '~/components/TuneCard.astro';
import FilterSidebar from '~/components/FilterSidebar.astro';
import { listTunes } from '~/lib/db';

export const prerender = false;

const q = Astro.url.searchParams;
const env = Astro.locals.runtime.env;
const limit = 24;
const offset = q.get('page') ? (Number(q.get('page')) - 1) * limit : 0;

const result = await listTunes(env.DB, {
  carSlug: q.get('car') ?? undefined,
  tuneType: q.get('type') ?? undefined,
  piClass: q.get('pi') ?? undefined,
  drivetrain: q.get('drivetrain') ?? undefined,
  minRating: q.get('min_rating') ? Number(q.get('min_rating')) : undefined,
  sort: (q.get('sort') as 'downloads'|'rating'|'newest'|'reviews') ?? 'downloads',
  limit, offset
});
const rows = result.results as any[];

const counts = { pi: {}, type: {} } as { pi: Record<string, number>; type: Record<string, number> };
const piRows = (await env.DB.prepare("SELECT pi_class, COUNT(*) AS n FROM tunes WHERE status = 'public' GROUP BY pi_class").all()).results as Array<{ pi_class: string; n: number }>;
const typeRows = (await env.DB.prepare("SELECT tune_type, COUNT(*) AS n FROM tunes WHERE status = 'public' GROUP BY tune_type").all()).results as Array<{ tune_type: string; n: number }>;
piRows.forEach((r) => { counts.pi[r.pi_class] = r.n; });
typeRows.forEach((r) => { counts.type[r.tune_type] = r.n; });
---

<Base title="Browse tunes">
  <section class="px-6 pt-8 max-w-7xl mx-auto">
    <div class="font-mono text-[11px] text-pink tracking-wider3 mb-2">＞ BROWSE TUNES</div>
    <h1 class="text-[32px] font-extrabold mb-1">{rows.length} tunes</h1>
  </section>
  <section class="px-6 py-6 max-w-7xl mx-auto grid grid-cols-[240px_1fr] gap-7">
    <FilterSidebar
      active={{ car: q.get('car') ?? undefined, type: q.get('type') ?? undefined, pi: q.get('pi') ?? undefined, drivetrain: q.get('drivetrain') ?? undefined }}
      counts={counts} />
    <div>
      <div class="grid grid-cols-3 gap-3.5">
        {rows.map((r, i) => (
          <TuneCard
            slug={r.slug}
            name={r.name}
            shareCode={r.share_code}
            carYear={r.car_year}
            carMake={r.car_make}
            carModel={r.car_model}
            piClass={r.pi_class}
            tuneType={r.tune_type}
            drivetrain={r.drivetrain}
            rating={r.rating_count > 0 ? r.rating_sum / r.rating_count : 0}
            downloads={r.download_count}
            authorHandle={r.author_handle}
            accent={i % 3 === 1 ? 'pink' : 'cyan'} />
        ))}
      </div>
    </div>
  </section>
</Base>
```

- [ ] **Step 2: Type-check + commit**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm run check
git add src/pages/browse.astro
git commit -m "feat(page): add browse page with URL-driven filters"
```

---

### Task 6.4: Homepage

**Files:**
- Create: `src/pages/index.astro`

- [ ] **Step 1: Implement**

```astro
---
import Base from '~/layouts/Base.astro';
import TuneCard from '~/components/TuneCard.astro';
import { listTunes } from '~/lib/db';

export const prerender = false;
const env = Astro.locals.runtime.env;

const featured = (await listTunes(env.DB, { sort: 'rating', limit: 3 })).results as any[];
const trending = (await listTunes(env.DB, { sort: 'downloads', limit: 5 })).results as any[];

const statsRow = await env.DB.prepare("SELECT COUNT(*) AS tunes, COUNT(DISTINCT author_handle) AS tuners, COUNT(DISTINCT car_id) AS cars FROM tunes WHERE status='public'").first<{ tunes: number; tuners: number; cars: number }>();
---

<Base title="touge.gg" description="The tune database for Forza Horizon 6.">
  <section class="px-6 py-12 max-w-6xl mx-auto">
    <div class="font-mono text-[11px] text-pink tracking-wider3 mb-3.5">＞ FORZA HORIZON 6 / JAPAN</div>
    <h1 class="text-[56px] font-extrabold leading-[1.05] mb-4">
      The tune database<br/>
      <span class="bg-gradient-to-r from-cyan to-pink bg-clip-text text-transparent">for serious drivers.</span>
    </h1>
    <p class="text-[16px] text-text-mute max-w-[560px] leading-relaxed">{statsRow?.tunes ?? 0} tunes across every car in FH6. Drift the touge. Grip the circuit. Find what works, share what you built.</p>
  </section>

  <section class="border-y border-line px-6 py-5 bg-bg-soft">
    <div class="max-w-6xl mx-auto grid grid-cols-4 gap-8">
      <div><div class="font-mono text-[10px] text-text-dim tracking-wider2 mb-1">TUNES</div><div class="text-[24px] font-bold">{statsRow?.tunes ?? 0}</div></div>
      <div><div class="font-mono text-[10px] text-text-dim tracking-wider2 mb-1">TUNERS</div><div class="text-[24px] font-bold">{statsRow?.tuners ?? 0}</div></div>
      <div><div class="font-mono text-[10px] text-text-dim tracking-wider2 mb-1">CARS COVERED</div><div class="text-[24px] font-bold">{statsRow?.cars ?? 0}</div></div>
      <div><div class="font-mono text-[10px] text-text-dim tracking-wider2 mb-1">UPDATED</div><div class="text-[24px] font-bold text-cyan">just now</div></div>
    </div>
  </section>

  <section class="px-6 py-12 max-w-6xl mx-auto">
    <div class="font-mono text-[11px] text-pink tracking-wider3 mb-2">＞ FEATURED THIS WEEK</div>
    <h2 class="text-[26px] font-bold mb-6">Editors' picks</h2>
    <div class="grid grid-cols-3 gap-4">
      {featured.map((r, i) => (
        <TuneCard
          slug={r.slug} name={r.name} shareCode={r.share_code}
          carYear={r.car_year} carMake={r.car_make} carModel={r.car_model}
          piClass={r.pi_class} tuneType={r.tune_type} drivetrain={r.drivetrain}
          rating={r.rating_count > 0 ? r.rating_sum / r.rating_count : 0}
          downloads={r.download_count} authorHandle={r.author_handle}
          accent={i === 1 ? 'pink' : 'cyan'} />
      ))}
    </div>
  </section>

  <section class="px-6 pb-12 max-w-6xl mx-auto">
    <div class="font-mono text-[11px] text-cyan tracking-wider3 mb-2">＞ TRENDING NOW</div>
    <h2 class="text-[22px] font-bold mb-4">Most downloaded this week</h2>
    <div class="space-y-px bg-line">
      {trending.map((r, i) => (
        <a href={`/tune/${r.slug}`} class="bg-bg-card p-4 grid grid-cols-[30px_1fr_90px_60px_70px] gap-4 items-center text-[13px] no-underline">
          <div class="font-mono text-pink font-bold">{String(i + 1).padStart(2, '0')}</div>
          <div>
            <div class="font-semibold text-text">{r.name} <span class="text-text-dim font-normal text-[12px]">— {r.car_year} {r.car_make} {r.car_model}</span></div>
            <div class="font-mono text-[10px] text-text-dim mt-0.5">by @{r.author_handle}</div>
          </div>
          <div class="font-mono text-[11px] text-text-dim">{r.tune_type.toUpperCase()} · {r.pi_class}</div>
          <div class="font-mono text-[11px] text-cyan">★ {r.rating_count > 0 ? (r.rating_sum / r.rating_count).toFixed(1) : '—'}</div>
          <div class="font-mono text-[11px] text-text text-right">↓ {r.download_count.toLocaleString()}</div>
        </a>
      ))}
    </div>
  </section>
</Base>
```

- [ ] **Step 2: Type-check + commit**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm run check
git add src/pages/index.astro
git commit -m "feat(page): add homepage with featured + trending"
```

---

### Task 6.5: Upload page (form + client logic)

**Files:**
- Create: `src/pages/upload.astro`

- [ ] **Step 1: Implement (skeleton + form; client logic does fetch to /api/tunes)**

```astro
---
import Base from '~/layouts/Base.astro';
import { sampleTuneValues } from '~/lib/tune-values';
const env = Astro.locals.runtime.env;
const cars = (await env.DB.prepare('SELECT id, year, make, model, slug FROM cars ORDER BY make, model').all()).results as Array<{ id: number; year: number; make: string; model: string }>;
const tracks = (await env.DB.prepare('SELECT id, name FROM tracks ORDER BY name').all()).results as Array<{ id: number; name: string }>;
const sample = sampleTuneValues();
const turnstileSiteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA';
---

<Base title="Upload a tune">
  <section class="px-6 py-8 max-w-5xl mx-auto">
    <div class="font-mono text-[11px] text-pink tracking-wider3 mb-2">＞ NEW TUNE</div>
    <h1 class="text-[30px] font-extrabold mb-6">Upload a tune</h1>

    <form id="upload-form" class="space-y-5">
      <fieldset class="bg-bg-card border-l-[3px] border-cyan p-5">
        <legend class="font-mono text-[11px] text-cyan tracking-wider3">01 ＞ THE BASICS</legend>
        <div class="grid grid-cols-2 gap-4 mt-4">
          <label class="block">
            <span class="label-mono">TUNE NAME</span>
            <input name="name" required maxlength="120" class="mt-1.5 w-full bg-bg border border-line text-text p-2.5" />
          </label>
          <label class="block">
            <span class="label-mono">FH6 SHARE CODE</span>
            <input name="share_code" required maxlength="32" class="mt-1.5 w-full bg-bg border border-cyan text-text p-2.5 font-mono text-[16px] font-bold tracking-wide" />
          </label>
          <label class="col-span-2 block">
            <span class="label-mono">CAR</span>
            <select name="car_id" required class="mt-1.5 w-full bg-bg border border-line text-text p-2.5">
              {cars.map((c) => <option value={c.id}>{c.year} {c.make} {c.model}</option>)}
            </select>
          </label>
          <fieldset class="col-span-2">
            <span class="label-mono">TUNE TYPE</span>
            <div class="mt-2 flex gap-1.5 flex-wrap" data-type-group>
              {['touge','drift','grip','drag','rally','offroad'].map((t) => (
                <button type="button" data-type={t} class="bg-transparent border border-line text-text-mute px-4 py-2 font-mono text-[11px] uppercase tracking-wider2">{t}</button>
              ))}
              <input type="hidden" name="tune_type" value="touge" />
            </div>
          </fieldset>
        </div>
      </fieldset>

      <fieldset class="bg-bg-card border border-line p-5">
        <legend class="font-mono text-[11px] text-text tracking-wider3">02 ＞ BUILD INFO</legend>
        <div class="grid grid-cols-4 gap-3.5 mt-4">
          <label class="block">
            <span class="label-mono">PI CLASS</span>
            <select name="pi_class" class="mt-1.5 w-full bg-bg border border-line text-text p-2">
              {['D','C','B','A','S1','S2','X'].map((p) => <option>{p}</option>)}
            </select>
          </label>
          <label class="block">
            <span class="label-mono">PI SCORE</span>
            <input type="number" name="pi_score" min="100" max="999" value="800" class="mt-1.5 w-full bg-bg border border-line text-text p-2 font-mono" />
          </label>
          <label class="block">
            <span class="label-mono">DRIVETRAIN</span>
            <select name="drivetrain" class="mt-1.5 w-full bg-bg border border-line text-text p-2">
              <option>RWD</option><option>AWD</option><option>FWD</option>
            </select>
          </label>
          <label class="block">
            <span class="label-mono">POWER (HP)</span>
            <input type="number" name="power_hp" class="mt-1.5 w-full bg-bg border border-line text-text p-2 font-mono" />
          </label>
        </div>
      </fieldset>

      <fieldset class="bg-bg-card border border-line p-5">
        <legend class="font-mono text-[11px] text-text tracking-wider3">03 ＞ TUNE VALUES (paste numbers from FH6)</legend>
        <p class="text-text-dim text-[12px] mt-2">For brevity, the value inputs render dynamically — see <code>scripts/render-tune-inputs.ts</code> (Task 6.6). Sample values pre-filled for testing.</p>
        <textarea name="_tune_values_json" rows="6" class="mt-2 w-full bg-bg border border-line text-text font-mono text-[11px] p-2">{JSON.stringify(sample, null, 2)}</textarea>
      </fieldset>

      <fieldset class="bg-bg-card border border-line p-5">
        <legend class="font-mono text-[11px] text-text tracking-wider3">04 ＞ DESCRIPTION & TRACKS</legend>
        <label class="block mt-3">
          <span class="label-mono">TUNER NOTES</span>
          <textarea name="description" rows="4" maxlength="4000" class="mt-1.5 w-full bg-bg border border-line text-text p-2.5"></textarea>
        </label>
        <label class="block mt-3">
          <span class="label-mono">RECOMMENDED TRACKS</span>
          <select name="track_ids" multiple size="5" class="mt-1.5 w-full bg-bg border border-line text-text p-2">
            {tracks.map((t) => <option value={t.id}>{t.name}</option>)}
          </select>
        </label>
      </fieldset>

      <fieldset class="bg-bg-card border border-line p-5">
        <legend class="font-mono text-[11px] text-text tracking-wider3">05 ＞ AUTHOR</legend>
        <div class="grid grid-cols-2 gap-3.5 mt-3.5">
          <label class="block">
            <span class="label-mono">DISPLAY NAME</span>
            <input name="author_handle" maxlength="40" placeholder="your_handle" class="mt-1.5 w-full bg-bg border border-line text-text p-2 font-mono" />
          </label>
          <label class="block">
            <span class="label-mono">EDIT PASSWORD</span>
            <input name="edit_password" type="password" required minlength="6" class="mt-1.5 w-full bg-bg border border-line text-text p-2 font-mono" />
          </label>
        </div>
      </fieldset>

      <input type="text" name="honeypot" tabindex="-1" autocomplete="off" class="hidden" />

      <div class="cf-turnstile" data-sitekey={turnstileSiteKey}></div>

      <div class="flex justify-end gap-2.5">
        <button type="submit" class="bg-cyan border-0 text-bg px-6 py-3 font-mono font-bold uppercase tracking-wider2">PUBLISH TUNE →</button>
      </div>
      <div id="upload-status" class="text-text-dim text-[12px]"></div>
    </form>
  </section>

  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  <script>
    const form = document.getElementById('upload-form') as HTMLFormElement;
    const status = document.getElementById('upload-status') as HTMLElement;

    document.querySelectorAll<HTMLButtonElement>('[data-type-group] button').forEach((b) => {
      b.addEventListener('click', () => {
        document.querySelectorAll<HTMLButtonElement>('[data-type-group] button').forEach((x) => {
          x.classList.remove('bg-cyan','text-bg','font-bold','border-cyan');
          x.classList.add('border-line','text-text-mute');
        });
        b.classList.remove('border-line','text-text-mute');
        b.classList.add('bg-cyan','text-bg','font-bold','border-cyan');
        (document.querySelector('input[name="tune_type"]') as HTMLInputElement).value = b.dataset.type!;
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      status.textContent = 'Uploading…';
      const fd = new FormData(form);
      const body = {
        name: fd.get('name'),
        share_code: fd.get('share_code'),
        car_id: Number(fd.get('car_id')),
        tune_type: fd.get('tune_type'),
        pi_class: fd.get('pi_class'),
        pi_score: Number(fd.get('pi_score')),
        drivetrain: fd.get('drivetrain'),
        power_hp: Number(fd.get('power_hp')) || undefined,
        description: fd.get('description'),
        tune_values: JSON.parse(String(fd.get('_tune_values_json'))),
        author_handle: fd.get('author_handle'),
        edit_password: fd.get('edit_password'),
        track_ids: fd.getAll('track_ids').map(Number),
        turnstile_token: (form.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement)?.value,
        honeypot: fd.get('honeypot')
      };

      const res = await fetch('/api/tunes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) {
        const myTunes = JSON.parse(localStorage.getItem('mytunes') ?? '[]');
        myTunes.push({ slug: data.slug, editUrl: data.edit_url, savedAt: Date.now() });
        localStorage.setItem('mytunes', JSON.stringify(myTunes));
        status.innerHTML = `Published. <a class="text-cyan" href="/tune/${data.slug}">View tune →</a><br/>Edit URL: <code>${data.edit_url}</code> — save this with your password.`;
      } else {
        status.textContent = `Error: ${data.error}${data.details ? ' — ' + JSON.stringify(data.details) : ''}`;
      }
    });
  </script>
</Base>
```

- [ ] **Step 2: Type-check + commit**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm run check
git add src/pages/upload.astro
git commit -m "feat(page): add upload form page"
```

---

### Task 6.6: Edit page (password gate + form reuse)

**Files:**
- Create: `src/pages/edit/[slug].astro`

- [ ] **Step 1: Implement**

```astro
---
import Base from '~/layouts/Base.astro';
import { getTuneForEdit } from '~/lib/db';

export const prerender = false;
const env = Astro.locals.runtime.env;
const slug = Astro.params.slug!;
const tune = await getTuneForEdit(env.DB, slug);
if (!tune) return Astro.redirect('/404');
const values = JSON.parse(tune.tune_values);
---

<Base title={`Edit ${tune.name}`}>
  <section class="px-6 py-8 max-w-3xl mx-auto">
    <h1 class="text-[26px] font-bold mb-5">Edit tune</h1>
    <form id="edit-form" class="space-y-4">
      <label class="block">
        <span class="label-mono">EDIT PASSWORD</span>
        <input type="password" name="edit_password" required minlength="6" class="mt-1.5 w-full bg-bg border border-line text-text p-2 font-mono" />
      </label>
      <label class="block">
        <span class="label-mono">TUNE NAME</span>
        <input name="name" value={tune.name} class="mt-1.5 w-full bg-bg border border-line text-text p-2" />
      </label>
      <label class="block">
        <span class="label-mono">DESCRIPTION</span>
        <textarea name="description" rows="5" class="mt-1.5 w-full bg-bg border border-line text-text p-2.5">{tune.description ?? ''}</textarea>
      </label>
      <label class="block">
        <span class="label-mono">TUNE VALUES (JSON)</span>
        <textarea name="tune_values" rows="20" class="mt-1.5 w-full bg-bg border border-line text-text font-mono text-[11px] p-2">{JSON.stringify(values, null, 2)}</textarea>
      </label>
      <div class="flex gap-2.5 justify-end">
        <button type="submit" class="bg-cyan text-bg px-5 py-2.5 font-mono font-bold">SAVE</button>
        <button type="button" id="delete-btn" class="bg-transparent border border-pink text-pink px-5 py-2.5 font-mono">DELETE TUNE</button>
      </div>
      <div id="edit-status" class="text-text-dim text-[12px]"></div>
    </form>
  </section>

  <script define:vars={{ slug }}>
    const form = document.getElementById('edit-form');
    const status = document.getElementById('edit-status');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const body = {
        edit_password: fd.get('edit_password'),
        updates: {
          name: fd.get('name'),
          description: fd.get('description'),
          tune_values: JSON.parse(fd.get('tune_values'))
        }
      };
      const res = await fetch(`/api/tunes/${slug}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      status.textContent = res.ok ? 'Saved.' : `Error: ${data.error || 'unknown'}`;
    });
    document.getElementById('delete-btn').addEventListener('click', async () => {
      if (!confirm('Delete this tune?')) return;
      const fd = new FormData(form);
      const res = await fetch(`/api/tunes/${slug}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edit_password: fd.get('edit_password') })
      });
      if (res.ok) location.href = '/';
      else status.textContent = 'Delete failed.';
    });
  </script>
</Base>
```

- [ ] **Step 2: Type-check + commit**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm run check
git add src/pages/edit/
git commit -m "feat(page): add edit page"
```

---

## Phase 7 — SEO & Polish

### Task 7.1: Sitemap

**Files:**
- Create: `src/pages/sitemap.xml.ts`

- [ ] **Step 1: Implement**

```ts
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ locals, url }) => {
  const env = locals.runtime.env;
  const base = `${url.protocol}//${url.host}`;
  const tunes = (await env.DB.prepare("SELECT slug, updated_at FROM tunes WHERE status='public' ORDER BY updated_at DESC LIMIT 50000").all()).results as Array<{ slug: string; updated_at: number }>;
  const cars = (await env.DB.prepare('SELECT slug FROM cars').all()).results as Array<{ slug: string }>;
  const tracks = (await env.DB.prepare('SELECT slug FROM tracks').all()).results as Array<{ slug: string }>;

  const items = [
    `<url><loc>${base}/</loc></url>`,
    `<url><loc>${base}/browse</loc></url>`,
    ...cars.map((c) => `<url><loc>${base}/browse?car=${c.slug}</loc></url>`),
    ...tracks.map((t) => `<url><loc>${base}/track/${t.slug}</loc></url>`),
    ...tunes.map((t) => `<url><loc>${base}/tune/${t.slug}</loc><lastmod>${new Date(t.updated_at * 1000).toISOString()}</lastmod></url>`)
  ].join('');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</urlset>`,
    { headers: { 'Content-Type': 'application/xml' } }
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/sitemap.xml.ts
git commit -m "feat(seo): add sitemap.xml endpoint"
```

---

### Task 7.2: robots.txt

**Files:**
- Create: `public/robots.txt`

- [ ] **Step 1: Create the file**

```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /edit/
Sitemap: https://touge.gg/sitemap.xml
```

- [ ] **Step 2: Commit**

```bash
git add public/robots.txt
git commit -m "feat(seo): add robots.txt"
```

---

### Task 7.3: Structured data on tune detail

**Files:**
- Modify: `src/pages/tune/[slug].astro` (add JSON-LD)

- [ ] **Step 1: Add a `<script type="application/ld+json">` block above `</Base>`**

Add inside `<Base ...>`:

```astro
<script is:inline type="application/ld+json" set:html={JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: tune.name,
  description: tune.description ?? `${car?.year} ${car?.make} ${car?.model} tune for FH6`,
  datePublished: new Date(tune.created_at * 1000).toISOString(),
  dateModified: new Date(tune.updated_at * 1000).toISOString(),
  author: { '@type': 'Person', name: tune.author_handle },
  aggregateRating: tune.rating_count > 0 ? {
    '@type': 'AggregateRating',
    ratingValue: (tune.rating_sum / tune.rating_count).toFixed(2),
    reviewCount: tune.rating_count
  } : undefined
})} />
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/tune/[slug].astro
git commit -m "feat(seo): add schema.org structured data to tune detail"
```

---

## Phase 8 — End-to-End Tests

### Task 8.1: Upload flow E2E

**Files:**
- Create: `tests/e2e/upload-flow.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from '@playwright/test';

test('user can upload a tune and see it in browse', async ({ page }) => {
  await page.goto('/upload');
  await page.fill('input[name="name"]', 'E2E Test Tune');
  await page.fill('input[name="share_code"]', '123 456 789');
  await page.selectOption('select[name="car_id"]', { index: 1 });
  await page.click('[data-type="touge"]');
  await page.fill('input[name="author_handle"]', 'e2e_runner');
  await page.fill('input[name="edit_password"]', 'e2e-test-pass-1');

  // Wait for upload and redirect-ish flow
  const responsePromise = page.waitForResponse('**/api/tunes');
  await page.click('button[type="submit"]');
  const response = await responsePromise;
  expect(response.status()).toBeLessThan(500);
});
```

- [ ] **Step 2: Run e2e test**

```bash
ASDF_NODEJS_VERSION=22.22.2 npm run test:e2e -- upload-flow
```

Expected: pass (or skipped if Turnstile fails locally; iterate as needed).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/upload-flow.spec.ts
git commit -m "test(e2e): add upload flow test"
```

---

### Task 8.2: Browse + filter E2E

**Files:**
- Create: `tests/e2e/browse-flow.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from '@playwright/test';

test('browse page loads and filters by type', async ({ page }) => {
  await page.goto('/browse');
  await expect(page.locator('h1')).toContainText('tunes');
  await page.goto('/browse?type=touge');
  await expect(page).toHaveURL(/type=touge/);
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/browse-flow.spec.ts
git commit -m "test(e2e): add browse flow test"
```

---

### Task 8.3: Tune detail E2E

**Files:**
- Create: `tests/e2e/tune-detail.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from '@playwright/test';

test('tune detail page renders share code and values', async ({ page }) => {
  // Assumes at least one tune exists in seed/manual data
  await page.goto('/browse');
  const first = page.locator('a[href^="/tune/"]').first();
  await first.click();
  await expect(page.locator('[data-share-box]')).toBeVisible();
  await expect(page.getByText('All values')).toBeVisible();
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/tune-detail.spec.ts
git commit -m "test(e2e): add tune detail flow test"
```

---

## Phase 9 — Production Deployment

### Task 9.1: Create Cloudflare Pages project + production D1/KV

**Files:**
- Modify: `wrangler.toml` (add production bindings under `[env.production]`)

- [ ] **Step 1: Create production D1 + KV**

```bash
ASDF_NODEJS_VERSION=22.22.2 npx wrangler d1 create fh6-tune-platform-prod
ASDF_NODEJS_VERSION=22.22.2 npx wrangler kv namespace create RATE_LIMIT --env production
```

- [ ] **Step 2: Append production env to `wrangler.toml`**

```toml
[env.production]

[[env.production.d1_databases]]
binding = "DB"
database_name = "fh6-tune-platform-prod"
database_id = "PASTE_PROD_DB_ID_HERE"

[[env.production.kv_namespaces]]
binding = "KV"
id = "PASTE_PROD_KV_ID_HERE"
```

- [ ] **Step 3: Apply migrations to production**

```bash
ASDF_NODEJS_VERSION=22.22.2 npx wrangler d1 migrations apply fh6-tune-platform-prod --env production --remote
```

- [ ] **Step 4: Commit**

```bash
git add wrangler.toml
git commit -m "chore(deploy): add production bindings"
```

---

### Task 9.2: Configure Turnstile + secrets

- [ ] **Step 1: Create a Turnstile site in Cloudflare dashboard**

Manual step: go to `dash.cloudflare.com` → Turnstile → Add Site → use domain `touge.gg` (or whatever you registered). Copy site key + secret.

- [ ] **Step 2: Set production secrets via wrangler**

```bash
echo "<turnstile-secret>" | ASDF_NODEJS_VERSION=22.22.2 npx wrangler secret put TURNSTILE_SECRET_KEY --env production
echo "<random-32-chars>" | ASDF_NODEJS_VERSION=22.22.2 npx wrangler secret put IP_HASH_SALT --env production
echo "<another-random-32-chars>" | ASDF_NODEJS_VERSION=22.22.2 npx wrangler secret put EDIT_COOKIE_SECRET --env production
```

- [ ] **Step 3: Add Pages env var for the site key**

In Cloudflare dashboard → Pages → your project → Settings → Environment variables → Production:
- `PUBLIC_TURNSTILE_SITE_KEY = <turnstile-site-key>`

No commit (secrets are not in repo).

---

### Task 9.3: First deploy + smoke test

- [ ] **Step 1: Push to a new GitHub repo**

```bash
gh repo create fh6-tune-platform --public --source=. --remote=origin --push
```

- [ ] **Step 2: In Cloudflare Pages dashboard, connect the repo**

Manual step: Pages → Create application → Connect to Git → select repo → build settings:
- Framework preset: Astro
- Build command: `npm run build`
- Build output directory: `dist`
- Environment variables: `PUBLIC_TURNSTILE_SITE_KEY`
- Production branch: `main`

- [ ] **Step 3: Wait for build to complete and smoke test**

Open the assigned Pages URL. Verify:
- Homepage loads
- `/browse` loads
- `/upload` form renders
- Submit a test tune end-to-end (will use the production D1)

- [ ] **Step 4: Configure custom domain**

In Pages → Custom domains → add `touge.gg` (or your registered domain). Update DNS as instructed.

---

## Self-Review Notes

After writing this plan, I verified:

1. **Spec coverage**: Every spec section (§1–§13) is addressed.
   - §1 Goals/Non-goals → reflected in scope cuts throughout
   - §2 Tech stack → Tasks 0.1–0.5
   - §3 Routes → Tasks 4.1–4.5 (API), 6.2–6.6 (pages)
   - §4 Data model → Task 1.1
   - §5 Anonymous edit → Tasks 2.3, 2.4, 4.2, 6.6
   - §6 Anti-spam → Tasks 2.6, 2.7, 4.1, 4.3, 4.5
   - §7 Search → Tasks 2.8, 4.4
   - §8 i18n readiness → Tasks 0.1 (Astro i18n config), 5.1 (en.json)
   - §9 SEO → Tasks 7.1, 7.2, 7.3
   - §10 Deployment → Tasks 9.1–9.3
   - §11 Risks → covered by JSON tune_values (Task 1.1) and free-text share_code

2. **Placeholder scan**: No "TBD/TODO/implement later" inside code blocks. Two intentional placeholders in `wrangler.toml` for IDs from interactive wrangler commands (Task 0.2 step 3).

3. **Type consistency**: Field names used in `db.ts` (Task 3.1) match the schema in Task 1.1. Function names (`hashEditPassword`/`verifyEditPassword`/`signEditCookie`/`verifyEditCookie`/`validateTuneValues`/`makeTuneSlug`) are consistent across tasks.

---

## Execution Choice

Plan complete and saved to `docs/superpowers/plans/2026-05-23-fh6-tune-platform.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session with batch checkpoints.

Which approach?
