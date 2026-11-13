import { after } from "next/server";
import { json, requireUser } from "@/lib/http";
import { getPlanView, makeEvent, posterForEvent } from "@/lib/plans";

// starter taps "make the event" on a plan that is on and whose event waited for them.
// the event is the in-app mock, as at quorum. nothing is published. POST -> the plan
export function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return json(async () => {
    const { id } = await params;
    const user = await requireUser();
    const { eventId, prompt } = await makeEvent(id, user.id);
    if (prompt) after(() => posterForEvent(id, eventId, prompt).catch((e) => console.error("poster failed:", e)));
    return getPlanView(id, user.id);
  });
}
