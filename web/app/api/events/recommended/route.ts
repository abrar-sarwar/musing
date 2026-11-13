import { catalog } from "@/lib/discover";
import { json, requireUser } from "@/lib/http";
import { friendTopics, recommendEvents, ruleLine } from "@/lib/recommend";
import { affinityFor } from "@/lib/hangouts";

const PICKS = 6; // the "for you" strip. everything else is the plain feed, in the same order.

// the events feed, ranked for this person. GET -> { events: [{ eventId, line, friendCount }] }
// every public event they could go to, best first, by the reels rule (lib/recommend.ts). the top
// few carry a line written by rule, with no model call. friendCount is only ever 3 or more, and never says who.
export function GET() {
  return json(async () => {
    const user = await requireUser();
    const [c, rows, affinity] = await Promise.all([catalog(), friendTopics(user.id), affinityFor(user.id)]);
    return {
      events: recommendEvents(c.events, rows, user, affinity).map((r, i) => ({
        eventId: r.event.id,
        line: i < PICKS ? (r.personal > 0 ? "more like hangouts you enjoyed" : ruleLine(r)) : null,
        friendCount: r.because?.kind === "friends" ? r.because.count : null,
      })),
    };
  });
}
