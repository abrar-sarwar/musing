import { json, requireUser } from "@/lib/http";
import { friendTopics, topOverlap } from "@/lib/recommend";
import type { Overlap } from "@/lib/types";

// friends overlap for the reels card. opted-in friends only, and it only ever returns a
// topic and a count, never who. the ranking lives in lib/recommend.ts, shared with the events feed.
export function GET() {
  return json(async (): Promise<{ overlap: Overlap }> => {
    const user = await requireUser();
    return { overlap: topOverlap(await friendTopics(user.id)) };
  });
}
