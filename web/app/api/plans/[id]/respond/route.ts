import { after } from "next/server";
import { json, requireUser } from "@/lib/http";
import { getPlanView, makeItReal, PlanError, respond } from "@/lib/plans";

// POST { status: "down" | "maybe" | "out" }. the answer is private. only the count moves.
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return json(async () => {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { status?: unknown };
    if (body.status !== "down" && body.status !== "maybe" && body.status !== "out") throw new PlanError("status must be down, maybe or out");
    const user = await requireUser();
    const settled = await respond(id, user.id, body.status);
    // quorum: write the chat, the card and the event after this response goes out
    if (settled.becameReal) after(() => makeItReal(id).catch((e) => console.error("makeItReal failed:", e)));
    return getPlanView(id, user.id);
  });
}
