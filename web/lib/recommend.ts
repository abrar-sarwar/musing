import { serverDb } from "@/lib/db/server";
import { eligible, topicsFor, type PublicEvent } from "@/lib/discover";
import type { FreeWindow, ReelsTopic } from "@/lib/types";
import { isDay, isFreeAt } from "@/lib/when";

// the reels rule, in one place: what opted-in friends are into, counted by distinct friends
// first and summed score second, and never surfaced below FLOOR friends. the reels card asks
// it for the top topic; the events feed asks it which public events those topics point at.
// only counts ever leave this file. never who.

export const FLOOR = 3; // below this, a count could point at a person. so it stays silent.

export type Tally = Map<string, { friends: Set<string>; score: number }>;

/** opted-in friends' reels topics. empty unless the viewer opted in too, as on the reels card. */
export async function friendTopics(userId: string): Promise<ReelsTopic[]> {
  const db = serverDb();
  const [{ data: me }, { data: edges }] = await Promise.all([
    db.from("users").select("reels_opt_in").eq("id", userId).maybeSingle(),
    db.from("friendships").select("friend_id").eq("user_id", userId),
  ]);
  if (!me?.reels_opt_in || !edges || edges.length === 0) return [];
  const { data: friends } = await db.from("users").select("id").in("id", edges.map((e) => e.friend_id as string)).eq("reels_opt_in", true);
  const ids = (friends ?? []).map((f) => f.id as string);
  if (ids.length === 0) return [];
  const { data, error } = await db.from("reels_topics").select("user_id,topic,score").in("user_id", ids);
  if (error) throw new Error(`reels topics: ${error.message}`);
  return (data ?? []) as ReelsTopic[];
}

/** friends and summed score per key. `keysOf` maps a reels topic to the keys it counts toward. */
export function tally(rows: ReelsTopic[], keysOf: (topic: string) => string[] = (t) => [t]): Tally {
  const out: Tally = new Map();
  for (const r of rows) {
    for (const key of new Set(keysOf(r.topic))) {
      const t = out.get(key) ?? { friends: new Set<string>(), score: 0 };
      t.friends.add(r.user_id);
      t.score += r.score;
      out.set(key, t);
    }
  }
  return out;
}

const byStrength = (a: { count: number; score: number }, b: { count: number; score: number }) => b.count - a.count || b.score - a.score;

/** the reels card: the one topic most opted-in friends share, or null below the floor */
export function topOverlap(rows: ReelsTopic[]): { topic: string; count: number } | null {
  const best = [...tally(rows)].map(([topic, t]) => ({ topic, count: t.friends.size, score: t.score })).sort((a, b) => byStrength(a, b) || a.topic.localeCompare(b.topic))[0];
  return best && best.count >= FLOOR ? { topic: best.topic, count: best.count } : null;
}

/** a reels topic in catalog terms ("vintage popups" -> thrifting). a topic no key covers stays itself. */
export const topicKeys = (topic: string): string[] => {
  const keys = topicsFor(topic);
  return keys.length > 0 ? keys : [topic.toLowerCase()];
};

/** why an event was recommended. a friend count is only ever FLOOR or more. */
export type Because = { kind: "friends"; topic: string; count: number } | { kind: "interest"; topic: string } | { kind: "free" } | null;
export type RecommendedEvent = { event: PublicEvent; because: Because };
export type Viewer = { interests: string[]; free_windows: FreeWindow[] };

/**
 * every public event the viewer could go to, best first. the reels order, applied to events:
 * distinct opted-in friends into the event's topics, then their summed score. a topic below
 * FLOOR friends adds nothing, so a quiet friend never moves the list. after that the viewer's
 * own interests, then whether they are free then, then the catalog's curated order.
 */
export function recommendEvents(events: PublicEvent[], rows: ReelsTopic[], viewer: Viewer): RecommendedEvent[] {
  const t = tally(rows, topicKeys);
  const mine = new Set(topicsFor(...viewer.interests));
  const pool = eligible({ events, groups: [], listings: [], reels: [] }).events;
  return pool
    .map((event) => {
      const loud = event.tags.map((tag) => ({ tag, hit: t.get(tag) })).filter((x) => x.hit && x.hit.friends.size >= FLOOR);
      const friends = new Set(loud.flatMap((x) => [...x.hit!.friends]));
      const top = loud.map((x) => ({ topic: x.tag, count: x.hit!.friends.size, score: x.hit!.score })).sort(byStrength)[0];
      const interest = event.tags.find((tag) => mine.has(tag));
      const free = isDay(event.when_day) && isFreeAt(viewer.free_windows, event.when_day, event.when_time);
      const because: Because = top ? { kind: "friends", topic: top.topic, count: friends.size } : interest ? { kind: "interest", topic: interest } : free ? { kind: "free" } : null;
      return { event, because, count: friends.size, score: loud.reduce((n, x) => n + x.hit!.score, 0), interests: event.tags.filter((tag) => mine.has(tag)).length, free };
    })
    .sort((a, b) => byStrength(a, b) || b.interests - a.interests || Number(b.free) - Number(a.free) || (a.event.sort ?? 100) - (b.event.sort ?? 100) || a.event.id.localeCompare(b.event.id))
    .map(({ event, because }) => ({ event, because }));
}

/** the line on a recommended event. counts only, never who, never how we know. */
export function ruleLine(r: RecommendedEvent): string {
  const b = r.because;
  if (b?.kind === "friends") return `lowkey this could be fun to set up. ${b.count} of your friends are into ${b.topic} lately`;
  if (b?.kind === "interest") return `you're into ${b.topic}. lowkey this could be fun to set up`;
  if (b?.kind === "free") return `you're free ${r.event.when_text}. lowkey this could be fun to set up`;
  return "lowkey this could be fun to set up with a few friends";
}
