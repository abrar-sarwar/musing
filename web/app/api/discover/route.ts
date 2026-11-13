import { serverDb } from "@/lib/db/server";
import { catalog, eligible, getRelatedOpportunities } from "@/lib/discover";
import { json, requireUser } from "@/lib/http";
import { affinityFor } from "@/lib/hangouts";
import { affinityScore, rankPassive } from "@/lib/feedback";

// the fictional catalog (public events, groups, listings, reels) plus what this person saved
// or joined. GET /api/discover. with ?kind=&id= it also returns what relates to one record.
// memberships of other people are never part of this.
export function GET(req: Request) {
  return json(async () => {
    const user = await requireUser();
    const db = serverDb();
    const [{ data: saved, error }, { data: memberships }, affinity] = await Promise.all([
      db.from("saved_items").select("kind,ref_id").eq("user_id", user.id),
      db.from("group_members").select("group_id").eq("user_id", user.id),
      affinityFor(user.id),
    ]);
    if (error) throw new Error(`saved_items: ${error.message}`);
    // only what this person could act on: no cancelled events, no sold or pending listings,
    // and a private group only when they are in it
    const c = eligible(await catalog(), (memberships ?? []).map((m) => m.group_id as string));
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind");
    const id = url.searchParams.get("id");
    const related = id && (kind === "event" || kind === "group" || kind === "listing" || kind === "reel") ? await getRelatedOpportunities(kind, id) : null;
    const price = (amount: number) => amount === 0 ? "free" : amount <= 20 ? "low" : amount <= 50 ? "medium" : "high";
    const groups = rankPassive(c.groups, (g) => affinityScore(affinity, g.tags, { area: g.area.trim().toLowerCase() }));
    const listings = rankPassive(c.listings, (l) => affinityScore(affinity, l.tags, { area: l.place.split(",")[0]!.trim().toLowerCase(), price: price(l.price) }));
    const reels = rankPassive(c.reels, (r) => affinityScore(affinity, r.tags));
    return { events: c.events, groups, listings, reels, saved: (saved ?? []).map((s) => `${s.kind}:${s.ref_id}`), related };
  });
}
