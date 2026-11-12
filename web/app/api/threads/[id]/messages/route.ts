import { postMessage } from "@/lib/chat";
import { cleanText, json, requireUser } from "@/lib/http";
import { PlanError } from "@/lib/plans";

// send a message. POST { body, clientId }. members only. this never calls muse and never
// waits on it: if the message mentions @muse the answer says so, and the app asks separately.
// the same clientId is stored once, so a retry after a dropped connection is safe.
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return json(async () => {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { body?: unknown; clientId?: unknown };
    const text = cleanText(body.body, 2000);
    if (!text) throw new PlanError("say something first");
    const clientId = typeof body.clientId === "string" && /^[A-Za-z0-9-]{8,64}$/.test(body.clientId) ? body.clientId : null;
    return postMessage((await params).id, user.id, text, clientId);
  });
}
