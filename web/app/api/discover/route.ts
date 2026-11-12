import { serverDb } from "@/lib/db/server";
import { catalog, getRelatedOpportunities, type OpportunityKind } from "@/lib/discover";
import { json, requireUser } from "@/lib/http";

// the fictional catalog (public events, groups, listings) plus what this person saved
// or joined. GET /api/discover. with ?kind=&id= it also returns what relates to one record.
// memberships of other people are never part of this.
export function GET(req: Request) {
  return json(async () => {
    const user = await requireUser();
    const c = await catalog();
    const { data: saved, error } = await serverDb().from("saved_items").select("kind,ref_id").eq("user_id", user.id);
    if (error) throw new Error(`saved_items: ${error.message}`);
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind");
    const id = url.searchParams.get("id");
    const related = id && (kind === "event" || kind === "group" || kind === "listing") ? await getRelatedOpportunities(kind as OpportunityKind, id) : null;
    return { events: c.events, groups: c.groups, listings: c.listings, saved: (saved ?? []).map((s) => `${s.kind}:${s.ref_id}`), related };
  });
}
