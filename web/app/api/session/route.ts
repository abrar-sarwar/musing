import { DEMO_ORDER } from "@/lib/constants";
import { json } from "@/lib/http";
import { PlanError } from "@/lib/plans";
import { signUser } from "@/lib/user";

// the demo's identity boundary. POST { userId, passcode } -> { token }.
// on a deployed server every request must carry a token from here (x-musing-token);
// a bare x-musing-user header is not believed. the passcode is shared with whoever
// runs the demo. this is not real login: it stops strangers from acting as a seeded person.
export function POST(req: Request) {
  return json(async () => {
    const body = (await req.json().catch(() => ({}))) as { userId?: unknown; passcode?: unknown };
    const passcode = process.env.DEMO_PASSCODE;
    if (!passcode || !process.env.DEMO_SECRET) throw new PlanError("sessions are not set up on this server", 404);
    if (typeof body.userId !== "string" || !/^[a-z]{2,20}$/.test(body.userId) || body.passcode !== passcode) throw new PlanError("not allowed", 403);
    return { token: signUser(body.userId), demoOrder: DEMO_ORDER };
  });
}
