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
- [ ] Report dialog opens on tune detail and on review cards

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

## Analytics (optional)

Set the `PLAUSIBLE_DOMAIN` env var in production to enable Plausible analytics:

```bash
echo "touge.gg" | npx wrangler secret put PLAUSIBLE_DOMAIN
```

When set, `<script defer data-domain="touge.gg" src="https://plausible.io/js/script.js">` is injected on every page. When unset (dev default), no analytics script loads.

Plausible is privacy-respecting: no cookies, no PII, no cross-site tracking. Disclosed in `/privacy`.

## Post-Deploy Smoke Test

After every production deploy, run the automated smoke suite against the live URL:

```bash
SMOKE_BASE_URL=https://touge.gg npm run test:smoke
```

To test against a specific Pages preview URL:

```bash
SMOKE_BASE_URL=https://<preview-hash>.fh6-tune-platform.pages.dev npm run test:smoke
```

The suite (`tests/smoke/production.spec.ts`) covers 8 checks:

| # | Test | What it verifies |
|---|------|-----------------|
| 1 | homepage loads | HTTP 200 + `<title>` contains `touge.gg` |
| 2 | /browse loads with tunes | HTTP 200 + at least one `/tune/` link visible |
| 3 | /sitemap.xml is valid | HTTP 200, XML content-type, contains `<urlset` and `/tracks/` |
| 4 | /feed.xml is valid RSS 2.0 | HTTP 200, contains `<rss` and `<channel>` |
| 5 | tune detail OG + JSON-LD | OG image meta and canonical link present for demo slug |
| 6 | OG image SVG endpoint | HTTP 200, `image/svg+xml` content-type, body starts with `<svg` |
| 7 | /privacy and /terms reachable | Both return HTTP 200 |
| 8 | robots.txt advertises sitemap | Contains `Sitemap:` pointing to `sitemap.xml` |

The default tune slug used by tests 5–6 is `toyota-supra-mk4-1994-demo04` (seeded in `scripts/demo-tunes.sql`). Override with:

```bash
SMOKE_TUNE_SLUG=your-slug SMOKE_BASE_URL=https://touge.gg npm run test:smoke
```

All 8 tests must pass before marking a deploy stable. Traces for any failures are saved under `test-results/` for debugging.
