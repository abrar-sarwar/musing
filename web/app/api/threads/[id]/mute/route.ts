import { setMuseMuted } from "@/lib/chat";
import { json, requireUser } from "@/lib/http";
import { PlanError } from "@/lib/plans";

// mute or unmute muse in one chat. POST { muted }. members only.
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return json(async () => {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { muted?: unknown };
    if (typeof body.muted !== "boolean") throw new PlanError("expected { muted: boolean }");
    return setMuseMuted((await params).id, user.id, body.muted);
  });
}
