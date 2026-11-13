import { serverDb } from "@/lib/db/server";
import { describeContext, validContext } from "@/lib/discover";
import { fail, requireUser } from "@/lib/http";
import { sseResponse } from "@/lib/muse/sse";
import { understand } from "@/lib/muse/understand";
import { getSettings } from "@/lib/settings";
import { expiresAt, parseAudience, parseWaitFor } from "@/lib/signals";
import { firstName } from "@/lib/time";
import { todayLine } from "@/lib/when";

// POST { text, context?, audience?, waitFor?, expires? } -> sse: "muse" {museId}, "delta" {text}..., "done" {museId, understood, source, latencyMs}
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { text?: unknown; context?: unknown; audience?: unknown; waitFor?: unknown; expires?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (text.length < 2 || text.length > 280) {
      return Response.json({ ok: false, error: "say a little more (2 to 280 characters)" }, { status: 400 });
    }
    const user = await requireUser();
    const settings = await getSettings();
    if (!settings.muse_on) return Response.json({ ok: false, error: "muse is off" }, { status: 409 });

    const db = serverDb();
    // where the thought started (a listing, an event, a group, a reel), checked against the catalog
    const context = await validContext(body.context);
    const startedFrom = await describeContext(context);
    const { data: muse, error } = await db.from("muses").insert({
      user_id: user.id,
      raw_text: text,
      context,
      // an app that sends no audience predates signals: its thoughts stay between the person and muse
      audience: body.audience === undefined ? "muse" : parseAudience(body.audience),
      wait_for: parseWaitFor(body.waitFor),
      expires_at: expiresAt(body.expires, new Date()),
    }).select("id").single();
    if (error || !muse) throw new Error(error?.message ?? "insert failed");

    return sseResponse(async (send) => {
      send("muse", { museId: muse.id });
      const r = await understand(
        { text, startedFrom, starterName: firstName(user.name).toLowerCase(), interests: user.interests, today: todayLine(), preferCache: settings.muse_replay },
        (delta) => send("delta", { text: delta }),
        () => send("restart", {}),
      );
      await db.from("muses").update({ understood: r.data }).eq("id", muse.id);
      send("done", { museId: muse.id, understood: r.data, source: r.source, latencyMs: r.latencyMs });
    });
  } catch (e) {
    return fail(e);
  }
}
