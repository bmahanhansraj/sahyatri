# Sahyatri — Carpooling & Fleet Mobility Platform

Full-stack implementation of the Sahyatri PRD v1.0: Pool / One-Way / Bus listings,
tiered KYC, corporate pre-verification, fleet operations, AI safety alerts, and
Super Admin configuration — built to be deployed by a non-technical founder on AWS
(see **DEPLOYMENT.md** — Lightsail in ~20 minutes, or App Runner + RDS).

## Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js 14 (App Router, TypeScript) | One deployable unit — UI + API together |
| Database | PostgreSQL + Prisma 7 | Runs bundled on Lightsail or managed on RDS; Prisma 7 is engine-free (no binary downloads at deploy time) |
| Auth | Signed HTTP-only cookies (jose + bcrypt) | No third-party auth service to configure |
| Payments | Razorpay (stub mode until keys added) | PRD §14 |
| SMS | 2Factor.in (stub mode until key added) | PRD §15 |
| KYC docs | DigiLocker/Vahan (stub mode) | PRD §15 |

**Stub mode**: every integration works out of the box without API keys — SMS
prints to the server log, payments auto-succeed with a mock order ID. Add real
keys in `.env` and the same code goes live. Nothing to rewrite.

## Quick start (local)

```bash
cp .env.example .env        # point DATABASE_URL at any Postgres
npm run setup               # install + generate + create tables + seed demo data
npm run dev                 # http://localhost:3000
```

No Postgres handy? `docker compose up` starts the database and the app together.

If your environment blocks Prisma's CLI (rare, e.g. locked-down networks),
`prisma/init.sql` creates the identical schema with plain `psql`.

## Demo accounts (password: `demo1234`)

| Phone | Who | Demonstrates |
|---|---|---|
| 9000000001 | Super Admin + KYC Approver | Config panel, KYC queue, live alert dashboard, audit trail |
| 9000000003 | Non-commercial driver (KYC ✓) | Publish flow, weekly quota (Car 3 / Bike 6) |
| 9000000004 | Commercial driver | Unlimited publishing |
| 9000000005 | Rider (no KYC) | KYC gate on night/outstation/one-way rides |
| 9000000007 | Corporate rider (pre-verified) | Platform-wide KYC bypass + audit log |

## Where the PRD rules live

| PRD | Rule | Code |
|---|---|---|
| §4 | Publish flow, drafts, cloning, fare bounds | `src/app/api/rides/route.ts`, `src/app/publish/page.tsx` |
| §4.2/§5 | Weekly ad-hoc quota, rolling 7-day reset, commercial bypass | `src/lib/quota.ts` |
| §6 | KYC matrix (bike never / car pool >5 km or 6 PM–5 AM / one-way always) | `src/lib/kyc-rules.ts` |
| §5.1 | Corporate pre-verification bypass, audited verbatim | `src/app/api/bookings/route.ts` |
| §5.2 | Approver queue, mandatory rejection remarks, 1-year expiry | `src/app/api/kyc/*` |
| §9 | Search filters, transactional seat allocation (no overbooking), bus QR | `src/app/api/bookings/route.ts` |
| §10.2/§11 | Driver-first stationary alert → confirm safe → riders notified | `src/app/api/alerts/route.ts` |
| §12.2 | Super Admin config: quotas, fares, fees, alert thresholds | `src/app/api/admin/config/route.ts` |
| §14 | Booking fee per ride type + 18% GST, cash for car pool/one-way | `src/lib/fare.ts` |

All of the above were exercised end-to-end against a live database before shipping.

## Mobile (PWA)

The app ships as an installable Progressive Web App: visiting the site on a
phone offers "Add to Home Screen"; it then launches full-screen with the
Sahyatri icon and shows a branded offline page without a connection.
Live data (`/api/*`) is never cached, so bookings and seat counts stay fresh.
Requires HTTPS in production — both AWS options in DEPLOYMENT.md provide it.
Assets: `public/manifest.json`, `public/sw.js`, `public/icons/`,
registration in `src/components/PwaRegister.tsx`.

## Brand

Wordmark-only identity, recreated as resolution-independent SVG in `public/`:
`logo.svg` (the SAHYATRI wordmark set in the brand's Ancorli typeface — exact glyph
outlines extracted from the font, tracking matched to the supplied pattern) and
`favicon.svg` (the notched A on its own). Brand gold `#E7AF24` drives the
Tailwind theme (`marigold`), with warm black `#1A1508` for text. Headings use the brand's own
**Ancorli** typeface (`public/fonts/Ancorli.ttf`), with Poppins as fallback.

## Project layout

```
prisma/schema.prisma     data model (12 tables) — the single source of truth
prisma/seed.ts           demo data
prisma/init.sql          plain-SQL fallback for the schema
src/lib/                 business rules (kyc-rules, quota, fare, auth, audit, integrations)
src/app/api/             REST endpoints
src/app/                 pages (home/search, publish wizard, profile, admin)
```

## Scaling notes

- Stateless app — run any number of instances behind a load balancer.
- Booking uses a database transaction with a seat re-check, so concurrent
  bookings can't oversell a ride.
- Config (quotas, fees, fare rules, alert thresholds) lives in the database
  and is editable from the admin panel — no redeploys for policy changes.
- Quota is a rolling 7-day window computed per request — no cron jobs to babysit.
