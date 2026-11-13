# musing web

this directory contains the next.js api server, muse orchestration, supabase access and an optional web shell for the musing prototype. every application write goes through these server routes; browser-facing database access is limited to the reads and realtime signals documented in the root readme.

## documentation source of truth

read [`../musing.md`](../musing.md) for product direction and [`../README.md`](../README.md) for verified repository setup, behavior, privacy boundaries and the demo flow. do not treat proposed facebook integrations in the product brief as implemented: current Events, Groups and Marketplace data is seeded and mock.

when documenting work in this directory, label proposed, stretch and mock-only behavior explicitly and verify current implementation claims against the routes, `lib/`, migrations and tests.

## run locally

from the repository root, `./setup.sh` configures the local supabase stack and environment files. then start the server:

```bash
cd web
pnpm dev
```

the api and optional web shell run at [http://localhost:3000](http://localhost:3000). if you configure the environment manually, copy `env.example` to `.env.local`, fill in the local supabase values from `supabase status`, and keep all real secrets uncommitted.

## checks

```bash
pnpm typecheck
pnpm lint
pnpm test:leak
pnpm test:router
pnpm test:discover
pnpm test:signals
pnpm test:whatif
```

`test:discover` exercises grounded seeded-catalog ranking, `test:signals` covers audience/quorum/expiry rules, and `test:whatif` covers the deterministic plan-specific suggestions. none of these three calls muse.
