# Figma Signals Redesign Implementation Plan

> **Status note (updated 12 November 2026):** This is the historical implementation plan, not the current behavior checklist. The shipped composer subsequently replaced `Only muse` with `Close friends`; the current choices are `Close friends`, `Friends only`, and `Friends of friends`. See the root [`README.md`](../../../README.md) for verified current behavior and tests.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the musing. surface to match the team's Figma (home card, three-tab musing screen, plan page, Discover together) and add the four behaviours the Figma introduces: wait-for count, expiry, a "maybe" answer, and friends' signals.

**Architecture:** The server stays the only place that decides who sees what (`web/lib/plans.ts`). New rules that can be decided without a database go in one pure module, `web/lib/signals.ts`, which is what the tests exercise. The iOS app gets one new file for the three-tab screen and edits to the existing plan, home-card and discover views. Existing illustrated avatars (`Avatar`) are used wherever Figma shows photos.

**Tech Stack:** Next.js 16 route handlers (read `web/AGENTS.md` first: this Next.js has breaking changes), Supabase Postgres, SwiftUI (iOS 17+), xcodegen, plain `node --import tsx` test scripts.

**Spec:** Figma file `9QcWPe2qdgdTU0ZFaVr6S4`. The six hand-built frames are the target: `5:24` home card, `6:43` Send a signal, `9:842` View signals, `9:904` View plans, `9:993` Your plan, `9:1810` Discover together. The component kit is `8:87`. Decisions the Figma leaves open are fixed in "Design decisions" below.

## Design decisions

1. **Send to** has three choices: `Friends only` (default), `Friends of friends`, `Only muse`. `Only muse` is today's private behaviour. The other two make the signal visible to that audience under "Your friends' signals".
2. **Wait for at least** is 1 to 5 people, default 2 (today's fixed rule). It becomes the plan's quorum, capped at the number of friends asked.
3. **Expires after** is `1 day`, `3 days`, `1 week` (default), `2 weeks`. An expired signal with no confirmed plan fades the same quiet way an impossible quorum does.
4. **Maybe** is a third private answer. It never counts toward the quorum and never makes the quorum impossible. Only the person who said it sees it.
5. **Friends' signals** show the author and their words (they chose to share them) and a count of who is in. Never names of who joined. A friend taps "i'm into this" to join.
6. **A joined friend counts as "down"** on that signal's plan. If the plan is still a draft, the join is stored and applied when the starter sends it.
7. **Locations** in Discover together is the plan's own meeting place. No new catalog.
8. **Copy:** screen titles and buttons follow Figma's casing. Muse's own voice stays lowercase.
9. **Names before quorum:** unchanged. The starter sees who muse picked; nobody else sees names until it is happening. Figma's kit card says the same ("Names appear only when all 3 opt in").

## Global Constraints

- Never add a Claude co-author trailer to commits. Commit after every task.
- Keep Muse (Meta model) API calls minimal: no new muse job, no eval runs; reuse the cache (`muse_replay`) when checking flows by hand.
- Every rule about who may see what stays in `web/lib/plans.ts`; the app never reads `plan_members` or `signal_interest` directly.
- No real photos of people. Use `Avatar` (the bundled illustrated faces).
- iOS deployment target stays 17.0. After adding or removing a Swift file run `cd ios && xcodegen generate`.
- The videos in `ios/Musing/Resources/mock/reelvideo/` stay out of git.
- Do not push to `main`, run `supabase db push`, or reseed the hosted database without the user's go-ahead (Task 9).

## Review Focus

1. A signal sent with wait-for larger than the friends muse picks: quorum is capped at the picks, so the plan can still happen.
2. A friend answers "maybe", then everyone else passes: the plan fades only when down-capable members drop below quorum, counting the maybe as still possible.
3. A signal expires while a friend has the plan open: their next answer gets "this plan isn't open", not a crash, and the screen shows the faded state.
4. A friend-of-a-friend opens a `Friends only` signal by id: 404, same as a plan they were never asked to.
5. A friend joins twice, or joins a signal they were already asked on: one membership row, status `down`, no duplicate.

---

### Task 1: Pure signal rules

**Files:**
- Create: `web/lib/signals.ts`
- Test: `web/scripts/signals.test.ts`
- Modify: `web/package.json` (add `"test:signals": "node --import tsx scripts/signals.test.ts"`)

**Interfaces:**
- Produces:
  - `type Audience = "friends" | "mutual" | "muse"`
  - `type ExpiryChoice = "1d" | "3d" | "1w" | "2w"`
  - `parseAudience(v: unknown): Audience` (default `"friends"`)
  - `parseWaitFor(v: unknown): number` (integer 1..5, default 2)
  - `expiresAt(choice: unknown, now: Date): string` (ISO; unknown choice means `"1w"`)
  - `isExpired(expiresAt: string | null, now: Date): boolean` (null is never expired)
  - `quorumFor(waitFor: number, picks: number): number` (`min(waitFor, picks)`, at least 1)
  - `outcome(statuses: string[], quorum: number): "happening" | "faded" | "open"`
  - `canSeeSignal(audience: Audience, relation: "self" | "friend" | "mutual" | "none"): boolean`

- [ ] **Step 1: Write the failing test** in the style of `web/scripts/router.test.ts` (a case table, a mismatch count, `process.exit(1)` on any mismatch). Cases:
  - `parseWaitFor`: `3`→3, `"4"`→2, `0`→2, `9`→2, `undefined`→2.
  - `expiresAt("1d", 2026-11-12T00:00Z)` → `2026-11-13T00:00:00.000Z`; `"1w"` → Nov 19; `"nope"` → Nov 19.
  - `isExpired(null, now)` false; one second past true.
  - `quorumFor(5, 3)` → 3; `quorumFor(2, 4)` → 2; `quorumFor(2, 0)` → 1.
  - `outcome(["down","down","pending"], 2)` → happening; `["out","out","pending"], 2` → faded; `["maybe","out","pending"], 2` → open; `["maybe","maybe"], 2` → open; `["down","out","out"], 2` → faded.
  - `canSeeSignal("friends","friend")` true; `("friends","mutual")` false; `("mutual","mutual")` true; `("muse","friend")` false; `("muse","self")` true; `("friends","none")` false.
- [ ] **Step 2: Run** `cd web && pnpm test:signals`. Expected: fails, module not found.
- [ ] **Step 3: Implement** the functions above in `web/lib/signals.ts`. `outcome`: happening when `down >= quorum`; faded when `total - out < quorum`; else open.
- [ ] **Step 4: Run** `pnpm test:signals` and `pnpm typecheck`. Expected: all cases pass, no type errors.
- [ ] **Step 5: Commit.**

### Task 2: Schema and seed

**Files:**
- Create: `supabase/migrations/0006_signals.sql`
- Modify: `web/lib/types.ts`, `web/lib/seed/reset.ts`, `supabase/migrations` reset function (via the new migration)

**Interfaces:**
- Produces columns: `muses.audience text not null default 'muse'`, `muses.wait_for int not null default 2`, `muses.expires_at timestamptz`, `plans.expires_at timestamptz`; table `signal_interest(muse_id uuid references muses on delete cascade, user_id text references users, created_at timestamptz default now(), primary key (muse_id, user_id))` with RLS enabled and no anon policy.
- Produces types: `MemberStatus = "pending" | "down" | "maybe" | "out"`; `Muse` gains `audience`, `wait_for`, `expires_at`; `Plan` gains `expires_at`.

- [ ] **Step 1:** Write the migration. Existing rows keep `audience = 'muse'` so nothing already floated becomes visible. Recreate `reset_all()` with `signal_interest` added to its truncate list.
- [ ] **Step 2:** Apply locally: `supabase migration up`. Verify: `curl` the local REST `muses?select=audience,wait_for,expires_at&limit=1` with the service key returns 200.
- [ ] **Step 3:** Update the types. `pnpm typecheck` passes after fixing the `respond` signature in Task 4 (expect errors only there until then; note them).
- [ ] **Step 4: Commit.**

### Task 3: Signal options on send

**Files:**
- Modify: `web/app/api/muse/understand/route.ts`, `web/app/api/muse/match/route.ts`, `web/lib/plans.ts` (`createDraftFromMatch`, `createPoll`)

**Interfaces:**
- Consumes: `parseAudience`, `parseWaitFor`, `expiresAt`, `quorumFor` from Task 1.
- Produces: `POST /api/muse/understand` body accepts `audience`, `waitFor`, `expires`; stored on the `muses` row. `createDraftFromMatch(museId, starterId, m, opts: { waitFor: number; expiresAt: string | null })`. `POST /api/plans` (poll mode) accepts the same three fields.

- [ ] **Step 1:** In `understand`, parse the three fields and write them on insert. `"mutual"` audience also drives the match route's existing `audience === "mutual"` pool (read it from the muse row instead of the request body; keep accepting the body field for old app builds).
- [ ] **Step 2:** `createDraftFromMatch` sets `quorum: quorumFor(opts.waitFor, m.picks.length)` and `expires_at: opts.expiresAt`. `createPoll` does the same.
- [ ] **Step 3:** Verify by hand with muse replay on: send one thought with `waitFor: 1`, confirm the plan row has `quorum = 1` and an `expires_at` about a week out. `pnpm typecheck` passes.
- [ ] **Step 4: Commit.**

### Task 4: Maybe and expiry in the plan engine

**Files:**
- Modify: `web/lib/plans.ts` (`respond`, `settle`, `buildView`, `getHome`, `getPlanView`), `web/app/api/plans/[id]/respond/route.ts`, `web/lib/types.ts` (`PlanView`)

**Interfaces:**
- Consumes: `outcome`, `isExpired` from Task 1.
- Produces: `respond(planId, userId, status: "down" | "maybe" | "out")`. `PlanView` gains `expiresAt: string | null`, `waitFor: number` (same as quorum, named for the UI), and `completed: boolean` (happening and its event start is in the past).

- [ ] **Step 1:** `settle` calls `outcome(statuses, quorum)` instead of its inline counts. Behaviour for down/out is unchanged; maybe is neither.
- [ ] **Step 2:** Add `fadeIfExpired(plan)`: a `draft` or `proposing` plan whose `expires_at` has passed is updated to `faded` (conditional on its current state). Call it at the top of `loadBundle`, so every read and every answer sees the faded state.
- [ ] **Step 3:** The respond route accepts `"maybe"`; error text becomes "status must be down, maybe or out".
- [ ] **Step 4:** `getHome`'s `asks` keeps `maybe` plans (today it drops only `out`).
- [ ] **Step 5:** Verify: `pnpm test:signals`, `pnpm test:leak`, `pnpm typecheck` all pass. By hand: answer maybe as a friend, the starter's count does not move.
- [ ] **Step 6: Commit.**

### Task 5: Friends' signals and joining

**Files:**
- Modify: `web/lib/plans.ts` (`getHome`, `sendPlan`), `web/lib/types.ts` (`MusingHome`)
- Create: `web/app/api/signals/[id]/join/route.ts`

**Interfaces:**
- Consumes: `canSeeSignal`, `isExpired`.
- Produces:
  - `type SignalView = { id: string; author: Person; text: string; createdAt: string; expiresAt: string | null; audience: "friends" | "mutual" | "muse"; waitFor: number; mine: boolean; planId: string | null; planState: PlanState | null; inCount: number; joined: boolean }`
  - `MusingHome.signals: SignalView[]` (my own, newest first) and `MusingHome.friendSignals: SignalView[]`.
  - `POST /api/signals/:id/join` → `{ ok: true, planId: string | null }`; 404 when `canSeeSignal` is false or the signal is expired.
  - `joinSignal(museId: string, userId: string): Promise<{ planId: string | null; settled: Settled | null }>` in `plans.ts`.

- [ ] **Step 1:** `getHome` builds `signals` from the viewer's own muses and `friendSignals` from friends' muses with audience `friends` or `mutual`, plus friends-of-friends' muses with audience `mutual`; expired ones are left out. `planId` is exposed only to the author or a member; `inCount` is a number, never names.
- [ ] **Step 2:** `joinSignal`: upsert `signal_interest`. If the signal's plan is `proposing` or `happening`, upsert the member row with `status: "down"` (reason "joined from the signal", no personal ask) and call `settle`; the route runs `makeItReal` in `after()` when it became real, exactly as the respond route does. If the plan is a draft or missing, only the interest row is written.
- [ ] **Step 3:** `sendPlan` applies stored interest: every `signal_interest` user for that muse becomes a member with `status: "down"`, then `settle` runs.
- [ ] **Step 4:** Verify by hand with two users (`x-musing-user` header locally): maya sends a `Friends only` signal; alex's home lists it with `joined: false`; alex joins; maya's count moves; zara (not maya's friend) gets 404 on join. Then the Review Focus cases 4 and 5.
- [ ] **Step 5: Commit.**

### Task 6: iOS models, theme and the three-tab musing screen

**Files:**
- Modify: `ios/Musing/Models.swift`, `ios/Musing/Theme.swift`, `ios/Musing/MusingScreens.swift` (remove the old `MusingScreen` body and `PlanRow` usage there; keep `SignalComposer`'s state machine)
- Create: `ios/Musing/SignalScreens.swift`, then `cd ios && xcodegen generate`

**Interfaces:**
- Consumes: `MusingHome.signals`, `.friendSignals`, `PlanView.expiresAt/waitFor/completed`, the three new `understand` body fields, `POST /api/signals/:id/join`.
- Produces: `enum MusingTab { case send, signals, plans }`; `MusingScreen(compose: Bool, tab: MusingTab = .send)`; `SegmentChips`, `OptionRow`, `SignalCard`, `PlanCard`, `GradientButton`, `PeopleChips` views; route `musing://musing?tab=signals|plans`.

- [ ] **Step 1:** Models: decode the new fields (all optional-tolerant so an older server still decodes).
- [ ] **Step 2:** Theme: add the Figma tokens as named values (card border `0xe4e6eb`, card radius 12, option-row fill `FB.blueSoft` with a `FB.blue` 1pt border, selected chip `FB.blueSoft`/`FB.blue`, idle chip `FB.button`). `GradientButton` uses the existing `Muse.entryGradient`.
- [ ] **Step 3:** Send tab (frame `6:43`): title "What's the move?", subtitle, multi-line text box, three `OptionRow`s (Send to, Wait for at least, Expires after) each opening a menu with the choices from "Design decisions", `GradientButton("Send a signal")`, and the sparkle note. It drives the existing `SignalComposer` flow (understand, optional question, match, open the draft) and passes the three options.
- [ ] **Step 4:** Signals tab (frame `9:842`): "Your signals" then "Your friends' signals", each a list of `SignalCard` (avatar, name, age and "expires in", the words, "audience · N+ people", a status strip). Strip text: no plan yet "Waiting to turn this into a plan"; plan exists "Plan created! Tap to view."; a friend's signal shows an "i'm into this" button, or "You're in" once joined.
- [ ] **Step 5:** Plans tab (frame `9:904`): "Upcoming plans" and "Completed plans" of `PlanCard` (label line "DRAFTED PLAN · 0/4 DOWN" / "CONFIRMED PLAN · YOU + 1/1 DOWN", title, date row, place row, invited row, `PeopleChips`). `PeopleChips` shows names only from `picks` (starter) or `going` (happening); otherwise a count chip.
- [ ] **Step 6:** Keep `SuggestCard` and `TracePanel` at the bottom of the Send tab. The header gets the calendar icon from Figma, opening the existing events list.
- [ ] **Step 7:** Verify in the simulator against the three Figma frames: launch with `-musing_account_chosen YES -open "musing?as=maya&tab=signals"` and screenshot each tab. Add a `-skip_notifications YES` launch default in `Notifier` so the permission alert does not cover screenshots.
- [ ] **Step 8: Commit.**

### Task 7: Plan page and Discover together

**Files:**
- Modify: `ios/Musing/MusingScreens.swift` (`PlanScreen`), `ios/Musing/DiscoverScreens.swift`, `ios/Musing/MusingApp.swift` (route), `ios/Musing/Theme.swift` (`Copy`)

**Interfaces:**
- Consumes: `PlanCard`, `PeopleChips`, `GradientButton` from Task 6; `PlanView.opportunities`.
- Produces: `DiscoverTogetherScreen(plan: PlanView)`; route `.discoverTogether(planId)`.

- [ ] **Step 1:** `PlanScreen` (frame `9:993`): header "Your plan"; a `PlanCard` with the "MUSE DRAFT · NOT CONFIRMED" label; a Discover summary card ("1 event · 1 location · 2 Marketplace finds · 1 group", counts from `opportunities`, hidden when there are none) that pushes `DiscoverTogetherScreen`; "Matched friends" rows (avatar, name, the reason in quotes) shown to the starter only, from `picks`.
- [ ] **Step 2:** Actions for a member: `GradientButton("I'm in!")`, then "Maybe" and "What if..." side by side, then outlined "Can't make it". They call respond with `down`, `maybe`, the existing `WhatIf` sheet, and `out`. The starter's "send it" / "not this" keep their behaviour in the same button styles. The muse pitch, the "muse is reworking it" state, the happening state (chat and event links) and the faded line all stay.
- [ ] **Step 3:** `DiscoverTogetherScreen` (frame `9:1810`): "Discover together" / "optional ingredients for your upcoming plan."; collapsible sections Events, Locations (the plan's place), Marketplace finds (two-up grid), Groups. Cards open the existing listing, public-event and group screens. Reuse `FoundSection`'s data mapping; delete `FoundSection` from the plan page once nothing uses it.
- [ ] **Step 4:** Verify in the simulator as maya (starter) and as alex (member) against the two Figma frames; tap through each of the four answers once with muse replay on.
- [ ] **Step 5: Commit.**

### Task 8: Home card

**Files:**
- Modify: `ios/Musing/HomeScreen.swift` (`MusingHomeCard`)

- [ ] **Step 1:** Rebuild to frame `5:24`: "musing." label, "what's the move?", subtitle, an inline text field with the placeholder "lowkey wanna try a new food place...", a "make a move" gradient button (hands the typed text to the Send tab), and an outlined "view upcoming plans" (opens the Plans tab).
- [ ] **Step 2:** Keep today's live status as one line under the subtitle when a plan is in motion ("1 of 2 in so far. names show once it's on."), tappable to that plan.
- [ ] **Step 3:** Verify in the simulator against the frame; commit.

### Task 9: Ship to the phones (needs the user's go-ahead)

- [ ] **Step 1:** Ask before each of: `supabase db push` (hosted schema), `git push` to `main` (deploys Vercel), and "Reset demo data" or a reseed on hosted.
- [ ] **Step 2:** After the deploy, confirm `https://musing-six.vercel.app/api/health` answers and one signal round-trips on hosted.
- [ ] **Step 3:** Build once for devices and install on every connected phone; relaunch.
- [ ] **Step 4:** Update the README's "how it works" list and privacy section for decisions 1, 4 and 5; commit.
