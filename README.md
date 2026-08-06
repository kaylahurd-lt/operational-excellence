# Operational Excellence

An OpEx points-tracking prototype for LocumTenens.com, built by **Kayla Hurd <kayla.hurd@locumtenens.com>** from `CLAUDE_CODE_OpEx_Prototype_Spec.md` and scaffolded as a `micro-app-starter`-shaped package (templates in that skill's repo). This is a *thin, reviewable* package — not a hardened production app yet.

Replaces the current Smartsheet-based OpEx points tracking with role-based views (Admin/EA/Manager), configurable award rules, automatic point calculation, annual audit locking, and yearly rollover.

## What this is

- `frontend/` — vanilla HTML/JS UI (Dashboard, Group Scoring grid, Rules, Access, Audit & Rollover); talks to the API only through `frontend/api.js`
- `api/` — Fastify server, REST routes (`api/routes.ts`), and the data-access seam (`api/data/`)
- `api/domain/` — pure business logic: `calculations.ts` (the point-calculation engine), `permissions.ts` (role-based access), `rollover.ts`, `audit.ts`
- `db/schema.sql` — SQLite schema (prototype-only, behind the seam)
- `scripts/seed.ts` — fake demo data (fake names only) covering every calculation path; run with `npm run seed`
- `tests/` — unit tests + one happy-path E2E (run with `npm test`)
- `infra/` — Docker + k8s + Terraform templates
- `manifest.yaml` — what the review board reads first

## Known deviation from the standard template

This app uses Node's built-in `node:sqlite` instead of `better-sqlite3` — the latter needs a native build step (node-gyp + Python + a C++ toolchain) that wasn't available on the machine this was built on. See the comment in `api/connection.ts`. Functionally equivalent; swapping back only touches that one file. Requires Node ≥22.5 (the `Dockerfile` already reflects this: `node:22-slim`).

## What developers still need to do (the seams)

- Wire **real SSO / auth** (see `infra/k8s/secret.yaml`, `infra/k8s/service.yaml`) — `manifest.yaml` declares `auth.needs_sso: true`.
- Swap **SQLite → Postgres** behind `api/data/` (the front-end won't change).
- Fill the container **image registry** and finalize the **Terraform** apply.
- Resolve the open questions in spec section 16 (Leadership Impact / Engagement / Retention point formulas, manager badge rounding, Max Award meaning, a few source anomalies) — currently modeled as `MAPPED_SCORE_TBD`/flagged-TBD rules that are visibly excluded from totals rather than guessed.
- `npm audit` currently reports 12 vulnerabilities, all transitive (fastify 4.x's `fast-uri`/`find-my-way`, and vitest's dev-only esbuild). Fixing requires a breaking fastify 5 / vitest 4 bump — a call for whoever hardens this, not made unilaterally here.

## Run it

```
npm install
npm run seed   # wipes and recreates data-store/app.db with fake demo data
npm run dev    # http://localhost:8080 - demo user ids are printed by the seed script
```

## Run the tests

```
npm install
npm test
```
