import { after } from "next/server";
import { json, requireUser } from "@/lib/http";
import { joinSignal, makeItReal } from "@/lib/plans";

// POST: "i'm into this" on a friend's signal. private: the author only ever sees the count move.
export function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return json(async () => {
    const { id } = await params;
    const user = await requireUser();
    const r = await joinSignal(id, user.id);
    const planId = r.planId;
    if (planId && r.settled?.becameReal) after(() => makeItReal(planId).catch((e) => console.error("makeItReal failed:", e)));
    return { ok: true, planId };
  });
}
