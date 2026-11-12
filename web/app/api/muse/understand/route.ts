import { serverDb } from "@/lib/db/server";
import { sseResponse } from "@/lib/muse/sse";
import { understand } from "@/lib/muse/understand";
import { getActingUserId } from "@/lib/user";
import { firstName } from "@/lib/time";

// POST { text } -> sse: "muse" {museId}, "delta" {text}..., "done" {museId, understood, source, latencyMs}
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { text?: unknown };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 2 || text.length > 280) {
    return Response.json({ ok: false, error: "say a little more (2 to 280 characters)" }, { status: 400 });
  }

  const userId = await getActingUserId();
  const db = serverDb();
  const { data: user } = await db.from("users").select("id,name").eq("id", userId).maybeSingle();
  if (!user) return Response.json({ ok: false, error: "unknown user" }, { status: 404 });

  const { data: muse, error } = await db.from("muses").insert({ user_id: userId, raw_text: text }).select("id").single();
  if (error || !muse) return Response.json({ ok: false, error: error?.message ?? "insert failed" }, { status: 500 });

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toLowerCase();

  return sseResponse(async (send) => {
    send("muse", { museId: muse.id });
    const r = await understand({ text, starterName: firstName(user.name).toLowerCase(), today }, (delta) => send("delta", { text: delta }));
    await db.from("muses").update({ understood: r.data }).eq("id", muse.id);
    send("done", { museId: muse.id, understood: r.data, source: r.source, latencyMs: r.latencyMs });
  });
}
