import { after } from "next/server";
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

    // quorum work (chat, card, event, then the ~45s poster) runs after the stream closes, so the
    // phone is not left waiting on it and a serverless host keeps the function alive until it lands.
    let streamed!: () => void;
    const streamDone = new Promise<void>((resolve) => (streamed = resolve));
    let becameReal = false;
    after(async () => {
      await streamDone;
      if (becameReal) await makeItReal(id).catch((e) => console.error("makeItReal failed:", e));
    });

    return sseResponse(async (send) => {
      try {
        const r = await whatIf(
          { planId: id, userId: user.id, counteroffer, privateLimit },
          (delta) => send("delta", { text: delta }),
          () => send("restart", {}),
        );
        send("done", { changed: r.changed, worksForAsker: r.worksForAsker, note: r.note, source: r.source, latencyMs: r.latencyMs, state: r.settled.state });
        becameReal = r.settled.becameReal;
      } finally {
        streamed();
      }
    });
  } catch (e) {
    return fail(e);
  }
}
