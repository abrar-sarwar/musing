import { after } from "next/server";
import { json, requireUser } from "@/lib/http";
import { getPlanView, makeItReal, sendPlan } from "@/lib/plans";

// starter taps "send it": the draft goes out, one private ask per friend.
export function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return json(async () => {
    const { id } = await params;
    const user = await requireUser();
    const settled = await sendPlan(id, user.id);
    // friends who had already raised a hand can make it real the moment it is sent
    if (settled.becameReal) after(() => makeItReal(id).catch((e) => console.error("makeItReal failed:", e)));
    return getPlanView(id, user.id);
  });
}
