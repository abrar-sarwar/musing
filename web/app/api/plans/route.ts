import { cleanText, json, requireUser } from "@/lib/http";
import { createPoll, PlanError } from "@/lib/plans";
import { getSettings } from "@/lib/settings";
import { expiresAt, parseAudience, parseWaitFor } from "@/lib/signals";

// muse off: POST { text } makes a plain poll. this is what's left without muse.
export function POST(req: Request) {
  return json(async () => {
    const body = (await req.json().catch(() => ({}))) as { text?: unknown; audience?: unknown; waitFor?: unknown; expires?: unknown };
    const text = cleanText(body.text, 280);
    if (!text || text.length < 2) throw new PlanError("say a little more (2 to 280 characters)");
    const user = await requireUser();
    if ((await getSettings()).muse_on) throw new PlanError("muse is on. send the thought to muse instead.", 409);
    return { ok: true, planId: await createPoll(user.id, text, { audience: body.audience === undefined ? "muse" : parseAudience(body.audience), waitFor: parseWaitFor(body.waitFor), expiresAt: expiresAt(body.expires, new Date()) }) };
  });
}
