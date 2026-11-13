import { serverDb } from "@/lib/db/server";
import { describeContext, discover, validContext } from "@/lib/discover";
import { dropDraft, museOfDraft } from "@/lib/draft";
import { cleanText, fail, requireUser } from "@/lib/http";
import { match, type Candidate } from "@/lib/muse/match";
import { sseResponse } from "@/lib/muse/sse";
import { UnderstandSchema } from "@/lib/muse/understand";
import { createDraftFromMatch } from "@/lib/plans";
import { getSettings } from "@/lib/settings";
import { affinityFor } from "@/lib/hangouts";
import { firstName } from "@/lib/time";
import type { User } from "@/lib/types";
import { isFreeAt, todayLine } from "@/lib/when";

const MAX_MUTUALS = 8;

// the mix. POST { museId, audience? } -> sse: "delta" {text}..., "done" {planId, source, latencyMs}
// to change a draft by talking to muse: POST { planId, revise } with the draft's id and what to
// change. muse redoes the plan with that in mind and the old draft is replaced.
// the plan it makes is a draft: only the starter sees it until they send it.
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { museId?: unknown; audience?: unknown; planId?: unknown; revise?: unknown };
    const user = await requireUser();
    // a change to a draft: only its starter can ask, and only while it is still a draft
    const reviseAsk = cleanText(body.revise, 200);
    const oldPlanId = reviseAsk && typeof body.planId === "string" ? body.planId : null;
    // who muse may ask: friends (the default), or friends plus people who share a friend
    const museId = oldPlanId ? ((await museOfDraft(oldPlanId, user.id)) ?? "") : typeof body.museId === "string" ? body.museId : "";
    const settings = await getSettings();
    if (!settings.muse_on) return Response.json({ ok: false, error: "muse is off" }, { status: 409 });

    const db = serverDb();
    const { data: muse } = await db.from("muses").select("*").eq("id", museId).eq("user_id", user.id).maybeSingle();
    const understood = UnderstandSchema.safeParse(muse?.understood);
    if (!muse || !understood.success) return Response.json({ ok: false, error: "muse hasn't read that thought yet" }, { status: 404 });
    // the signal's own audience decides the pool. the body field is still read for older app builds.
    const audience = muse.audience === "mutual" || body.audience === "mutual" ? "mutual" : "friends";

    // candidates are this person's friends and nobody else. the ids muse may use come from here.
    const { data: allEdges } = await db.from("friendships").select("friend_id,close").eq("user_id", user.id);
    // a close-friends signal narrows the pool to close friends (everyone, if nobody is marked close)
    const closeOnly = muse.audience === "close" ? (allEdges ?? []).filter((e) => e.close) : [];
    const edges = closeOnly.length > 0 ? closeOnly : (allEdges ?? []);
    const friendIds = edges.map((e) => e.friend_id as string);
    if (friendIds.length < 1) return Response.json({ ok: false, error: "not enough friends in the mock data for this person" }, { status: 409 });
    // mutual friends: one hop out. only a count of friends in common is kept, never which friends.
    const mutualCount = new Map<string, number>();
    if (audience === "mutual") {
      const { data: hops } = await db.from("friendships").select("friend_id").in("user_id", friendIds);
      const known = new Set([user.id, ...friendIds]);
      for (const h of hops ?? []) {
        const id = h.friend_id as string;
        if (!known.has(id)) mutualCount.set(id, (mutualCount.get(id) ?? 0) + 1);
      }
    }
    // the best connected few, so the prompt stays small
    const mutualIds = [...mutualCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, MAX_MUTUALS).map(([id]) => id);
    const poolIds = [...friendIds, ...mutualIds];
    const [{ data: friends }, { data: topics }] = await Promise.all([
      db.from("users").select("*").in("id", poolIds),
      // reels topics are a friends-only signal. a mutual friend's are never read.
      db.from("reels_topics").select("user_id,topic,score").in("user_id", friendIds).order("score", { ascending: false }),
    ]);
    const candidates: Candidate[] = ((friends ?? []) as User[]).map((f) => ({
      ...(mutualCount.has(f.id) ? { mutuals: mutualCount.get(f.id) } : {}),
      id: f.id,
      firstName: firstName(f.name).toLowerCase(),
      interests: f.interests,
      free_windows: f.free_windows,
      // reels topics are only an input for friends who opted in
      reelsTopics: f.reels_opt_in && !mutualCount.has(f.id) ? (topics ?? []).filter((t) => t.user_id === f.id).map((t) => t.topic as string) : null,
    }));

    // discovery: fast server-side search before muse is called. muse chooses among these.
    const context = await validContext(muse.context);
    const t0 = Date.now();
    // the starter's own groups, so a private group of theirs can be found. nobody else's are read.
    const [{ data: memberships }, affinity] = await Promise.all([
      db.from("group_members").select("group_id").eq("user_id", user.id),
      affinityFor(user.id),
    ]);
    // what the old draft said, so muse changes it rather than starting over
    let revise: { ask: string; draft: string } | null = null;
    if (oldPlanId && reviseAsk) {
      const [{ data: old }, { data: asked }] = await Promise.all([
        db.from("plans").select("activity,when_text,where_text").eq("id", oldPlanId).maybeSingle(),
        db.from("plan_members").select("user_id").eq("plan_id", oldPlanId),
      ]);
      revise = { ask: reviseAsk, draft: `${old?.activity ?? "a plan"}, ${old?.when_text ?? "no time yet"}, ${old?.where_text ?? "no place yet"}, asking ${(asked ?? []).map((a) => a.user_id).join(", ") || "nobody yet"}` };
    }
    const found = await discover({ text: `${muse.raw_text as string}${reviseAsk ? ` ${reviseAsk}` : ""}`, activity: understood.data.activity, budgetHint: understood.data.budget_hint, starterFree: user.free_windows, context, interests: user.interests, memberOf: (memberships ?? []).map((m) => m.group_id as string), affinity });
    const startedFrom = await describeContext(context);
    const discoverMs = Date.now() - t0;

    return sseResponse(async (send) => {
      send("found", { events: found.events.length, groups: found.groups.length, listings: found.listings.length, ms: discoverMs });
      const r = await match(
        {
          starter: { id: user.id, firstName: firstName(user.name).toLowerCase(), interests: user.interests, free_windows: user.free_windows },
          rawText: muse.raw_text as string,
          understood: understood.data,
          candidates,
          today: todayLine(),
          found: { events: found.events, groups: found.groups, listings: found.listings },
          startedFrom,
          revise,
          // a change request is always a fresh answer
          preferCache: revise ? false : settings.muse_replay,
        },
        (delta) => send("delta", { text: delta }),
        () => send("restart", {}),
      );
      // the server has the last word on availability: drop anyone who is not free at the
      // chosen time, as long as that still leaves someone to ask.
      const free = r.data.picks.filter((p) => isFreeAt(candidates.find((c) => c.id === p.user_id)?.free_windows ?? [], r.data.when_day, r.data.when_time));
      const picks = free.length > 0 ? free : r.data.picks;
      const planId = await createDraftFromMatch(muse.id as string, user.id, { ...r.data, picks }, { waitFor: (muse.wait_for as number | null) ?? 2, expiresAt: (muse.expires_at as string | null) ?? null });
      // the new draft stands in for the old one
      if (oldPlanId) await dropDraft(oldPlanId, user.id);
      send("done", { planId, source: r.source, latencyMs: r.latencyMs });
    });
  } catch (e) {
    return fail(e);
  }
}
