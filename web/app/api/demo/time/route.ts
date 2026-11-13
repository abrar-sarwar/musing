import { getDemoClock, setDemoOffset } from "@/lib/demoTime";
import { json, requireAdmin, requireUser } from "@/lib/http";
import { PlanError } from "@/lib/plans";
import { eventsFor } from "@/lib/hangouts";

export function GET() {
  return json(getDemoClock);
}

// POST { offsetSeconds } changes only Musing's server-authoritative demo clock.
export function POST(req: Request) {
  return json(async () => {
    requireAdmin(req);
    const body = (await req.json().catch(() => ({}))) as { offsetSeconds?: unknown; action?: unknown };
    if (body.action === "next_feedback") {
      const user = await requireUser();
      const response = await eventsFor(user.id);
      const now = Date.parse(response.demoClock.now);
      const target = response.events
        .filter((event) => event.rsvp === "going" && event.completesAt && Date.parse(event.completesAt) > now)
        .map((event) => Date.parse(event.completesAt!))
        .sort((a, b) => a - b)[0];
      if (!target) throw new PlanError("no upcoming Going hangout to complete", 409);
      return setDemoOffset(response.demoClock.offsetSeconds + Math.ceil((target - now) / 1000) + 1);
    }
    if (!Number.isInteger(body.offsetSeconds)) throw new PlanError("expected an integer offsetSeconds");
    return setDemoOffset(body.offsetSeconds as number);
  });
}
