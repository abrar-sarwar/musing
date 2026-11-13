import { serverDb } from "@/lib/db/server";
import { eligible, topicsFor, type PublicEvent } from "@/lib/discover";
import type { FreeWindow, ReelsTopic } from "@/lib/types";
import { isDay, isFreeAt } from "@/lib/when";
import { affinityScore, EMPTY_AFFINITY, type Affinity } from "@/lib/feedback";

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
export type RecommendedEvent = { event: PublicEvent; because: Because; personal: number };
export type Viewer = { interests: string[]; free_windows: FreeWindow[] };

/**
 * every public event the viewer could go to, best first. the reels order, applied to events:
 * distinct opted-in friends into the event's topics, then their summed score. a topic below
 * FLOOR friends adds nothing, so a quiet friend never moves the list. after that the viewer's
 * own interests, then whether they are free then, then the catalog's curated order.
 */
export function recommendEvents(events: PublicEvent[], rows: ReelsTopic[], viewer: Viewer, affinity: Affinity = EMPTY_AFFINITY): RecommendedEvent[] {
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
      const hour = Number(event.when_time.slice(0, 2));
      const daypart = hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 22 ? "evening" : "night";
      const amount = event.price ?? 0;
      const price = amount === 0 ? "free" : amount <= 20 ? "low" : amount <= 50 ? "medium" : "high";
      const personal = affinityScore(affinity, event.tags, { area: event.area.trim().toLowerCase(), daypart, price });
      return { event, because, personal, count: friends.size, score: loud.reduce((n, x) => n + x.hit!.score, 0), interests: event.tags.filter((tag) => mine.has(tag)).length, free };
    })
    .sort((a, b) => b.personal - a.personal || byStrength(a, b) || b.interests - a.interests || Number(b.free) - Number(a.free) || (a.event.sort ?? 100) - (b.event.sort ?? 100) || a.event.id.localeCompare(b.event.id))
    .map(({ event, because, personal }) => ({ event, because, personal }));
}

// what doing this event together sounds like. the title is read first, since it is the most
// specific ("game night"), then the event's main topic. plain rules, no model call.
const BY_TITLE: Array<[RegExp, string]> = [
  [/game night|board game/, "let's host a game night"], [/karaoke/, "let's do karaoke"], [/trivia/, "let's do trivia night"],
  [/hike|trail/, "let's go on a hike"], [/swap/, "let's do a clothing swap"], [/watch party|screening|movie/, "let's do a movie night"],
  [/run club|5k/, "let's run it together"], [/open mic/, "let's hit an open mic"], [/potluck|dinner/, "let's host a dinner"],
];
const BY_TOPIC: Record<string, string> = {
  games: "let's host a game night", gaming: "let's host a gaming night", golf: "let's hit the golf course", thrifting: "let's go thrifting",
  fashion: "let's go hunt for fits", photography: "let's go on a photo walk", film: "let's do a movie night", music: "let's catch some live music",
  running: "let's go for a run together", fitness: "let's work out together", basketball: "let's run some pickup", soccer: "let's get a pickup game going",
  volleyball: "let's play some volleyball", tennis: "let's play some tennis", pickleball: "let's play pickleball", climbing: "let's go climbing",
  skate: "let's go skating", cycling: "let's go for a ride", outdoors: "let's get outside", food: "let's go eat", cooking: "let's cook together",
  coffee: "let's grab coffee", art: "let's make some art", crafts: "let's make something", tech: "let's build something", study: "let's study together",
  books: "let's start a book club", anime: "let's do an anime night", dance: "let's go dancing", volunteering: "let's volunteer together",
  plants: "let's go plant shopping", social: "let's go meet some people", home: "let's do a decor hunt", career: "let's go network",
  travel: "let's do a culture day", pets: "let's do a dog day", creators: "let's shoot some content", security: "let's do a ctf night",
  cozy: "let's do something cozy", sports: "let's play some ball",
};

/** "let's host a game night": the move this event suggests, from its title, then its topic */
export function pitchFor(e: Pick<PublicEvent, "title" | "tags">): string {
  const title = e.title.toLowerCase();
  return BY_TITLE.find(([rx]) => rx.test(title))?.[1] ?? e.tags.map((t) => BY_TOPIC[t]).find(Boolean) ?? "let's make a day of it";
}

/** the line on a recommended event. specific to the event; counts only, never who, never how we know. */
export function ruleLine(r: RecommendedEvent): string {
  const b = r.because;
  const why = b?.kind === "friends" ? `, and ${b.count} of your friends are into ${b.topic} lately` : b?.kind === "interest" ? `, right up your ${b.topic} alley` : b?.kind === "free" ? ", and you're free then" : "";
  return `${pitchFor(r.event)}. ${r.event.title.toLowerCase()} is ${r.event.when_text}${why}`;
}
