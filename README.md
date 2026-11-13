# musing.

an ai-powered, friend-first facebook experience for meta's closer together ai hackathon. muse turns a low-pressure thought like "kinda wanna go thrifting" into a real shared experience with people you already know. it understands the vibe, finds willing friends, explores useful seeded facebook opportunities, quietly coordinates constraints and helps the group commit to a plan.

the product north star is more meaningful real-world time with friends, not more time spent scrolling. the pitch is: **muse knows what you won't say in the group chat.**

- `ios/` native swift app (swiftui, the product ui). no expo, no react native.
- `web/` next.js api server (every muse call and every write) + an optional web shell
- `supabase/` schema + local stack

secrets live in `web/.env.local` (never committed). the app reads `ios/.env` (copy `ios/env.example`).

## product direction and documentation

[`musing.md`](musing.md) is the canonical product and build brief. it defines the current product direction, facebook-native value proposition, core interaction, priorities, trust rules and the boundary between proposed, stretch and mock-only work.

this readme documents the repository as it is verified to work. the brief intentionally does not certify that every idea has shipped, so implementation claims must be checked against the code, migrations and tests before they are described as current behavior.

future documentation should:

- use `musing.md` for product intent, terminology, priorities and experience decisions;
- distinguish **verified current behavior** from **core proposed**, **stretch** and **mock only** work;
- describe Events, Groups, Marketplace, Reels, Feed and Messenger as seeded or mock surfaces unless a real approved integration is verified;
- preserve the friend-first default, hidden declines, private limits, consent gates and explicit user action before any external effect;
- update this readme when verified setup, architecture, security or demo behavior changes.

## run it

```bash
supabase start                      # from the repo root. api on 56321, db on 56322
cd web && pnpm dev                  # api server on :3000
cd web && pnpm seed                 # first time only, or use "Reset demo data" in the app
open ios/Musing.xcodeproj           # pick a simulator or your phone, press run
```

the app is a plain xcode project written in swift. it has no package dependencies, so there is nothing to install. the project file is generated from `ios/project.yml`; after adding or removing a swift file run `cd ios && xcodegen generate` (`brew install xcodegen`).

on a physical phone, localhost is the phone. the build writes this mac's bonjour name (`your-mac.local`) into the app, so the phone reaches the laptop over the usb cable or over home wifi. campus and guest wifi usually block phone-to-laptop traffic, so keep the cable plugged in there. if it picks the wrong address, set it in the app under profile > wrench icon (Developer).

**no cable, any network:** run `./tunnel.sh` on the laptop (needs `brew install cloudflared`). it prints a temporary https address that reaches this mac's api and database through one door. paste it into Developer in the app, or open the `musing://developer?server=...` link it prints on the phone. the address is public while the script runs and changes each time it restarts.

## running it on your own mac and phone (teammates)

the short way: clone, run `./setup.sh` from the repo root, then `cd web && pnpm dev` and press run in xcode. the script finds your own apple team, writes your signing and env files, starts the database and seeds it. it asks once for the muse key and never overwrites a file you already have. the steps below are what it does, for when something goes wrong.

you need xcode 16 or newer, docker desktop, the supabase cli v2 (`brew install supabase/tap/supabase@2`), node 20+ and pnpm. the current `supabase/config.toml` uses the v2 `[inbucket]` section; migrate it to `[local_smtp]` before adopting cli v3. the phone needs ios 17 or newer.

1. **server.** from the repo root run `supabase start`. then `cd web && pnpm install && cp env.example .env.local` and fill it in: the two supabase keys come from `supabase status`, the muse key comes from abrar (never commit it). run `pnpm seed` once, then `pnpm dev`.
2. **signing.** open `ios/Musing.xcodeproj`, click the Musing target > Signing & Capabilities, and pick your own team (add your apple id under Xcode > Settings > Accounts first; a free one works). the bundle id is already unique to you (`com.musing.<your mac username>`). if xcode still says the bundle id is taken, create `ios/Local.xcconfig` as described in `ios/Signing.xcconfig`. do not commit the team change xcode makes to the project file.
3. **phone.** plug it in, unlock it and tap Trust. turn on Settings > Privacy & Security > Developer Mode (the phone restarts). pick the phone at the top of xcode and press run.
4. **first launch.** ios blocks the app until you trust yourself: Settings > General > VPN & Device Management > your apple id > Trust. open the app and allow "find devices on local networks" when it asks; without that it cannot reach your mac.

with a free apple id the app stops opening after 7 days. press run in xcode again to renew it.

each person runs their own server and their own copy of the demo data. two phones only see the same plans when they both talk to the same mac.

If you add a route folder under `web/app/api` while `pnpm dev` is running and it 404s, restart `pnpm dev`. The file watcher misses new folders when the machine is under load.

## how it works

1. **spark + understand.** you type a half-formed thought or start from a seeded inspiration surface. muse reads it and streams one line back. only you and muse see it.
2. **connect (the mix).** the backend finds eligible existing friends first; muse picks 3 or 4 people who fit and drafts a private plan. nothing goes out until you tap "send it".
3. **explore facebook.** the server searches seeded Events, Groups and Marketplace records and gives muse only grounded candidates that match the thought and timing. these are mock hackathon integrations, not live facebook inventory.
4. **invite.** each friend gets their own low-pressure line from muse. nobody sees who else was asked.
5. **coordinate privately.** "i'm down" and "not this time" stay private. everyone sees a count, never the identities behind it. a friend can offer "what if..." in the open or tell muse a private limit; muse re-solves without repeating the private reason.
6. **commit.** at quorum (2 friends, so 3 people) approved names appear, and muse makes the group chat, plan card and mock event handoff.
7. **make something.** an invite poster follows in the background, and the confirmed group can keep coordinating with muse in the chat.
8. **fade quietly.** if quorum becomes impossible the plan ends without identifying who passed.

## seeded facebook opportunity discovery

muse plans with more than friends. before the mix, the server searches a fictional catalog that represents facebook Events, Groups and Marketplace listings, then hands muse the few records that fit the thought and the starter's free time. muse builds one plan from them and may use at most one event, one group and two listings, or none.

- `web/lib/discover.ts` is the search (`searchMockEvents`, `searchMockGroups`, `searchMockMarketplace`, `getRelatedOpportunities`). it runs in a few milliseconds and makes no muse call.
- `web/lib/muse/match.ts` rejects any event, group or listing id the search did not return. a plan built on a public event takes its day, time and place from the catalog, and a later "what if" cannot move it.
- the public event stays in `public_events`. the plan's own private event is still made in `events` at quorum, and the chat card links back to the public one.
- a thought can start from a listing, a public event, a group or a reel ("make a move from this"). the app sends that context with the thought, so nothing is typed twice.
- saving and joining are mock interactions for the acting person only. nothing is bought, reserved or sent to a seller, and nobody is joined to a group by muse.

five thoughts to try as maya: "lowkey wanna go thrifting saturday" (event + group + listings), "i wanna do a room makeover" (listings + group), "make a move" on the photography reel or the camera listing (event + listing), "game night this weekend" (group + listing), "need something to do this weekend" (event).

on a deployed server, `POST /api/reset` and `POST /api/settings` need an `x-admin-token` header matching `ADMIN_TOKEN`. a local dev server stays open.

## product boundaries

- existing friends are the default starting circle. mutuals, groups, communities or strangers are not silently added.
- all current facebook opportunity records are seeded and mock. the prototype does not read live marketplace inventory, contact sellers, purchase or reserve items, join groups or publish to facebook.
- muse can propose, rank and draft. sending asks, accepting a handoff and any future external write require an explicit user action.
- private limits, declines and sensitive matching reasons are not exposed in asks, traces, events or chats.
- the prototype does not persistently track location or compute exact distance.

## muse in the group chat

when a plan reaches quorum its group chat is a real chat: members send messages, everyone sees them live, and a failed send can be retried without doubling it. in a chat made for a plan, muse is available as an ai co-planner. it is a capability of the chat, not a member or an account.

- muse answers only when someone writes `@muse` or taps a muse action. `recap the plan` and `show our finds` read the database and make no model call. it can be muted per chat, and the chat works the same with muse muted, off or failing.
- `web/lib/chat.ts` is the chat: membership checks, sends, muse replies and votes. `web/lib/muse/chat.ts` is the muse job. it sees the shared plan, what the plan uses, a catalog search for the question, the last few messages and when everyone going is free. it never sees private limits, private asks, counteroffers or who passed.
- muse cannot change a confirmed plan. it can put one change to a vote, and the plan moves only when every person going agrees. one "no" ends it. one vote can be open per plan.
- a plan built on a public event cannot move day. muse says so and offers a different event or a normal outing instead.
- one muse reply per message even if two phones ask at once, six replies a minute per chat, and a 45 second limit after which muse bows out.
- chats are closed to the anonymous database role. the app reads and writes them through `/api/threads`, and listens to `thread_pings`, which says a chat changed and nothing else.
- on a deployed server the `x-musing-user` header is not believed. set `DEMO_SECRET` and `DEMO_PASSCODE` on the server and `DEMO_PASSCODE` in `ios/.env`; the app trades the passcode for a signed token. this keeps strangers out of a demo. it is not real login.

## where the privacy rules live

- `web/lib/plans.ts` shapes every plan per viewer (`buildView`). the app never reads `plan_members` directly; migration `0002` removes anon access to it and to `muses`.
- `web/lib/muse/match.ts` rejects any user id the backend didn't pass in.
- `web/lib/muse/leak.ts` + `coordinate.ts` are the private-limit check. `cd web && pnpm test:leak` runs its cases.
- `web/app/api/overlap/route.ts` + `reels_overlap_top` (sql): opted-in friends only, a count and a topic, silent below 3.

## demo controls

- musing. tab, bottom: **muse** on/off (off = plain poll) and **muse trace** (each step, model, latency).
- Menu tab: **Reset demo data**, **Replay cached Muse** (serve the last good responses, for when the network dies on stage), **Invite posters** (the ~45s image call).
- any link with `?as=<userId>` opens as that person, e.g. `musing://musing?as=alex`. every screen has a link (`musing://reels`, `musing://menu`, `musing://plan/<id>`), and `-open <target>` as a launch argument starts the app there. the avatar in the top bar also switches users.

## demo script (two phones, about 90 seconds)

1. phone A is maya, phone B is alex. on A, musing. tab: type "kinda wanna go thrifting this weekend but idk who'd be into it" and send.
2. A: muse reads it, then the draft appears with who it would ask and why, plus a seeded thrift pop-up and relevant marketplace finds. tap **send it**.
3. B: the ask is under "for you". tap **i'm down**. A's count moves to 1 of 2 without a name.
4. B: switch to jo. tap **what if...**, type "sunday instead?", and under **just between us** type a budget. tap **ask muse**. both phones show "muse is reworking it", then the new plan. the budget is never mentioned.
5. that makes two, so it flips to **it's happening** on both phones: names, the group chat with the plan card, and the mock event handoff.
6. reels tab: scroll two reels and the friends overlap card slides in.
7. musing. tab: flip **muse** off and send a thought to show what's left without it.

the story is one connected, transparently mocked facebook moment: inspiration → friends → seeded Event/Marketplace context → Messenger-style coordination → a shared experience.

## cost notes

muse calls per full run: understand, match, coordinate, create (4 text) + 1 image. the suggestion card is cached per person. turn on **Replay cached Muse** while iterating on ui so nothing is billed.
