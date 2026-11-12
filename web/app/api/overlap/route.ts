import { serverDb } from "@/lib/db/server";
import { json, requireUser } from "@/lib/http";
import type { Overlap } from "@/lib/types";

const FLOOR = 3; // below this, a count could point at a person. so it stays silent.

// friends overlap for the reels card. computed in sql, opted-in friends only,
// and it only ever returns a topic and a count. never who.
export function GET() {
  return json(async (): Promise<{ overlap: Overlap }> => {
    const user = await requireUser();
    const { data, error } = await serverDb().rpc("reels_overlap_top", { p_user: user.id });
    if (error) throw new Error(`overlap: ${error.message}`);
    const row = (data as Array<{ topic: string; friend_count: number }> | null)?.[0];
    if (!row || row.friend_count < FLOOR) return { overlap: null };
    return { overlap: { topic: row.topic, count: row.friend_count } };
  });
}
