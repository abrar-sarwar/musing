import { serverDb } from "@/lib/db/server";
import { fail, requireUser } from "@/lib/http";
import { match, type Candidate } from "@/lib/muse/match";
import { sseResponse } from "@/lib/muse/sse";
import { UnderstandSchema } from "@/lib/muse/understand";
import { createDraftFromMatch } from "@/lib/plans";
import { getSettings } from "@/lib/settings";
import { firstName } from "@/lib/time";
import type { User } from "@/lib/types";
import { todayLine } from "@/lib/when";

// the mix. POST { museId } -> sse: "delta" {text}..., "done" {planId, source, latencyMs}
// the plan it makes is a draft: only the starter sees it until they send it.
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { museId?: unknown };
    const museId = typeof body.museId === "string" ? body.museId : "";
    const user = await requireUser();
    const settings = await getSettings();
    if (!settings.muse_on) return Response.json({ ok: false, error: "muse is off" }, { status: 409 });

    const db = serverDb();
    const { data: muse } = await db.from("muses").select("*").eq("id", museId).eq("user_id", user.id).maybeSingle();
    const understood = UnderstandSchema.safeParse(muse?.understood);
    if (!muse || !understood.success) return Response.json({ ok: false, error: "muse hasn't read that thought yet" }, { status: 404 });

    // candidates are this person's friends and nobody else. the ids muse may use come from here.
    const { data: edges } = await db.from("friendships").select("friend_id").eq("user_id", user.id);
    const friendIds = (edges ?? []).map((e) => e.friend_id as string);
    if (friendIds.length < 2) return Response.json({ ok: false, error: "not enough friends in the mock data for this person" }, { status: 409 });
    const [{ data: friends }, { data: topics }] = await Promise.all([
      db.from("users").select("*").in("id", friendIds),
      db.from("reels_topics").select("user_id,topic,score").in("user_id", friendIds).order("score", { ascending: false }),
    ]);
    const candidates: Candidate[] = ((friends ?? []) as User[]).map((f) => ({
      id: f.id,
      firstName: firstName(f.name).toLowerCase(),
      interests: f.interests,
      free_windows: f.free_windows,
      // reels topics are only an input for friends who opted in
      reelsTopics: f.reels_opt_in ? (topics ?? []).filter((t) => t.user_id === f.id).map((t) => t.topic as string) : null,
    }));

    return sseResponse(async (send) => {
      const r = await match(
        {
          starter: { id: user.id, firstName: firstName(user.name).toLowerCase(), interests: user.interests, free_windows: user.free_windows },
          rawText: muse.raw_text as string,
          understood: understood.data,
          candidates,
          today: todayLine(),
          preferCache: settings.muse_replay,
        },
        (delta) => send("delta", { text: delta }),
        () => send("restart", {}),
      );
      const planId = await createDraftFromMatch(muse.id as string, user.id, r.data);
      send("done", { planId, source: r.source, latencyMs: r.latencyMs });
    });
  } catch (e) {
    return fail(e);
  }
}
