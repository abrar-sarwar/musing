import { json, requireUser } from "@/lib/http";
import { getPlanView, sendPlan } from "@/lib/plans";

// starter taps "send it": the draft goes out, one private ask per friend.
export function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return json(async () => {
    const { id } = await params;
    const user = await requireUser();
    await sendPlan(id, user.id);
    return getPlanView(id, user.id);
  });
}
