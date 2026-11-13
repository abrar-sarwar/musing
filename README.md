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

the app is a plain xcode project written in swift. it has no package dependencies, so there is nothing to install. the shared xcode scheme is named `Musing` and resolves the application build product as `musing.app`, matching `PRODUCT_NAME: musing` in `ios/project.yml`; preserve that casing in generated scheme references. the project file is generated from `ios/project.yml`; after adding or removing a swift file run `cd ios && xcodegen generate` (`brew install xcodegen`).

on a physical phone, localhost is the phone. the build writes this mac's bonjour name (`your-mac.local`) into the app, so the phone reaches the laptop over the usb cable or over home wifi. campus and guest wifi usually block phone-to-laptop traffic, so keep the cable plugged in there. if it picks the wrong address, set it in the app under profile > wrench icon (Developer).

**no cable, any network:** run `./tunnel.sh` on the laptop (needs `brew install cloudflared`). it prints a temporary https address that reaches this mac's api and database through one door. paste it into Developer in the app, or open the `musing://developer?server=...` link it prints on the phone. the address is public while the script runs and changes each time it restarts.

## hosted (no laptop)

verified current behavior: the api server runs on vercel at `https://musing-six.vercel.app` (project `musing`, root directory `web`, connected to this repo so a push to `main` deploys production) and the database is a supabase cloud project (`liwwbmkylzycoayfmvkn`, us-east-1) with migrations `0001` to `0008` applied and the demo data seeded. the ios app is still installed from xcode; only the server and database are hosted. the facebook surfaces are the same seeded, mock catalog as local.

- **server env (vercel, production):** `MODEL_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_SECRET`, `DEMO_PASSCODE`, `ADMIN_TOKEN`. the values are kept in `web/.env.hosted.local` (gitignored) on abrar's mac.
- **phone:** put `API_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DEMO_PASSCODE` and `ADMIN_TOKEN` in `ios/.env` and press run in xcode. `ADMIN_TOKEN` is what lets "Reset demo data" and the muse switches through. if a tunnel address was saved under profile > Developer, clear it: that override sends the api and the database to one address, and hosted they are two.
- **what is open:** `/api/health` answers anyone. everything else needs the signed demo token, and reset, settings and the muse smoke route need the admin token. anyone holding the passcode can spend the muse key.
- **schema changes:** `supabase db push` (the repo is linked to the cloud project). reseed with `cd web && node --env-file=.env.hosted.local --import tsx scripts/seed.ts`, or "Reset demo data" in the app.
- **the web shell** at `/` does not sign in, so it errors on the hosted server. it is a local dev tool.
- vercel deployment protection covers preview deployments only; the production address is public so phones can reach it.

- **reel clips:** the four real clips are not in git (they are other creators' videos). they are in a private storage bucket, `reel-videos`, on the hosted database. a build that does not have the files bundled asks `GET /api/reels/videos` for signed links (six hours, demo sign-in required) and streams them. `cd web && pnpm reels:upload` puts the files from `ios/Musing/Resources/mock/reelvideo/` there again. a local stack runs without storage, so against a local server only a mac that has the files plays them and everyone else sees the stills.

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

1. **spark + understand.** you type a half-formed thought or start from a seeded inspiration surface. muse reads it and streams one line back. you choose who the signal is shown to (close friends, friends only or friends of friends), how many friends it waits for (1 to 5, default 2) and when it expires (1 day to 2 weeks, default 1 week). "Send a signal" makes the thought visible to that audience and has muse draft a plan; it does not send the private asks yet.
   - **friends' signals.** a signal shared with friends appears under "your friends' signals" with its author, their words and a count of who is in. a friend can tap "i'm into this"; that counts as a yes on the plan, now or once it is sent. the author sees the count move, never who.
2. **connect (the mix).** the backend finds eligible people from the chosen audience; muse picks 3 or 4 people who fit and drafts a private plan. before asking anyone, the starter can remove a pick, add one of their own friends or ask muse to redo the plan. "Ask these friends" sends each selected person a private ask.
3. **explore facebook.** the server searches seeded Events, Groups and Marketplace records and gives muse only grounded candidates that match the thought and timing. these are mock hackathon integrations, not live facebook inventory.
4. **invite.** each friend gets their own low-pressure line from muse. nobody sees who else was asked.
5. **coordinate privately.** "i'm in", "maybe" and "can't make it" stay private. a maybe is visible only to the person who said it and counts neither for nor against the plan. everyone sees a count, never the identities behind it. a friend can offer "what if..." in the open or tell muse a private limit; muse re-solves without repeating the private reason. the app offers two or three plan-specific "what if" ideas, but tapping one only fills the box; the person must still explicitly ask muse. and exploring a "what if" never counts as an "i'm in": if the plan changes, the person who asked is asked again, and only an explicit answer commits them.
6. **commit.** at quorum (the wait-for number the starter chose, capped at the number of friends asked) approved names appear, and muse makes the group chat, plan card and mock event handoff.
7. **make something.** an invite poster follows in the background, and the confirmed group can keep coordinating with muse in the chat.
8. **fade quietly.** if quorum becomes impossible, or the signal expires before the plan is real, the plan ends without identifying who passed.

## proactive matching: when separate thoughts line up

nobody has to start a plan. every understood thought that its author chose to share also triggers a convergence check against the shared, unexpired thoughts of that person's existing friends (not already used by a plan, with overlapping free time). a thought kept at "only muse" is never used to match anyone, and neither is one a friend kept private; a close-friends thought is matched only inside the author's close circle, exactly the people it is shown to. a dedicated muse job reads the fresh thought together with the friends' own thoughts and decides whether one shared experience genuinely serves each of them. if it does, muse invents the experience that connects them (three different thoughts in, one plan out: a friend's new film camera, another's vintage markets and a vague "something fun this weekend" became a vintage market photo walk). if the thoughts are unrelated, clash, or share no free time, nothing happens. no plan is forced.

a convergence arrives as an ordinary proposal, not a formed group: the owner sees muse's reasoning, each friend gets their own private ask, and the same quorum rules decide whether it becomes real. thoughts used by a formed plan are consumed and never re-matched; a plan everyone declines fades like any other, and the group that passed on it is not proposed the same group again from leftover signals. re-running convergence never duplicates an invitation.

- `web/lib/converge.ts` is the engine (eligibility, dedupe, plan creation through the same draft/send path as a started plan). `web/lib/muse/converge.ts` is the model job; its verdicts are never cached, and a friend's raw thought is never copied into the plan.
- `pnpm eval:converge` runs the end-to-end scenarios (canonical trio, new topics, both kinds of no-match, selective inclusion, decline/dedupe, the what-if consent case, and the signals-era gates: private signals never match, expired signals never match, a maybe is not a yes, simultaneous triggers converge once, and grounding in the expanded catalog). `pnpm test:regression` covers the participant id gate (repair only inside the candidate set, everything else fails closed) and makeItReal under concurrent callers (one claim, one chat, one event).

## seeded facebook opportunity discovery

muse plans with more than friends. before the mix, the server searches a fictional catalog that represents facebook Events, Groups and Marketplace listings, then hands muse the few records that fit the thought and the starter's free time. muse builds one plan from them and may use at most one event, one group and two listings, or none.

- `web/lib/discover.ts` is the search (`discover`, `searchEvents`, `searchGroups`, `searchListings`, `getRelatedOpportunities`). it runs in a few milliseconds and makes no muse call.
- `web/lib/muse/match.ts` rejects any event, group or listing id the search did not return. a plan built on a public event takes its day, time and place from the catalog, and a later "what if" cannot move it.
- the public event stays in `public_events`. the plan's own private event is still made in `events` at quorum, and the chat card links back to the public one.
- a thought can start from a listing, a public event, a group or a reel ("make a move from this"). the app sends that context with the thought, so nothing is typed twice.
- saving and joining are mock interactions for the acting person only. nothing is bought, reserved or sent to a seller, and nobody is joined to a group by muse.

five thoughts to try as maya: "lowkey wanna go thrifting saturday" (event + group + listings), "i wanna do a room makeover" (listings + group), "make a move" on the photography reel or the camera listing (event + listing), "game night this weekend" (group + listing), "need something to do this weekend" (event).

on a deployed server, `POST /api/reset` and `POST /api/settings` need an `x-admin-token` header matching `ADMIN_TOKEN`. a local dev server stays open.

### the bigger catalog (200 more records)

verified current behavior: the catalog holds 61 public events, 51 groups, 102 marketplace listings and 20 reels. the original rows are in `web/lib/seed/data.ts`; the 200 added ones (55 events, 45 groups, 80 listings, 20 reels) are in `web/lib/seed/catalog.ts`. all of it is invented for the prototype. none of it is a real event, community, seller, listing or creator, and none of it is read from facebook.

- **what it covers:** fashion and thrifting, basketball and other pickup sports, fitness, running, gaming, board games, anime and cosplay, music, film, dance, food, cooking, coffee, art, crafts, photography, tech and ai, cybersecurity, study, career, outdoors and camping, volunteering, books, pets, plants, home, travel and language, and plain "meet people". events belong to groups (`group_id`), groups have members among the seeded people, and listings, events, groups and reels share topic tags, so one thought pulls in several surfaces.
- **search:** `web/lib/discover.ts` reads a thought for topics (with everyday wording: "hoop", "cheap fit", "take cute pictures"), the nouns in it ("monitor", "guitar"), a named day, "tonight" or "at night", "free", and money being tight or a stated budget. it filters first (the starter is free then, not cancelled, not sold or pending, not a private group they are not in), ranks second, and hands muse at most 3 events, 2 groups and 4 listings. a thought nothing fits returns nothing.
- **the rehearsed lines still find what they found:** the original rows sort first on a tie, and `pnpm test:discover` pins the thrift line to the saturday vintage pop-up.
- **not shown or recommended:** one cancelled event, two sold listings, one pending listing and two private groups are in the tables on purpose, so the filters have something to filter.
- **reels:** the 20 catalog reels are fictional creators' clips. they are separate from `reels_topics` (a person's own consent-gated signal). watching one writes nothing; "this could be us" on a reel starts a thought only when tapped.
- **pictures:** a record with a fitting bundled photo uses it. the rest (every added listing) get drawn art from `ios/Musing/CoverArt.swift`: a soft gradient and a symbol for the topic.
- **people:** a few seeded friends gained interests (basketball, coding, guitar, video games, volunteering, dance) and friday or saturday evening free time so more kinds of thought find a friend. friendships are unchanged.

```bash
supabase migration up               # applies pending migrations through 0008_close_friends
cd web && pnpm seed                 # wipes the demo state and reloads everything; safe to run again, ids are stable
cd web && pnpm test:discover        # 57 thoughts through the real search, no database, no muse call
```

"Reset demo data" in the app does the same reload as `pnpm seed`. thoughts worth trying as maya: "anyone down for basketball", "i wanna get into photography but cameras are expensive", "i wanna learn guitar but i'm broke", "i'm bored tonight", "what can i do for free", "lowkey wanna go hiking", "let's have a game night", "i need a study buddy", "i wanna volunteer", "i need to meet people".

known limits: events only surface at times the person is free, so a morning run never shows for maya (she is free from 11); day and evening words are read by rules, not by muse; weeknight events do not exist in the catalog; listings have no photos beyond the original 22.

### changing a draft before it goes out

verified current behavior on the server (run against the hosted database: add, remove, a refused non-friend, a refused other person, and a muse redo that moved the day); the screen itself builds but has not been exercised on a device. sending a signal and sending the plan are two steps: "Send a signal" puts the thought where the chosen friends can see and join it and has muse draft a plan; "Ask these friends" on the draft sends muse's private ask to each person on it. between the two, the draft is the starter's to change:

- **who gets asked:** take anyone off, or add any of your own friends muse did not pick (`POST /api/plans/[id]/picks`, `web/lib/draft.ts`). an added friend gets a plain ask built from the plan, not one muse wrote. no muse call.
- **what the plan is:** tell muse what to change in plain words ("make it sunday", "somewhere cheaper"). muse redoes the plan knowing the first draft and the request, and the old draft is replaced (`POST /api/muse/match` with `{ planId, revise }`). one muse call. the redo starts from muse again, so people added or removed by hand before it are not carried over, and a friend who is not free at the new time is still left out.
- only the starter can do either, and only while the plan is a draft. nobody is asked or told anything by these edits.

### who a signal goes to

verified current behavior on the server and in the composer: a signal goes to **close friends**, **friends only** or **friends of friends**. "only muse" is no longer a choice. close friends is a flag on a friendship (`friendships.close`, migration `0008`): it is one person's call about another, it is seeded (maya's close friends are alex, jo and sam) and there is no screen to edit it yet. a close-friends signal is shown only to the people its author marked close, and muse picks from them alone. a thought started from a reel is an invite like any other; the text handed over never names who liked the reel. `muse` (nobody) remains as a stored value for retired signals and older builds.

### plan-specific what-if ideas

verified current behavior: an open plan includes two or three deterministic suggestions for its "what if..." box. `web/lib/whatif.ts` builds them from the plan, the viewer's own free time and real area labels from the seeded catalog; it makes no muse call. a plan tied to a public event instead suggests changes that preserve the event's fixed day, time and place, such as meeting beforehand or getting food afterward. tapping a suggestion fills the box but sends nothing until the person taps **ask muse**. `cd web && pnpm test:whatif` covers the rules.

### public events, friend search and the events feed

implemented, server tests run; ios not compiled in this change. needs migration `0010_plan_events_and_picks.sql`.

- **create event or create signal**: the composer's first choice. "create signal" is the usual thought to plan. "create event" turns the words into a public in-app event that anyone in the app can see (`POST /api/events`), with no signal, plan or muse call. a signal's author can do the same later from the signal card ("create event", after a confirmation). the event a plan makes at quorum is still always made, and stays private to the people going (`events.visibility`). all of these are mock events; nothing is published to facebook.
- **who gets asked**: on a draft, the starter sees a scrollable row of friends to tap and a search box. the server searches (`GET /api/plans/[id]/picks?q=`) by any part of a name, any case, accents folded, or an interest, limited to the people the signal's audience reaches (close friends only for a close-friends signal). each of muse's picks can be turned off and back on; turning one back on restores muse's own reason and ask.
- **events tab**: facebook-style tabs (for you, local, this week, your events), category chips and large cover cards with the date in red, place, price and organizer, and interested, share and "make it a plan" buttons. signals and plans use the same card. "for you" follows `GET /api/events/recommended`, ranked by the same rule as the reels card (`web/lib/recommend.ts`): distinct opted-in friends into the event's topics, then their summed score, with any topic under three friends ignored, then the person's interests, then whether they're free. each pick has a line written by rule for that event ("let's host a game night. board game cafe night is saturday at 4, and you're free then"), with counts only and never names. `cd web && pnpm test:recommend` and `pnpm test:signals` cover the ranking, lines and friend search.

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
- `web/lib/signals.ts` holds the signal rules that need no database (who may see a signal, wait-for, expiry, what a set of answers adds up to). `cd web && pnpm test:signals` runs its cases. `plans.ts` applies them: `signalsFor` shapes friends' signals per viewer, and `signal_interest` (migration `0006`) has no anon access.
- `web/lib/muse/match.ts` rejects any user id the backend didn't pass in.
- `web/lib/muse/leak.ts` + `coordinate.ts` are the private-limit check. `cd web && pnpm test:leak` runs its cases.
- `web/app/api/overlap/route.ts` + `reels_overlap_top` (sql): opted-in friends only, a count and a topic, silent below 3.

## demo controls

- musing. tab, bottom: **muse** on/off (off = plain poll) and **muse trace** (each step, model, latency).
- Menu tab: **Reset demo data**, **Replay cached Muse** (serve the last good responses, for when the network dies on stage), **Invite posters** (the ~45s image call).
- any link with `?as=<userId>` opens as that person, e.g. `musing://musing?as=alex`. every screen has a link (`musing://reels`, `musing://menu`, `musing://plan/<id>`), and `-open <target>` as a launch argument starts the app there. the avatar in the top bar also switches users.

## demo script (two phones, about 90 seconds)

1. phone A is maya, phone B is alex. on A, musing. tab: type "kinda wanna go thrifting this weekend but idk who'd be into it" and send.
2. A: muse reads it, then the draft appears with who it would ask and why, plus a seeded thrift pop-up and relevant marketplace finds. adjust the draft if needed, then tap **ask these friends**.
3. B: the ask is under "for you". tap **i'm down**. A's count moves to 1 of 2 without a name.
4. B: switch to jo. tap **what if...**, choose the Sunday suggestion (or type "sunday instead?"), and under **just between us** type a budget. tap **ask muse**. both phones show "muse is reworking it", then the new plan. the budget is never mentioned.
5. that makes two, so it flips to **it's happening** on both phones: names, the group chat with the plan card, and the mock event handoff.
6. reels tab: scroll two reels and the friends overlap card slides in.
7. musing. tab: flip **muse** off and send a thought to show what's left without it.

the story is one connected, transparently mocked facebook moment: inspiration → friends → seeded Event/Marketplace context → Messenger-style coordination → a shared experience.

## cost notes

muse calls per full run: understand, match, coordinate, create (4 text) + 1 image. the suggestion card is cached per person. turn on **Replay cached Muse** while iterating on ui so nothing is billed.
