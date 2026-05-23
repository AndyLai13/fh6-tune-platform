# FH6 Tune Sharing Platform — Design Spec

**Date:** 2026-05-23
**Project codename:** touge.gg (domain TBC)
**Target release:** FH6 launch − 6 to 8 weeks (TBC pending FH6 confirmation)

---

## 1. Goals & Non-goals

### Goals

- Ship a tune-sharing site for Forza Horizon 6 by the time FH6 launches in 2026.
- Optimize the visit-to-share-code path: a user landing on a tune page must see the share code within 1 second and copy it in 1 click.
- Allow upload without account creation (anonymous + edit password).
- Be discoverable on Google for queries like "FH6 R34 touge tune", "Forza Horizon 6 drift setup", etc.
- Stay free or near-free at the infrastructure level until ≥10k DAU.
- Architect for later expansion into multilingual content and Livery sharing without rewriting the foundation.

### Non-goals (MVP)

- No user accounts, OAuth, or social-graph features.
- No Livery (paint) sharing — deferred to v2 once Tune is validated.
- No threaded comments — flat reviews only.
- No image uploads from users — visual interest carried by layout.
- No real-time notifications, follows, or subscriptions.
- No moderation queue for the first launch — rely on flag + auto-hide above threshold.

---

## 2. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Astro 5 | SSG by default; server islands available; best-in-class SEO |
| Hosting | Cloudflare Pages | Unlimited bandwidth on free tier; integrated with Workers and D1 |
| Edge API | Cloudflare Workers | 100k requests/day free; co-located with Pages |
| Database | Cloudflare D1 (SQLite) | 5 GB + 5M reads/day free; FTS5 available for full-text search |
| Rate-limit & cache | Cloudflare KV | Per-IP counters for upload/review limits; cached download counters |
| Anti-spam | Cloudflare Turnstile | Free CAPTCHA; no UX friction on most users |
| Analytics | Cloudflare Web Analytics | Free; cookie-less |
| OG images | Cloudflare Images or local SVG generation | Free tier on Images covers MVP |

**Why not Vercel + Supabase:** Supabase free tier pauses after 7 days of inactivity (lethal for a pre-launch site with low early traffic). Vercel's image and bandwidth costs scale aggressively beyond the free tier. Cloudflare's free tier is genuinely free at the scales this project targets.

**Total expected infra cost:** ~$12/year (domain only) up to ~5,000 DAU. ~$5–30/month at 100k DAU.

---

## 3. Routes & Rendering Strategy

| Path | Render | Purpose |
|---|---|---|
| `/` | SSG with on-demand revalidation | Homepage |
| `/browse` | SSR | Filterable browse page; each filter combination is a unique URL for SEO |
| `/tune/[slug]` | SSG with on-demand revalidation on edit/review | Tune detail (the most important page) |
| `/upload` | SSG + client-side interactivity | Upload form |
| `/edit/[slug]` | SSR | Edit form; requires edit password |
| `/tuner/[handle]` | SSR | Tuner profile (deferred to v1.1) |
| `/track/[slug]` | SSG | Tunes filtered by recommended track (deferred to v1.1) |
| `/api/tunes` | Worker | POST upload, GET list |
| `/api/tunes/[id]` | Worker | GET, PATCH, DELETE |
| `/api/tunes/[id]/review` | Worker | POST review |
| `/api/search` | Worker | Search endpoint (FTS5) |
| `/api/report` | Worker | POST content report |

**Slug strategy:** all slugs are English-only (`/tune/touge-master-r34-001`). User content (tune names, descriptions) can contain any language, but URLs do not. This keeps the foundation language-neutral for future i18n.

---

## 4. Data Model (D1 schema)

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
  tune_values     TEXT NOT NULL,            -- JSON blob of all tuning numbers
  author_handle   TEXT NOT NULL,
  edit_password_hash TEXT NOT NULL,
  ip_hash         TEXT NOT NULL,            -- SHA-256(ip + daily_salt) for abuse tracking
  rating_sum      INTEGER NOT NULL DEFAULT 0,
  rating_count    INTEGER NOT NULL DEFAULT 0,
  download_count  INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'public' CHECK (status IN ('public','hidden','deleted')),
  created_at      INTEGER NOT NULL,         -- unix epoch seconds
  updated_at      INTEGER NOT NULL
);
CREATE INDEX idx_tunes_car ON tunes(car_id, status);
CREATE INDEX idx_tunes_type ON tunes(tune_type, status);
CREATE INDEX idx_tunes_rating ON tunes(rating_sum, rating_count) WHERE status = 'public';
CREATE INDEX idx_tunes_downloads ON tunes(download_count DESC) WHERE status = 'public';

CREATE VIRTUAL TABLE tunes_fts USING fts5(
  name, description, author_handle,
  content='tunes', content_rowid='id'
);

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
  fit_score INTEGER,   -- 1-5, optional
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
```

### Why `tune_values` is JSON, not separate columns

FH5 has roughly 35 numerical tune fields. FH6 may rename, add, or remove some. Storing as JSON means:

1. No migrations needed when the FH6 schema is finalized.
2. The UI renders fields from a config file, not from DB columns.
3. New optional fields (e.g. anti-lift kit settings) can be added without touching the DB layer.

Trade-off: we cannot query against individual tune values (e.g. "find tunes with -3° camber or stiffer"). That's an acceptable v1 limitation; if it becomes a popular feature later we can index specific extracted fields.

### `ip_hash` rather than raw IP

We don't need to know who someone is — just whether they're spamming. Storing `SHA-256(ip + daily_rotating_salt)` lets us detect abuse within a day without retaining identifying data longer than necessary.

---

## 5. Anonymous Upload + Edit Flow

### Upload

1. User fills the form, completes Turnstile.
2. Edit password (≥6 chars, blocklist of top-10k passwords) is bcrypt-hashed before storage.
3. On success, the API returns the tune's public URL and edit URL.
4. The client shows a one-time "Save these links" modal with copy buttons for both URLs.
5. The browser stores the slug + a flag in `localStorage` under `touge.gg/mytunes`, allowing a future "Tunes I uploaded on this device" view.

### Edit

1. User visits `/edit/[slug]`.
2. They enter their edit password.
3. On success, the server sets a signed cookie scoped to that slug, valid for 1 hour.
4. Subsequent PATCH calls verify the cookie; on edit, the tune's `updated_at` updates and its detail page is revalidated.

### Why password rather than email magic link

- Lowest friction: no email confirmation, no spam folder, works for users without email handy.
- Aligns with the "no account" stance: nothing to recover, nothing to compromise.
- Trade-off: if the user loses both their edit URL and password, the tune is unrecoverable. Acceptable for MVP; mitigated by the localStorage history.

### Why we don't put a token in the edit URL

A token-in-URL approach (e.g. `/edit/[slug]?token=abc`) makes any URL share equivalent to giving away write permissions. Sticky-noting the password on a separate prompt avoids that footgun.

---

## 6. Anti-spam

- **Turnstile** required for all writes (upload, edit, review, report).
- **IP-based rate limit** (Cloudflare KV): 5 uploads / 20 reviews per hour per `ip_hash`.
- **Duplicate share code detection**: if a code already exists, the upload is auto-flagged for review (still inserted, but `status='hidden'` until manually approved). This catches both honest mistakes and copy-paste spam.
- **Honeypot field**: hidden form input that real users won't fill but bots typically will.
- **Password blocklist**: top-10k common passwords (including "password", "123456", etc.) are rejected at the API layer.

---

## 7. Search & Filter

- **Browse filters** are URL parameters, not POST state. Each combination is its own URL: `/browse?car=skyline-r34&type=touge&drivetrain=rwd`. This gives Google a unique page to index per filter set.
- **Full-text search** uses D1's FTS5 virtual table on name + description + author handle.
- **Sort options**: most downloaded (default), highest rated (Wilson score, not raw average), newest, most reviewed.
- **Wilson score** for rating sort prevents a single 5-star review beating a 4.8 with 200 reviews.

---

## 8. Internationalization Readiness

The MVP ships in English only, but the codebase is structured so a future Chinese or Japanese addition does not require restructuring:

- **Astro i18n** configured with `en` as default. Other locales are TBC; the routing is ready when content exists.
- **UI strings** live in `/src/i18n/en.json`. No hard-coded text in components.
- **URL slugs** are always ASCII-safe English.
- **Tag system** uses slug keys (`touge`, `drift`) with localizable display labels.
- **User-generated content** is stored as-is; a future feature can run optional Cloudflare AI translation to surface a tune to other-language users.

This adds ~3-5 days of upfront work in exchange for avoiding a 4-6 week i18n retrofit later.

---

## 9. SEO Strategy

- All high-traffic pages (`/`, `/tune/*`, `/browse?common-filter-combos`) are statically generated.
- Sitemap is auto-generated from D1 at build time and via a daily Worker cron.
- Each tune page emits structured data (schema.org Article + AggregateRating).
- OG images for tune pages are generated on demand (Cloudflare Images or SVG-to-PNG worker) and cached.
- Pre-launch content (FH5 tune compatibility analysis, FH6 confirmed-car-list breakdowns) seeds the site with indexable pages before the game ships.

---

## 10. Deployment & CI

- GitHub repository → Cloudflare Pages (automatic deploys on push).
- `main` branch → production.
- Other branches → automatic preview URLs.
- D1 migrations managed with `wrangler d1 migrations apply`.
- Pre-deploy checks: `astro check`, `vitest run`, `playwright test` (smoke suite).
- Secrets (Turnstile keys, etc.) configured via `wrangler secret`.

---

## 11. Risks & Open Questions

| Risk | Severity | Mitigation |
|---|---|---|
| FH6 release date slips | High | Pre-launch FH5 content keeps SEO active; data model not tied to a specific game version |
| FH6 share code format differs from FH5 | Medium | Store as free-text; only validate length and character class |
| FH6 tune field names/units change | Medium | JSON-blob storage; UI renders from a config file that can be swapped |
| Domain `touge.gg` unavailable | Medium | Fallbacks: `forzatune.com`, `fh6tune.com`, `tunehouse.gg` |
| Cloudflare D1 hits write limit at scale | Low | 100k writes/day is far above MVP needs; KV cache absorbs review/download counter writes |
| Spam waves on launch day | Medium | Turnstile + rate limits + auto-hide on duplicate share codes; manual review queue can be added in a hotfix |

### Open questions for v1.1+

- Should tuners be able to claim a handle so others can't impersonate? (Light account, only for handle-claim.)
- Worth running Cloudflare AI auto-translation on descriptions to surface tunes across languages?
- Should "downloads" be tracked at all if we can't truly count them (we count copies of the share code button)?

---

## 12. Out-of-scope Cuts (YAGNI)

Explicit decisions to keep MVP focused:

- No "favorite" or "save for later" feature (cookie-based "tunes I've viewed" can come later if requested).
- No tune comparison side-by-side view.
- No tuner-vs-tuner leaderboard beyond simple aggregate counts.
- No share-to-Twitter buttons (OG cards make organic sharing work).
- No dark/light mode toggle — site is dark by design.
- No mobile app — the web app is mobile-first.

---

## 13. Success Criteria for MVP

- 4 core pages (home, browse, tune detail, upload) live and functional.
- Site loads in <1s on cable, <2.5s on 3G.
- Upload form completable in under 5 minutes for a returning user.
- At least 200 seed tunes published before public launch (from FH5 or FH6 preview).
- Lighthouse SEO score ≥95 on tune detail pages.
- Total infra spend in launch month ≤$15.

---

## Appendix A: Page Designs

Visual mockups (dark JDM-Touge direction, cyan + magenta accent) for homepage, tune detail, browse, and upload form were validated via the brainstorming visual companion on 2026-05-23. See `.superpowers/brainstorm/.../content/` for the HTML mockups.

## Appendix B: Naming Conventions Used in Mockups

These are illustrative and may change before launch:

- Product name: `touge.gg`
- Default tune type taxonomy: Touge, Drift, Grip/Circuit, Drag, Rally, Off-road
- PI classes: D, C, B, A, S1, S2, X
- Drivetrain: RWD, AWD, FWD

Final taxonomy will be confirmed against FH6 once it launches.
