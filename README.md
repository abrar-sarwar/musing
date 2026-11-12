# musing.

hackathon prototype for meta's closer together ai hackathon. muse turns one vague thought into a real plan with friends, and nobody has to risk asking.

- `mobile/` expo app (the product ui)
- `web/` next.js api server (every muse call and every write) + an optional web shell
- `supabase/` schema + local stack

secrets live in `web/.env.local` (never committed). the app reads `mobile/.env`.

## run it

```bash
supabase start                      # from the repo root. api on 56321, db on 56322
cd web && pnpm dev                  # api server on :3000
cd web && pnpm seed                 # first time only, or use "Reset demo data" in the app
cd mobile && npm run ios            # builds the native app with xcode and opens it in the simulator
```

the app only runs as a native xcode build. expo go is not supported. to put it on a phone, run `npm run ios -- --device`, or open `mobile/ios/musing.xcworkspace` in xcode and press run (the first `npm run ios` generates that folder). once the app is installed, `npm start` is enough to serve the js to it.

If you add a route folder under `web/app/api` while `pnpm dev` is running and it 404s, restart `pnpm dev`. The file watcher misses new folders when the machine is under load.

## how it works

1. **understand.** you type a half-formed thought. muse reads it and streams one line back. only you and muse see it.
2. **the mix (match).** muse picks 3 or 4 friends who share the interest and are free when you are, and drafts a plan. the draft is private. nothing goes out until you tap "send it".
3. **the ask.** each friend gets their own line from muse. nobody sees who else was asked.
4. **private answers.** "i'm down" and "not this time" are private. everyone sees a count ("1 of 2 in"), never names. you never find out who passed.
5. **what if... / just between us (coordinate).** a friend can counter-offer in the open, or tell muse something in confidence. muse re-solves the plan live and never repeats the private part. the server checks muse's text against every private limit and regenerates on a leak.
6. **it's happening (create).** at quorum (2 friends, so 3 people) names appear, and muse makes the group chat, the plan card and the event. the invite poster follows in the background.
7. **it fades.** if quorum becomes impossible the plan ends quietly. nobody is told who passed.

## where the privacy rules live

- `web/lib/plans.ts` shapes every plan per viewer (`buildView`). the app never reads `plan_members` directly; migration `0002` removes anon access to it and to `muses`.
- `web/lib/muse/match.ts` rejects any user id the backend didn't pass in.
- `web/lib/muse/leak.ts` + `coordinate.ts` are the private-limit check. `cd web && pnpm test:leak` runs its cases.
- `web/app/api/overlap/route.ts` + `reels_overlap_top` (sql): opted-in friends only, a count and a topic, silent below 3.

## demo controls

- musing. tab, bottom: **muse** on/off (off = plain poll) and **muse trace** (each step, model, latency).
- Menu tab: **Reset demo data**, **Replay cached Muse** (serve the last good responses, for when the network dies on stage), **Invite posters** (the ~45s image call).
- any deep link with `?as=<userId>` opens as that person, e.g. `musing://musing?as=alex`. the avatar in the top bar also switches users.

## demo script (two phones, about 90 seconds)

1. phone A is maya, phone B is alex. on A, musing. tab: type "kinda wanna go thrifting this weekend but idk who'd be into it" and send.
2. A: muse reads it, then the draft appears with who it would ask and why. tap **send it**.
3. B: the ask is under "for you". tap **i'm down**. A's count moves to 1 of 2 without a name.
4. B: switch to jo. tap **what if...**, type "sunday instead?", and under **just between us** type a budget. tap **ask muse**. both phones show "muse is reworking it", then the new plan. the budget is never mentioned.
5. that makes two, so it flips to **it's happening** on both phones: names, the group chat with the plan card, and the event.
6. reels tab: scroll two reels and the friends overlap card slides in.
7. musing. tab: flip **muse** off and send a thought to show what's left without it.

## cost notes

muse calls per full run: understand, match, coordinate, create (4 text) + 1 image. the suggestion card is cached per person. turn on **Replay cached Muse** while iterating on ui so nothing is billed.
