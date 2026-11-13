import { json, requireUser } from "@/lib/http";
import { PlanError } from "@/lib/plans";
import { parseRules } from "@/lib/schedule";
import { saveRules, scheduleOf } from "@/lib/scheduleStore";

// a person's own schedule, the starting point muse plans from. only ever the acting person's own.
// GET -> { rules, windows }. PUT { rules } replaces the rules (this is what "Edit" on one card saves).
// rules are what the person sees and edits; windows are the weekly free time those rules
// come to right now, which is what every planner reads.
export function GET() {
  return json(async () => scheduleOf(await requireUser()));
}

export function PUT(req: Request) {
  return json(async () => {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { rules?: unknown };
    const rules = parseRules(body.rules);
    if (typeof rules === "string") throw new PlanError(rules);
    return saveRules(user.id, rules);
  });
}
