# touge.gg — FH6 Tune Database

A community tune-sharing platform for **Forza Horizon 6**. Mandarin-first, optimized for 跑山 (touge) / drift / grip / rally / drag / offroad sharing across Class D–X tunes.

**Live:** https://fh6-tune-platform.badboyandy13.workers.dev
**Status:** Validation phase — 22 authorized tunes from one Bahamut contributor live as of 2026-06-01. Six-month experiment window before deciding on custom domain + paid analytics.

---

## What's here

- **Upload / browse / search** Forza tunes with full per-axis detail (suspension, gearing, alignment, anti-roll, springs, damping, aero, brakes, differential) — or in **share-code-only mode** for contributors who only published the code, not the values.
- **Per-tune metadata:** PI class, drivetrain, surface (asphalt/dirt/snow/mixed), tune type, recommended tracks.
- **Edit-by-password:** original uploaders can edit their own tune via a bcrypt-hashed password set at upload time (no accounts).
- **Anti-spam:** Cloudflare Turnstile on upload, review, and report endpoints. SHA-256 IP hashing for rate-limit + abuse tracking (no plaintext IPs stored).
- **Reviews + reports:** star ratings + text reviews on tunes; report button on tunes and reviews for moderation.
- **Discovery:** sitemap.xml, RSS feed, dynamic per-tune OG images (SVG), JSON-LD structured data.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | [Astro 6](https://astro.build) (server output) |
| Hosting | Cloudflare Workers (`@astrojs/cloudflare` v13 adapter) |
| Database | Cloudflare D1 (SQLite + FTS5, unicode61 tokenizer for CJK) |
| KV | Cloudflare KV (rate-limit + Astro sessions) |
| Anti-spam | Cloudflare Turnstile |
| Styling | Tailwind v4 (theme tokens) + JetBrains Mono |
| Auth | bcrypt edit-passwords, signed edit cookies (HMAC) |
| Testing | Vitest (unit) + Playwright (e2e + production smoke) |
| Analytics | Plausible (opt-in via `PLAUSIBLE_DOMAIN` env var) |

## Local dev

```bash
git clone https://github.com/AndyLai13/fh6-tune-platform.git
cd fh6-tune-platform
npm install

# Apply migrations to local D1
npx wrangler d1 execute fh6-tune-platform-prod --local --file=migrations/0001_initial_schema.sql
npx wrangler d1 execute fh6-tune-platform-prod --local --file=migrations/0002_seed_cars_tracks.sql
npx wrangler d1 execute fh6-tune-platform-prod --local --file=migrations/0003_fts_car_columns.sql
npx wrangler d1 execute fh6-tune-platform-prod --local --file=migrations/0004_fts_unicode61.sql
npx wrangler d1 execute fh6-tune-platform-prod --local --file=migrations/0005_share_code_only_mode.sql
npx wrangler d1 execute fh6-tune-platform-prod --local --file=migrations/0006_seed_more_cars.sql

# (Optional) seed demo data — never apply to prod
npx tsx scripts/seed-demo-tunes.ts
npx wrangler d1 execute fh6-tune-platform-prod --local --file=scripts/demo-tunes.sql

npm run dev   # http://localhost:4321
```

## Tests

```bash
npm test            # vitest unit (59 tests)
npm run test:e2e    # playwright e2e (full browser flow)
npm run test:smoke  # 9-test production-readiness sweep against SMOKE_BASE_URL
```

## Deploy

See [`docs/DEPLOY.md`](docs/DEPLOY.md) for the full first-time runbook (Cloudflare account setup, D1 / KV provisioning, Turnstile widget, secret entry, smoke verification). Subsequent deploys are `npm run build && npx wrangler deploy`.

## Architecture notes

- All meta tags (canonical, og:*, twitter:*) centralize in `src/layouts/Base.astro`.
- Tune detail pages have dynamic SVG OG images at `/og/tune/[slug].svg` (works with Discord / X / Bahamut unfurls).
- FTS5 uses `content=''` (contentless) so the index can carry denormalized `car_make` / `car_model` columns for "GT-R" → R32/R33/R34/R35 searches.
- Share-code-only mode (`tune_values IS NULL`) is the seed-contributor path: when a Bahamut/Reddit author grants permission but won't share detail values, we onboard via `scripts/import-<handle>-pack-<id>.ts` → generated SQL → applied directly to D1.
- Sprint plans live in `docs/superpowers/plans/`.

## Contributing

This is a personal experiment during the validation window — not actively soliciting PRs. If you're a real-world Forza tune author who wants their pack onboarded, file an issue describing the pack + linking to the original post (Bahamut / Reddit / forum / Discord). The flow is permission-DM → bulk-import script → goes live with proper attribution.

## License

[AGPL-3.0](./LICENSE). If you host a modified version of this code as a service, you must release your modifications under the same license.

---

*touge (峠) — a winding mountain road. The name comes from the Japanese pass-racing tradition this kind of community has always orbited around.*
