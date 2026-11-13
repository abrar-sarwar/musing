import { serverDb } from "@/lib/db/server";
import { fail, requireUser } from "@/lib/http";
import { convergeOnSignal } from "@/lib/converge";
import { getSettings } from "@/lib/settings";

// POST { museId } -> run convergence for one of the caller's signals right now.
// the same pass also runs on its own after every signal is understood; this route
// exists so it can be re-run on demand (and exercised directly in tests).
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { museId?: unknown };
    const museId = typeof body.museId === "string" ? body.museId : "";
    const user = await requireUser();
    const settings = await getSettings();
    if (!settings.muse_on) return Response.json({ ok: false, error: "muse is off" }, { status: 409 });
    const { data: muse } = await serverDb().from("muses").select("id").eq("id", museId).eq("user_id", user.id).maybeSingle();
    if (!muse) return Response.json({ ok: false, error: "signal not found" }, { status: 404 });
    const out = await convergeOnSignal(museId);
    return Response.json({ ok: true, ...out });
  } catch (e) {
    return fail(e);
  }
}
