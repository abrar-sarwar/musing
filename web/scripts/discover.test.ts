// demo coverage check for opportunity discovery. pnpm test:discover
// runs each thought through the same discover() the match route calls, against the seed
// arrays (no database, no muse call, nothing billed). every case is checked two ways:
//   relevance: the kinds of record a person would expect come back, on the right topic
//   rules: ids are real seed ids, nothing cancelled / sold / pending / private is returned,
//          every event is at a time the starter is free, limits and budgets hold
import { discover, eligible, readIntent, setCatalog, type Catalog } from "@/lib/discover";
import { NEW_GROUP_MEMBERS, NEW_GROUPS, NEW_LISTINGS, NEW_PUBLIC_EVENTS, NEW_REELS } from "@/lib/seed/catalog";
import { GROUPS, LISTINGS, PUBLIC_EVENTS, USERS } from "@/lib/seed/data";
import { isFreeAt, type Day } from "@/lib/when";

const all: Catalog = {
  events: [...PUBLIC_EVENTS.map((e, i) => ({ ...e, sort: i })), ...NEW_PUBLIC_EVENTS],
  groups: [...GROUPS.map((g, i) => ({ ...g, sort: i })), ...NEW_GROUPS],
  listings: [...LISTINGS.map((l, i) => ({ ...l, cover: `market/${l.id}.jpg`, sort: i })), ...NEW_LISTINGS],
  reels: NEW_REELS,
};
setCatalog(all);

const maya = USERS.find((u) => u.id === "maya")!;
const NOW = new Date("2026-11-12T15:00:00"); // a thursday afternoon, so "tonight" is thursday

type Want = {
  /** at least one returned event / group / listing carries one of these tags */
  event?: string[]; group?: string[]; listing?: string[];
  /** these lists must be empty */
  none?: Array<"events" | "groups" | "listings">;
  /** every returned event is on one of these days / free / at night; every listing at or under this price */
  days?: string[]; freeOnly?: boolean; night?: boolean; maxPrice?: number;
  /** this id must be the first result of its kind */
  firstEvent?: string; firstListing?: string;
};
const CASES: Array<[text: string, want: Want]> = [
  // the 30 from the brief
  // the rehearsed demo line must keep finding what it always found
  ["kinda wanna go thrifting this weekend but idk who'd be into it", { event: ["thrifting"], group: ["thrifting"], listing: ["thrifting"], firstEvent: "vintage-popup", firstListing: "denim" }],
  ["i wanna thrift this weekend", { event: ["thrifting"], group: ["thrifting"], listing: ["thrifting"] }],
  ["anyone down for basketball", { event: ["basketball"], group: ["basketball"], listing: ["basketball"] }],
  ["i wanna learn an instrument", { event: ["music"], group: ["music"], listing: ["instrument"] }],
  ["something free to do", { event: ["weekend"], freeOnly: true }],
  ["i want new clothes", { event: ["fashion"], listing: ["fashion"] }],
  ["i'm bored tonight", { event: ["weekend"], night: true }],
  ["i wanna get into ai", { event: ["tech"], group: ["tech"] }],
  ["who wants to play volleyball", { event: ["volleyball"], group: ["volleyball"], listing: ["volleyball"] }],
  ["i wanna go to a concert", { event: ["music"], group: ["music"] }],
  ["i wanna do photography", { event: ["photography"], group: ["photography"], listing: ["camera"] }],
  ["i need a cheap monitor", { listing: ["monitor"], firstListing: "monitor-24", none: ["events"] }],
  ["i wanna go camping", { event: ["camping"], group: ["outdoors"], listing: ["camping"], firstEvent: "camping-101" }],
  ["something fun for introverts", { event: ["cozy"], group: ["cozy"] }],
  ["i wanna meet other gamers", { event: ["gaming"], group: ["gaming"] }],
  ["i need a study group", { event: ["study"], group: ["study"], firstEvent: "sunday-study-hall" }],
  ["i wanna learn salsa", { event: ["dance"], group: ["dance"] }],
  ["i'm looking for a camera", { listing: ["camera"], group: ["photography"] }],
  ["any volunteer opportunities", { event: ["volunteering"], group: ["volunteering"] }],
  ["what can i do on sunday", { event: ["weekend"], days: ["sun"] }],
  ["i wanna join a book club", { event: ["books"], group: ["books"], firstEvent: "book-club-short-novels" }],
  ["any anime events", { event: ["anime"], group: ["anime"], listing: ["anime"] }],
  ["i wanna go running", { group: ["running"], listing: ["running"] }],
  ["i need a guitar", { listing: ["guitar"], group: ["music"] }],
  ["anything happening with cybersecurity", { event: ["security"], group: ["security"], listing: ["security"] }],
  ["i wanna do something creative", { event: ["art", "crafts"], group: ["art", "crafts"] }],
  ["let's have a game night", { event: ["games", "gaming"], group: ["games", "gaming"], listing: ["games", "gaming"] }],
  ["i wanna meet people who like music", { event: ["music"], group: ["music"] }],
  ["anything involving pets", { event: ["pets"], group: ["pets"], listing: ["pets"] }],
  ["i wanna learn cooking", { event: ["cooking"], group: ["cooking"], listing: ["cooking"] }],
  ["cheap fun activities with friends", { event: ["weekend"] }],
  // how a judge might actually type it
  ["i'm bored this weekend", { event: ["weekend"] }],
  ["anyone tryna hoop", { event: ["basketball"], group: ["basketball"] }],
  ["i wanna learn guitar but i'm broke", { event: ["guitar"], listing: ["guitar"], firstListing: "beginner-acoustic-guitar", maxPrice: 200 }],
  ["i need a cheap fit", { listing: ["fashion"], event: ["fashion"] }],
  ["lowkey wanna go hiking", { event: ["hiking"], group: ["hiking"], listing: ["hiking"], firstEvent: "waterfall-hike" }],
  ["i need to meet people", { event: ["social"], group: ["social"], firstEvent: "new-in-town-kickback" }],
  ["what can i do for free", { event: ["weekend"], freeOnly: true }],
  ["i wanna get into coding", { event: ["tech"], group: ["tech"], listing: ["coding"] }],
  ["anyone wanna play games", { event: ["games", "gaming"], group: ["games", "gaming"] }],
  ["i wanna take cute pictures", { event: ["photography"], group: ["photography"] }],
  ["i need a study buddy", { event: ["study"], group: ["study"] }],
  ["i'm trying to learn to cook", { event: ["cooking"], group: ["cooking"] }],
  ["any fun stuff on sunday", { event: ["weekend"], days: ["sun"] }],
  ["what's something fun at night", { event: ["weekend"], night: true }],
  ["i need a camera on a budget", { listing: ["camera"], firstListing: "instant-camera" }],
  ["i wanna make new friends through music", { event: ["music"], group: ["music"] }],
  ["i wanna volunteer", { event: ["volunteering"], group: ["volunteering"] }],
  ["i'm into anime", { event: ["anime"], group: ["anime"] }],
  ["anyone down for pickleball", { event: ["pickleball"], group: ["pickleball"], listing: ["pickleball"] }],
  ["something fun to do without spending much", { event: ["weekend"] }],
  ["i wanna get into photography but cameras are expensive", { event: ["photography"], group: ["photography"], listing: ["camera"] }],
  ["build a concert outfit under $50", { listing: ["fashion"], maxPrice: 50 }],
  ["my apartment looks empty", { group: ["home"], listing: ["home"] }],
  ["coffee crawl with friends", { event: ["coffee"], group: ["coffee"] }],
  // nothing in the catalog fits. the honest answer is nothing, not something forced.
  ["i wanna go skydiving", { none: ["events", "groups", "listings"] }],
  ["need to get my taxes done", { none: ["events", "groups", "listings"] }],
];

const eventIds = new Set(all.events.map((e) => e.id));
const groupIds = new Set(all.groups.map((g) => g.id));
const listingIds = new Set(all.listings.map((l) => l.id));
const open = eligible(all);
const okEvent = new Set(open.events.map((e) => e.id));
const okGroup = new Set(open.groups.map((g) => g.id));
const okListing = new Set(open.listings.map((l) => l.id));

async function main() {
  let relevant = 0;
  let broken = 0;
  for (const [text, want] of CASES) {
    const found = await discover({ text, activity: "", budgetHint: "", starterFree: maya.free_windows, context: null, interests: maya.interests, now: NOW });
    const miss: string[] = [];
    const rule: string[] = [];
    const has = (rows: Array<{ tags: string[] }>, tags: string[]) => rows.some((r) => r.tags.some((t) => tags.includes(t)));
    if (want.event && !has(found.events, want.event)) miss.push(`no ${want.event.join("/")} event`);
    if (want.group && !has(found.groups, want.group)) miss.push(`no ${want.group.join("/")} group`);
    if (want.listing && !has(found.listings, want.listing)) miss.push(`no ${want.listing.join("/")} listing`);
    for (const k of want.none ?? []) if (found[k].length > 0) miss.push(`expected no ${k}, got ${found[k].map((r) => r.id).join(",")}`);
    if (want.firstEvent && found.events[0]?.id !== want.firstEvent) miss.push(`first event ${found.events[0]?.id ?? "none"}, wanted ${want.firstEvent}`);
    if (want.firstListing && found.listings[0]?.id !== want.firstListing) miss.push(`first listing ${found.listings[0]?.id ?? "none"}, wanted ${want.firstListing}`);
    if (want.days && found.events.some((e) => !want.days!.includes(e.when_day))) miss.push("an event on the wrong day");
    if (want.freeOnly && found.events.some((e) => (e.price ?? 0) > 0)) miss.push("a paid event for a free ask");
    if (want.night && found.events.some((e) => e.when_time < "17:00")) miss.push("a daytime event for a night ask");
    if (want.maxPrice !== undefined && found.listings.some((l) => l.price > want.maxPrice!)) miss.push("a listing over the price");

    // the rules hold for every thought, whatever it asked for
    for (const e of found.events) {
      if (!eventIds.has(e.id)) rule.push(`event ${e.id} is not in the seed`);
      if (!okEvent.has(e.id)) rule.push(`event ${e.id} is cancelled`);
      if (!isFreeAt(maya.free_windows, e.when_day as Day, e.when_time)) rule.push(`event ${e.id} is when the starter is busy`);
    }
    for (const g of found.groups) {
      if (!groupIds.has(g.id)) rule.push(`group ${g.id} is not in the seed`);
      if (!okGroup.has(g.id)) rule.push(`group ${g.id} is private`);
    }
    for (const l of found.listings) {
      if (!listingIds.has(l.id)) rule.push(`listing ${l.id} is not in the seed`);
      if (!okListing.has(l.id)) rule.push(`listing ${l.id} is sold or pending`);
    }
    if (found.events.length > 3 || found.groups.length > 2 || found.listings.length > 4) rule.push("over the limit");
    const budget = readIntent(text).budget;
    if (budget !== null && found.listings.some((l) => l.price > budget)) rule.push("a listing over the stated budget");

    if (miss.length === 0) relevant++;
    if (rule.length > 0) broken++;
    const ids = `e[${found.events.map((e) => e.id).join(", ")}] g[${found.groups.map((g) => g.id).join(", ")}] l[${found.listings.map((l) => `${l.id} $${l.price}`).join(", ")}]`;
    console.log(`${rule.length > 0 ? "RULE" : miss.length > 0 ? "MISS" : "ok  "}  "${text}"\n        ${ids}${[...rule, ...miss].map((m) => `\n        -> ${m}`).join("")}`);
  }

  // a private group is found only by a member; a context that is not a real record is refused
  const noor = await discover({ text: "any leads on the peachtree state housing board, need a place to study", activity: "", budgetHint: "", starterFree: [], context: null, memberOf: ["peachtree-housing-board"] });
  const stranger = await discover({ text: "any leads on the peachtree state housing board, need a place to study", activity: "", budgetHint: "", starterFree: [], context: null });
  const privateOk = noor.groups.some((g) => g.id === "peachtree-housing-board") && !stranger.groups.some((g) => g.id === "peachtree-housing-board");
  console.log(`${privateOk ? "ok  " : "RULE"}  a private group shows for a member and nobody else`);
  // starting from a reel pulls in what the reel is about
  const fromReel = await discover({ text: "this could be us", activity: "", budgetHint: "", starterFree: maya.free_windows, context: { kind: "reel", id: "hoops-highlights" }, now: NOW });
  const reelOk = fromReel.events.some((e) => e.tags.includes("basketball"));
  console.log(`${reelOk ? "ok  " : "MISS"}  a thought started from the basketball reel finds basketball`);

  const counts = { events: NEW_PUBLIC_EVENTS.length, groups: NEW_GROUPS.length, listings: NEW_LISTINGS.length, reels: NEW_REELS.length };
  const total = counts.events + counts.groups + counts.listings + counts.reels;
  const linked = NEW_PUBLIC_EVENTS.every((e) => !e.group_id || groupIds.has(e.group_id)) && NEW_GROUP_MEMBERS.every(([g, u]) => groupIds.has(g) && USERS.some((x) => x.id === u)) && NEW_LISTINGS.every((l) => USERS.some((u) => u.id === l.seller_id));
  const unique = new Set([...all.events, ...all.groups, ...all.listings, ...all.reels].map((r) => r.id)).size === all.events.length + all.groups.length + all.listings.length + all.reels.length;
  console.log(`\nnew records: ${counts.events} events + ${counts.groups} groups + ${counts.listings} listings + ${counts.reels} reels = ${total}`);
  console.log(`links valid: ${linked}   ids unique: ${unique}`);
  console.log(`relevance: ${relevant}/${CASES.length} thoughts (${Math.round((100 * relevant) / CASES.length)}%)   rule breaks: ${broken}`);
  const pass = relevant / CASES.length >= 0.9 && broken === 0 && privateOk && reelOk && linked && unique && total === 200 && counts.events === 55 && counts.groups === 45 && counts.listings === 80 && counts.reels === 20;
  process.exit(pass ? 0 : 1);
}
main();
