

**musing.**

**UPDATED PRODUCT & BUILD BRIEF  \|  12 NOVEMBER 2026**

Current direction, experience design, Facebook-native integrations, Muse orchestration, priorities, and demo plan.

Status note: This document captures product decisions and proposed implementation as of today. It does not certify that any feature has shipped or is working. Features listed as “build” require validation in the prototype.

**01  The idea right now**

musing. is an AI-powered Facebook experience that turns a low-pressure thought—“kinda wanna go thrifting”—into a real shared experience with people you already know. Muse understands the vibe, finds willing friends, discovers useful opportunities across Facebook, quietly coordinates constraints, and turns intention into an actual plan.

Pitch: “muse knows what you won’t say in the group chat.”  \|  Tagline: “what if y’all actually did it?”

North star: More young adults having meaningful real-world interactions with friends, not just scrolling longer.

**What has changed from the original brief**

Facebook integration is now central to the value proposition—not just an Event and Messenger handoff at the end.

Marketplace becomes a real discovery/action surface, especially for thrifting, outfits, hobbies, furnishing, and community commerce.

Groups, communities, Events, Reels, Feed, Messenger, and Marketplace can all supply context or completion actions; these are proposed/mock integrations for the hackathon.

Friend-first is the default: deepen existing relationships before widening to mutuals or groups.

Bump-like spontaneous proximity/social discovery is a future extension, not the core hackathon dependency.

Keep the “i’m down” signal, private quorum, private limits, “what if” re-solve, and co-created outcome as the signature interaction.

**02  The user problem and why Facebook**

Target: young adults (especially 18–24) who have friends and shared interests but often cannot turn “we should hang” into something that happens. The social friction is asking first, guessing who is interested, planning around constraints, and finding a worthwhile thing to do.

| Facebook advantage | How musing uses it |
| :---- | :---- |
| Existing friend graph | A trusted starting circle and context for personal asks. |
| Groups \+ communities | Recurring interest circles, trusted discussions, local recommendations, public meetups. |
| Events | Actual dates, RSVPs, hosts and scheduled opportunities. |
| Marketplace | Local items and seller listings can become the reason to meet or the shared activity. |
| Reels \+ Feed | Inspiration can convert to action without forcing users to start from an empty prompt. |
| Messenger | Coordination and conversation continue after the plan is accepted. |

Positioning: Instagram and other apps can inspire plans, but the proposed Facebook-native advantage is the combination of established friends, interest groups, local events, resale listings, and group coordination in one connected graph. This is a product hypothesis to test—not proof of exclusivity.

**03  The core loop: from thought to shared experience**

SPARK — User types a vague thought, taps “i’m down” on an inspiration card, or accepts an opt-in Muse suggestion.

UNDERSTAND — Muse extracts intent, timing, mood, activity and ambiguities; asks at most one useful follow-up.

CONNECT — Backend finds eligible existing friends first; Muse proposes complementary matches and explains each reason.

EXPLORE FACEBOOK — Muse surfaces relevant Events, Groups/community conversations, Marketplace listings and/or content inspiration as context, depending on the activity.

INVITE — Each friend receives an individually worded, low-pressure ask. No public list of declines or ignored invites.

COORDINATE — Private preferences and “what if...” counteroffers change the joint plan; Muse re-solves and pushes an update.

COMMIT — Once opt-in quorum is met, reveal approved attendees and create mock Event/Messenger handoff (only after a user tap).

MAKE SOMETHING — Generate an invite card/poster and, after the experience, let each attendee privately rate it and keep a personal Memory. Any future sharing or “run it back” action is separate and explicit; a rating never creates a shared recap.

One output across entry points: a living plan card with activity, why these friends, date/time, proposed place or event, relevant Facebook opportunities, quorum and next action.

**04  Facebook ecosystem: integration map**

| Surface | Entry point / Muse role | Example |
| :---- | :---- | :---- |
| Reels | Opt-in broad topic inspiration; offer action card. | After thrift content: “a few friends might be down to thrift this weekend.” |
| Marketplace | Find relevant listing categories or saved items; create shopping meetups and collaborative hunts. | “thrift a fit under \$40” → friend invite \+ candidate local vintage listings. |
| Groups | Suggest eligible interest groups or group-organized outings; let users discover a circle. | Photography signal → relevant group \+ photo walk. |
| Communities | Find recurring people and activities around a shared interest; widen only by choice. | A book club meetup or campus hobby community. |
| Events | Recommend matching time-bound events and attach one to a plan. | Thrift pop-up Saturday → propose attending together. |
| Feed | Make a contextual, optional “do this together” entry point. | Friend shares pottery → “make a plan?” |
| Messenger | Send private asks and coordinate the confirmed crew. | After quorum, create a group-thread mock. |
| Friend graph | Rank opted-in, suitable friends; avoid stranger-first matching. | Three friends want to try a coffee crawl. |

**05  Marketplace: the differentiating example**

Marketplace should not become a generic shopping recommendation bot. It becomes a social activity layer around browsing, collecting and meeting up, subject to real listing availability and user consent.

Thrift quest: “i wanna go thrifting” → Muse finds a thrift pop-up/event, relevant resale categories/listings, and friends who enjoy styling or vintage clothes.

Fit challenge: “build a concert outfit for \$50” → friends propose and compare pieces; Muse makes a collaborative moodboard/plan.

Room refresh: “my apartment looks empty” → friends coordinate a secondhand decor hunt; suggested listing categories and an outing.

Hobby starter: “wanna get into film photography” → local camera listings, group recommendations, and a photo walk with friends.

Swap day: “we should do a closet cleanout” → connect an opt-in friend swap to a Group or Event, with a co-created invite.

Demo discipline: Use clearly labeled seeded Marketplace listings and seeded Events; do not imply access to live inventory or third-party seller data. Listing availability, seller permission, payment and real meetup safety are out of scope.

**06  The interaction that feels new**

**Signals \+ the Mix**

A living “i’m down” signal is lightweight, expires, and can be edited. Muse does not merely find identical interests: it can recognize complementary roles (someone knows thrift stores; someone has a car; someone wants to style outfits), but does not expose personal or sensitive facts.

**Private quorum and limits**

The starter sees “1 of 3 down,” not the names of those who accepted until the agreed quorum is reached. Members can tell Muse “just between us” about availability or budget limits. Muse may adapt the suggestion but may not repeat the private reason.

**“what if...” and shared artifacts**

A counteroffer—“what if sunday?”—triggers a visibly different re-solved plan. With consent, Muse makes a collaborative invite, event concept, outfit board or mini itinerary. A later private Memory belongs to one attendee; any future shared recap or “run it back” action is separate, explicit and never auto-invites.

**Post-hangout feedback and private Memories**

Two hours after a scheduled hangout starts, only people recorded as Going can rate it. The private response is 1–5 stars, up to four structured tags, an optional note and up to five photos. It creates or updates one personal Memory for that attendee; it is not shown to the crew, posted to Facebook or used to choose friends.

Structured stars and tags may tune seeded Events, Groups, Marketplace and Reels ranking. Activity and repeat tags tune grounded topics; place, timing and value tags tune only their matching facets. Crew tags remain archival. Muse never interprets the private note, low ratings only down-rank rather than erase candidates, and explicit Muse intent remains primary.

Memories are a private in-app archive styled after a Facebook surface, not a live Facebook integration. A standalone event Memory identifies its host and attendee count but not the other attendees. Uploaded photos take precedence over catalog art, remain in private Storage and are served only with short-lived signed links.

**07  What Muse actually does**

| Muse job | Inputs | Expected structured output |
| :---- | :---- | :---- |
| Understand | User text and optional chosen inspiration | Intent, activity, vibe, time window, clarification. |
| Match | Eligible friend IDs and non-sensitive profile signals | 2–4 friend IDs, specific fit reason, candidate crew. |
| Discover | Seeded Events, Groups and Marketplace metadata | Ranked relevant opportunities with grounded source IDs/reasons. |
| Coordinate | Plan, individual responses and private constraints | Personal asks, compatible proposal, revised plan. |
| Create | Confirmed plan and approved details | Invite/artifact prompt, social copy and recap draft. |
| Suggest | Opted-in prior signals and permitted topic overlap | Zero or one contextual suggestion with “why this?”. |

Architecture: backend retrieval/filtering first, Muse reasoning second, server validation third. Muse may only cite friend/event/group/listing IDs provided by the backend; it does not invent Facebook inventory or silently publish.

Current source brief names muse-spark-1.3, muse-image-1.0, https\://api.meta.ai/v1 and MODEL\_API\_KEY as proposed configuration. API behavior, access, latency, structured outputs and image generation must be tested; do not assume these are already operational.

**08  Privacy and trust: product rules**

Existing Facebook friends by default. Wider audience (mutuals, groups, communities) requires an explicit choice; no stranger one-on-one auto-matches.

Consent for any proactive suggestion; Reels topic signals off by default, use coarse topics only, and require at least three opted-in friends for overlap.

Never identify who watched a topic or why a specific person is unavailable. Do not expose private limits in the trace, event details or group chat.

No persistent location tracking or exact distance computation. Public places for expanded-group plans.

Muse can propose, rank and draft. Sending invitations, joining groups, contacting sellers, sharing Memories and creating Events each require explicit user action. Private feedback is never published automatically.

Blocked sensitive suggestion areas and controls for visibility, dismissal, expiry and Muse-off; no pressure-based notifications.

**09  Prototype scope and honest status**

Status terminology: “core proposed” \= essential to build; “stretch” \= if time permits; “mock only” \= represent the Facebook surface with seeded data. No verified implementation status was provided in the source.

| Priority | Scope | Acceptance evidence |
| :---- | :---- | :---- |
| P0 / core proposed | Signal → Muse parse → friend-first Mix | A fresh prompt produces a valid, grounded living plan card. |
| P0 / core proposed | Personal asks, i’m down, hidden quorum | Second participant accepts; names stay hidden before threshold. |
| P0 / core proposed | Private limit \+ what if live re-solve | Change on one device produces a coherent update on both. |
| P0 / core proposed | One Facebook integration: thrift Event \+ Marketplace opportunity | Seeded events/listings appear with relevant IDs and reasons. |
| P1 / stretch | Group/community recommendations \+ Reels inspiration | Consent-gated contextual action card and group/event match. |
| P1 / stretch | Mock Messenger/Event handoff \+ Muse image invite | Explicit confirm creates visible handoff artifacts. |
| P1 / core proposed | Post-hangout feedback \+ private Memories | Going attendee can time-skip the demo, rate after completion and see an owner-only Memory without exposing it to friends. |
| P1 / stretch | Muse off \+ trace panel | Without Muse the flow collapses to manual poll mechanics. |
| P2 / mock only | Feed recap, multiple group modes, broader Marketplace journeys | Static or scripted exploratory screens; clearly labeled. |

**10  Demo story: one connected Facebook moment**

Maya sees a thrift Reel (or types “lowkey wanna thrift this weekend”).

Muse recognizes thrift intent, picks three opted-in friends and explains complementary fit.

A seeded Saturday thrift pop-up Event and a few seeded Marketplace finds appear as optional plan ingredients; Muse makes a plan, not a list of links.

Alex gets a personalized ask and taps “i’m down”; Maya sees only a count.

Jo privately signals a spending limit and suggests Sunday; Muse re-solves the plan and updates both screens without revealing the reason.

Threshold reached; users confirm. A mock Facebook Event, Messenger conversation and generated invite poster appear.

For the demo, advance the shared server clock just past the event’s two-hour completion point. The Going attendee receives one “How was it?” prompt, saves private feedback and opens the personal Memory; another user cannot access it.

Show the Facebook-native value chain: Reel → friends → Event/Marketplace → Messenger → shared experience → private Memory. Then demonstrate “muse off” to prove AI adds value. Every named Facebook surface remains seeded or mock in-app behavior unless approved live access is separately verified.

Presentation window from the original brief: 8 minutes (problem, working demo, AI role/tradeoffs, Q\&A). Keep the live path tight; every additional surface should support the same story rather than create a second product.

**11  Immediate next steps**

Confirm one hero use case: thrifting, with seeded friend profiles, one pop-up event, 3–5 mock listings and one relevant group.

Define a single normalized opportunity object: id, type, title, source surface, time, location label (non-tracking), tags, visibility, action, provenance.

Build a Facebook-context adapter for mock Reels/Events/Groups/Marketplace metadata; validate permission/visibility before Muse sees candidates.

Implement stable JSON schemas and deterministic validation for understand, match, discover and coordinate.

Make two-person/two-device response flow and live re-solve reliable before expanding features.

Measure demo success: signal-to-plan time, successful plan quorum, re-solve success, user-perceived relevance and Facebook-surface action conversion.

Use survey feedback as supporting evidence only once results have been reviewed and summarized; no survey statistics are asserted in this brief.

**12  Open product decisions and constraints**

Should Marketplace items be suggestions inside a plan or a standalone collaborative “hunt” tab? Recommend inside the plan for the hackathon.

Should a user discover Groups without joining, or join before receiving group-level invites? Recommend discovery first and explicit join.

Which Facebook surfaces are truly accessible through approved APIs? For hackathon, mock unsupported integrations and explain it transparently.

How does musing create value for young adults not already active on Facebook? Position it as a reason to return for friends, community activities and resale experiences; test the assumption rather than relying on it.

What will be demonstrated live versus simulated? Track this explicitly and avoid claiming live Facebook write actions.

**Appendix: working technical baseline**

Proposed stack from prior brief: Next.js \+ React \+ TypeScript \+ Tailwind; Supabase Postgres/realtime; around 25 seeded mock users. Existing routes: POST /api/signal, /api/mix, /api/respond, /api/resolve, /api/suggest, /api/poster. Extend with /api/opportunities (server-side seeded source retrieval) and /api/discover (Muse ranking of permitted candidates). These last two are proposed additions, not existing verified endpoints.

Suggested additional tables: opportunities (source\_type, source\_id, tags, visibility, event\_time, place\_label, metadata), opportunity\_saves (user\_id, opportunity\_id), plan\_opportunities (plan\_id, opportunity\_id), permissions (user\_id, surface, consent), and artifact\_drafts (plan\_id, type, approved).

Original brief retained: no real Facebook API integrations; no auto-publishing; no tracking. Also retain fallback behavior: if Muse fails, serve a usable manual plan/poll rather than hallucinating results.

Source basis: “musing. agent brief” attached by the team, plus the latest concept discussions on deeper Facebook integration, Marketplace, young-adult value, and friend-first planning. Product extensions in this update are proposed directions, not externally verified capabilities.

musing.  •  internal product working brief  •  12 nov 2026  
