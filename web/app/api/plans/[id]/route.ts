import { json, requireUser } from "@/lib/http";
import { cancelPlan, getPlanView } from "@/lib/plans";

type Ctx = { params: Promise<{ id: string }> };

export function GET(_req: Request, { params }: Ctx) {
  return json(async () => getPlanView((await params).id, (await requireUser()).id));
}

// starter only: "not this" on a draft, or calling it off before it's real
export function DELETE(_req: Request, { params }: Ctx) {
  return json(async () => {
    await cancelPlan((await params).id, (await requireUser()).id);
    return { ok: true };
  });
}
