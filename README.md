# musing.

hackathon prototype for meta's closer together ai hackathon. muse turns one vague thought into a real plan with friends.

- `mobile/` expo app (the product ui). `cd mobile && npx expo start`
- `web/` next.js api server + optional web shell. `cd web && pnpm dev`
- `supabase/` schema + local stack. `supabase start` from the repo root

secrets live in `web/.env.local` (never committed). the app reads `mobile/.env`.
