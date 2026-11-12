import { voteOnProposal } from "@/lib/chat";
import { json, requireUser } from "@/lib/http";
import { PlanError } from "@/lib/plans";

// agree or disagree with a proposed plan change. POST { vote: "yes" | "no" }.
// only people who are going can vote. the plan moves only when all of them agree.
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return json(async () => {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { vote?: unknown };
    if (body.vote !== "yes" && body.vote !== "no") throw new PlanError("vote must be yes or no");
    return voteOnProposal((await params).id, user.id, body.vote);
  });
}
