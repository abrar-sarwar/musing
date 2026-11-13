import { after } from "next/server";
import { json, requireUser } from "@/lib/http";
import { getPlanView, makeItReal, sendPlan, type SendChoices } from "@/lib/plans";
import { expiresAt, parseAudience, parseWaitFor } from "@/lib/signals";

// the starter sends the draft: the signal becomes visible to the audience they chose and
// each friend on it gets a private ask. POST { audience?, waitFor?, expires? }: the choices
// made on the draft. a body without them sends the draft as it was made (older app builds).
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return json(async () => {
    const { id } = await params;
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { audience?: unknown; waitFor?: unknown; expires?: unknown };
    const choices: SendChoices | undefined =
      body.audience === undefined ? undefined : { audience: parseAudience(body.audience), waitFor: parseWaitFor(body.waitFor), expiresAt: expiresAt(body.expires, new Date()) };
    const settled = await sendPlan(id, user.id, choices);
    // friends who had already raised a hand can make it real the moment it is sent
    if (settled.becameReal) after(() => makeItReal(id).catch((e) => console.error("makeItReal failed:", e)));
    return getPlanView(id, user.id);
  });
}
