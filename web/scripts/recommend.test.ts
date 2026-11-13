// the events feed ranking. pnpm test:recommend
// pure: seed arrays, no database, no muse call. checks the reels rule carries over to events
// (distinct opted-in friends, then summed score, nothing below the floor) and that no line names anyone.
import { recommendEvents, ruleLine, topOverlap, FLOOR } from "@/lib/recommend";
import type { PublicEvent } from "@/lib/discover";
import { NEW_PUBLIC_EVENTS } from "@/lib/seed/catalog";
import { PUBLIC_EVENTS, USERS } from "@/lib/seed/data";
import type { ReelsTopic } from "@/lib/types";

const events: PublicEvent[] = [...PUBLIC_EVENTS.map((e, i) => ({ ...e, sort: i })), ...NEW_PUBLIC_EVENTS];
const row = (user_id: string, topic: string, score = 5): ReelsTopic => ({ user_id, topic, score });
const golfers = [row("a", "golf"), row("b", "golf"), row("c", "golf range", 2)];
const viewer = { interests: [], free_windows: [] };
const maya = USERS.find((u) => u.id === "maya")!;

const golfFirst = recommendEvents(events, golfers, viewer);
const twoGolfers = recommendEvents(events, golfers.slice(0, 2), viewer);
const mine = recommendEvents(events, [], maya);
const names = USERS.map((u) => u.name.split(" ")[0]!.toLowerCase());

const cases: Array<[string, unknown, unknown]> = [
  ["reels card: top topic at the floor", JSON.stringify(topOverlap(golfers.map((r) => ({ ...r, topic: "golf" })))), JSON.stringify({ topic: "golf", count: 3 })],
  ["reels card: silent below the floor", topOverlap(golfers.slice(0, FLOOR - 1)), null],
  ["reels card: friends beat score", topOverlap([row("a", "x", 1), row("b", "x", 1), row("c", "x", 1), row("a", "y", 50), row("b", "y", 50)])?.topic, "x"],
  ["three golfers: golf event first", golfFirst[0]?.event.id, "twilight-golf"],
  ["three golfers: count, not names", JSON.stringify(golfFirst[0]?.because), JSON.stringify({ kind: "friends", topic: "golf", count: 3 })],
  ["two golfers: no friend reason anywhere", twoGolfers.some((r) => r.because?.kind === "friends"), false],
  ["cancelled events never recommended", golfFirst.some((r) => r.event.status === "cancelled"), false],
  ["every eligible event is in the feed", golfFirst.length, events.filter((e) => (e.status ?? "scheduled") === "scheduled").length],
  ["own interests lead without friends", mine[0]?.because?.kind, "interest"],
  ["golf line", ruleLine(golfFirst[0]!), "lowkey this could be fun to set up. 3 of your friends are into golf lately"],
  ["no line names a person", golfFirst.concat(mine).map(ruleLine).some((l) => names.some((n) => new RegExp(`\\b${n}\\b`).test(l))), false],
];
let bad = 0;
for (const [name, got, want] of cases) if (got !== want) { bad++; console.log("MISMATCH", name, "->", got, "wanted", want); }
console.log(`${cases.length - bad}/${cases.length} recommendation rules as expected`);
if (bad) process.exit(1);
