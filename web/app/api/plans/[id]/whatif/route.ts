import { cleanText, fail, requireUser } from "@/lib/http";
import { sseResponse } from "@/lib/muse/sse";
import { makeItReal, PlanError, whatIf } from "@/lib/plans";

// "what if..." + "just between us". POST { counteroffer?, privateLimit? }
// -> sse: "delta" {text}..., "done" {changed, worksForAsker, note, source, latencyMs, state}
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { counteroffer?: unknown; privateLimit?: unknown };
    const counteroffer = cleanText(body.counteroffer, 200);
    const privateLimit = cleanText(body.privateLimit, 200);
    if (!counteroffer && !privateLimit) throw new PlanError("say what you'd change");
    const user = await requireUser();

    return sseResponse(async (send) => {
      const r = await whatIf(
        { planId: id, userId: user.id, counteroffer, privateLimit },
        (delta) => send("delta", { text: delta }),
        () => send("restart", {}),
      );
      send("done", { changed: r.changed, worksForAsker: r.worksForAsker, note: r.note, source: r.source, latencyMs: r.latencyMs, state: r.settled.state });
      if (r.settled.becameReal) await makeItReal(id).catch((e) => console.error("makeItReal failed:", e));
    });
  } catch (e) {
    return fail(e);
  }
}
