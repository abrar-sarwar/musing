import { museReply } from "@/lib/chat";
import { fail, requireUser } from "@/lib/http";
import { sseResponse } from "@/lib/muse/sse";
import { getSettings } from "@/lib/settings";

const ACTIONS = ["recap", "finds", "food"] as const;

// muse answers in a plan chat. POST { messageId } for an @muse message, or { action }.
// sse: "delta" {text}..., "done" {message}. members only, one answer per message, and
// rate limited per chat. if this fails the chat is untouched.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { messageId?: unknown; action?: unknown };
    const action = ACTIONS.find((a) => a === body.action) ?? null;
    const messageId = typeof body.messageId === "string" ? body.messageId : null;
    if (!action && !messageId) return Response.json({ ok: false, error: "expected { messageId } or { action }" }, { status: 400 });
    // the two instant actions read the database only. everything else needs muse on.
    if (action !== "recap" && action !== "finds" && !(await getSettings()).muse_on) return Response.json({ ok: false, error: "muse is off" }, { status: 409 });
    return sseResponse(async (send) => {
      const message = await museReply(id, user.id, { messageId, action }, (delta) => send("delta", { text: delta }), () => send("restart", {}));
      send("done", { message });
    });
  } catch (e) {
    return fail(e);
  }
}
