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

the api and optional web shell run at [http://localhost:3000](http://localhost:3000). if you configure the environment manually, copy `env.example` to `.env.local`, fill in the local supabase values from `supabase status`, and keep all real secrets uncommitted. Supabase Storage must be running: post-hangout photos use the private `hangout-memories` bucket configured in `supabase/config.toml`.

## post-hangout server surface

`GET /api/events` and `GET /api/events/[id]` return only public events plus private events visible to the acting user. their viewer-shaped response includes that user's RSVP, counts without attendee names, the two-hour completion state and whether feedback should prompt. `PUT /api/events/[id]/rsvp` persists Interested, Going or removal before completion; `PUT /api/events/[id]/feedback` validates and upserts one private Memory for an eligible Going attendee.

`GET /api/memories` and `GET /api/memories/[id]` are owner-only. photo routes below `/api/memories/[id]/photos` reserve metadata and a signed upload URL, finalize only a matching uploaded JPEG, retry a pending upload and independently delete an object. download links are signed for five minutes. the server service role is never exposed to the browser or native app.

`web/lib/feedback.ts` converts stars and structured tags into grounded topic and area/daypart/price affinity. it never reads the private note. passive seeded recommendations apply personal affinity before the existing privacy-thresholded overlap and curated factors; explicit Muse discovery keeps requested intent and eligibility primary and uses affinity only as a tie-breaker. friend matching does not read this score.

`POST /api/demo/time` is an admin-only demo clock. `{ "action": "next_feedback" }` advances shared server time just past the acting user's next Going event completion; `{ "offsetSeconds": 0 }` returns it to real time. this powers the native Developer controls and avoids changing a phone clock or maintaining separate client-only completion logic.

the native product is the supported UI for feedback and Memories. the optional browser shell remains unchanged. Events, Groups, Marketplace, Reels and Memories are seeded or mock in-app surfaces, not live Facebook integrations.

## checks

```bash
pnpm typecheck
pnpm lint
pnpm test:leak
pnpm test:router
pnpm test:discover
pnpm test:signals
pnpm test:whatif
pnpm test:schedule
pnpm test:recommend
pnpm test:feedback
```

`test:discover` exercises grounded seeded-catalog ranking, `test:signals` covers audience/quorum/expiry rules, and `test:whatif` covers the deterministic plan-specific suggestions. `test:schedule` covers how schedule rules become weekly free windows (start and end dates, unavailable time, "ask each time"). `test:recommend` pins the existing privacy floor and curated ordering; `test:feedback` covers star/tag weights, facet scoping, cross-surface ordering, negative down-ranking without removal, intent-first Muse discovery and unchanged friend matching. none of these calls muse.

current verification boundary: the clean local database reset applied the post-hangout migration, TypeScript and the pure feedback/recommendation/discovery/signal suites passed, and native Swift sources type-checked. a complete local Storage health check and signed upload/download round-trip, production build, hosted migration and two-user device walkthrough are still pending; do not describe those as verified deployment behavior.
