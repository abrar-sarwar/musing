import { after } from "next/server";
import { json, requireUser } from "@/lib/http";
import { cancelPlan, getPlanView, makeItReal } from "@/lib/plans";

type Ctx = { params: Promise<{ id: string }> };

export function GET(_req: Request, { params }: Ctx) {
  return json(async () => {
    const { id } = await params;
    const view = await getPlanView(id, (await requireUser()).id);
    // it's on but the chat never got made (muse or the database failed mid-way): try again.
    // makeItReal claims the work first, so this can never make a second chat.
    if (view.state === "happening" && view.museOn && !view.threadId) after(() => makeItReal(id).catch((e) => console.error("makeItReal retry failed:", e)));
    return view;
  });
}

// starter only: "not this" on a draft, or calling it off before it's real
export function DELETE(_req: Request, { params }: Ctx) {
  return json(async () => {
    await cancelPlan((await params).id, (await requireUser()).id);
    return { ok: true };
  });
}
