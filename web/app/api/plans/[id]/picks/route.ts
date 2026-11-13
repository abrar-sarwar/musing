import { addPick, removePick } from "@/lib/draft";
import { json, requireUser } from "@/lib/http";
import { getPlanView, PlanError } from "@/lib/plans";

// who a draft will ask, edited by its starter before anything is sent.
// POST { add: userId } or { remove: userId } -> the plan as the starter sees it
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return json(async () => {
    const { id } = await params;
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { add?: unknown; remove?: unknown };
    if (typeof body.add === "string" && body.add) await addPick(id, user.id, body.add);
    else if (typeof body.remove === "string" && body.remove) await removePick(id, user.id, body.remove);
    else throw new PlanError("expected { add } or { remove }");
    return getPlanView(id, user.id);
  });
}
