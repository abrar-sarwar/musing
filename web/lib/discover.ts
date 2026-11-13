import { serverDb } from "@/lib/db/server";
import type { FreeWindow } from "@/lib/types";
import { isDay, isFreeAt } from "@/lib/when";

// opportunity discovery. plain, fast lookups over the fictional catalog (public events,
// groups, marketplace listings, reels). these run before muse is called: muse only ever
// chooses among the few records returned here, and every id it writes is checked against them.
// order of work: eligibility first (free then, not cancelled, not sold, not private), then
// relevance (topics, the nouns in the ask, money, time of day), then a small limit.

export type PublicEvent = {
  id: string; title: string; description: string; when_day: string; when_time: string; when_text: string; area: string; tags: string[]; organizer: string; capacity: number | null; group_id: string | null; cover: string | null;
  category?: string | null; end_time?: string | null; timezone?: string; price?: number; online?: boolean; status?: string; sort?: number;
};
export type Group = { id: string; name: string; description: string; tags: string[]; area: string; cover: string | null; member_count: number; activity: string[]; category?: string | null; visibility?: string; sort?: number };
export type Listing = { id: string; title: string; price: number; category: string; place: string; tags: string[]; seller_id: string; description?: string | null; condition?: string | null; status?: string; cover?: string | null; sort?: number };
/** a fictional creator's clip. catalog content, not anyone's viewing history. */
export type Reel = { id: string; topic: string; title: string; caption: string; creator: string; pitch: string; tags: string[]; poster: string | null; sort?: number };

export type OpportunityKind = "event" | "group" | "listing";
/** where a thought started, when it didn't start from the composer */
export type SignalContext = { kind: OpportunityKind | "reel"; id: string };
export type Candidates = { events: PublicEvent[]; groups: Group[]; listings: Listing[] };
export type Catalog = Candidates & { reels: Reel[] };

// topic keys and the words that point at them. catalog rows are tagged with the keys.
// a plain word matches as a whole word (plural allowed), "thrift*" matches any word that
// starts that way, and a phrase matches as written.
const TOPICS: Record<string, string[]> = {
  thrifting: ["thrift*", "vintage", "secondhand", "second hand", "flea", "clothing swap", "swap", "denim", "jacket", "upcycl*", "resale"],
  fashion: ["fit", "outfit", "clothes", "clothing", "streetwear", "sneaker", "style", "fashion", "wear", "jeans", "shoes", "accessories", "wardrobe"],
  home: ["room", "makeover", "furniture", "decor", "apartment", "bedroom", "redecorat*", "dorm", "desk", "lamp", "bookshelf", "rug", "furnish*"],
  photography: ["photo*", "camera", "35mm", "film photo*", "film camera", "golden hour", "pictures", "pics", "shoot", "tripod", "lens", "portrait"],
  film: ["movie", "cinema", "screening", "film", "watch party", "documentary"],
  games: ["board game", "boardgame", "game night", "games", "tabletop", "trivia", "puzzle", "card game"],
  gaming: ["video game", "gaming", "gamer", "console", "mario kart", "smash", "esports", "controller", "game night", "games", "play games", "playstation", "xbox"],
  music: ["music", "concert", "gig", "band", "jam", "guitar", "instrument", "piano", "vinyl", "record", "crate", "turntable", "open mic", "karaoke", "sing", "singing", "jazz", "dj", "listening party", "indie", "ukulele", "drums"],
  running: ["run club", "running", "runner", "go for a run", "jog*", "5k", "marathon"],
  fitness: ["gym", "workout", "work out", "yoga", "pilates", "fitness", "wellness", "meditat*", "stretch*", "exercise", "get in shape"],
  sports: ["sport", "play ball", "athletic*", "pickup", "league"],
  basketball: ["basketball", "hoop", "hooping", "hoopers", "bball"],
  soccer: ["soccer", "futbol"],
  volleyball: ["volleyball", "volley"],
  tennis: ["tennis"],
  pickleball: ["pickleball", "pickle ball"],
  climbing: ["climb*", "boulder*"],
  skate: ["skate*"],
  cycling: ["bike", "biking", "cycling", "bicycle"],
  outdoors: ["hike", "hiking", "trail", "outside", "outdoor*", "camp", "camping", "nature", "stargaz*", "adventure", "waterfall", "picnic", "walk"],
  food: ["food*", "eat", "dinner", "lunch", "brunch", "ramen", "bite", "restaurant", "dessert", "taco", "hungry", "snack"],
  cooking: ["cook*", "recipe", "bake", "baking", "kitchen", "meal prep"],
  coffee: ["coffee", "cafe", "espresso", "latte", "matcha", "boba"],
  art: ["art", "paint*", "draw*", "sketch*", "design", "creative", "gallery", "museum", "illustrat*"],
  crafts: ["craft*", "diy", "pottery", "ceramic*", "clay", "jewelry", "knit*", "sew", "sewing", "crochet", "handmade", "creative"],
  creators: ["content creator", "creator", "tiktok", "youtube", "vlog*", "video editing", "influencer"],
  tech: ["tech", "ai", "machine learning", "coding", "code", "program*", "hackathon", "developer", "software", "startup", "builders", "computer science", "python", "javascript", "data science", "robotics"],
  security: ["cybersecurity", "cyber", "security", "ctf", "hacking", "hacker", "infosec"],
  study: ["study*", "homework", "exam", "finals", "library", "textbook", "tutor*", "college", "campus", "student"],
  career: ["career", "intern*", "resume", "networking", "job", "linkedin", "professional", "interview"],
  volunteering: ["volunteer*", "cleanup", "clean up", "give back", "community service", "donate", "charity", "nonprofit"],
  books: ["book", "read", "reading", "novel", "book club", "bookstore", "writing", "write", "poetry", "journal*", "writer"],
  anime: ["anime", "manga", "cosplay", "convention", "otaku"],
  dance: ["dance", "dancing", "salsa", "bachata", "hip hop", "choreo*"],
  pets: ["pet", "dog", "cat", "puppy", "kitten", "animal"],
  travel: ["travel*", "trip", "culture", "cultural", "language", "spanish", "abroad", "international", "language exchange"],
  plants: ["plant*", "garden*"],
  social: ["meet people", "make friends", "new friends", "meet new", "meet other*", "kickback", "hang out", "hangout", "mixer", "meetup", "lonely", "new in town", "socialize"],
  cozy: ["introvert*", "quiet", "cozy", "calm", "low energy", "relaxing", "relax"],
  weekend: ["weekend", "something to do", "saturday", "sunday", "go somewhere", "bored", "something fun", "anything fun", "fun stuff", "what can i do", "anything happening", "fun activit*", "something free", "tonight", "fun"],
};
/** "weekend" means "no particular thing". it only counts when nothing more specific matched. */
const FALLBACK = "weekend";
/** topics that say how, not what. they never pull in a marketplace listing on their own. */
const NOT_SHOPPING = new Set([FALLBACK, "food", "social", "cozy", "sports"]);

const esc = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const TOPIC_RX: Array<[string, RegExp, RegExp[]]> = Object.entries(TOPICS).map(([topic, words]) => [
  topic,
  new RegExp(`\\b${esc(topic)}\\b`),
  words.map((w) => (w.endsWith("*") ? new RegExp(`\\b${esc(w.slice(0, -1)).replace(/ /g, "\\s+")}`) : new RegExp(`\\b${esc(w).replace(/ /g, "\\s+")}(?:s|es)?\\b`))),
]);
const clean = (v: string) => v.toLowerCase().replace(/[’‘]/g, "'");

/** the topics a piece of text is about, strongest first */
export function topicsFor(...texts: Array<string | null | undefined>): string[] {
  const hay = clean(texts.filter(Boolean).join(" "));
  const scored = TOPIC_RX.map(([topic, self, words]) => [topic, (self.test(hay) ? 2 : 0) + words.filter((w) => w.test(hay)).length] as const)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const specific = scored.filter(([t]) => t !== FALLBACK).map(([t]) => t);
  return specific.length > 0 ? specific : scored.map(([t]) => t);
}

// ---------- what else the words say: day, time of day, money ----------

const DAY_WORDS: Array<[RegExp, string]> = [[/\bsun(day)?s?\b/, "sun"], [/\bmon(day)?s?\b/, "mon"], [/\btue(s|sday)?s?\b/, "tue"], [/\bwed(nesday)?s?\b/, "wed"], [/\bthu(r|rs|rsday)?s?\b/, "thu"], [/\bfri(day)?s?\b/, "fri"], [/\bsat(urday)?s?\b/, "sat"]];
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const STOP = new Set("i im i'm a an the to go do for on in with any anyone down some something anything fun new cheap free budget learn play looking find buy this that these weekend tonight night today tomorrow people friends friend who like likes meet other others lowkey kinda really but are is it its expensive and of my me up out try trying make take cute how what whats can there stuff things thing event events group groups club class set kit used good great around near let lets have more be at want wanna need get getting into join start starting stuff really just not too much without spending money broke anybody someone happening involving activities activity down".split(" "));
const stem = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
const words = (v: string) => clean(v).split(/[^a-z0-9]+/).filter(Boolean).map(stem);

export type Intent = {
  topics: string[];
  /** the nouns left once the filler is gone ("monitor", "camera"). matched against titles and tags. */
  tokens: string[];
  /** a weekday the person named. events on other days are left out. */
  days: string[];
  /** "tonight": the same day is preferred, never required */
  today: string | null;
  part: "night" | "morning" | null;
  /** only free things */
  free: boolean;
  /** money is tight. cheaper comes first. */
  cheap: boolean;
  budget: number | null;
};

export function readIntent(text: string, extra: Array<string | null | undefined> = [], now = new Date()): Intent {
  const raw = clean(text);
  const tonight = /\b(tonight|tonite|this evening|later today)\b/.test(raw);
  return {
    topics: topicsFor(text, ...extra),
    tokens: [...new Set(words(raw).filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w)))],
    days: DAY_WORDS.filter(([rx]) => rx.test(raw)).map(([, d]) => d),
    today: tonight || /\b(today|rn|right now)\b/.test(raw) ? DAY_KEYS[now.getDay()]! : null,
    part: tonight || /\b(at night|night ?time|evening|after dark|late night|nightlife)\b/.test(raw) ? "night" : /\b(morning|sunrise|early)\b/.test(raw) ? "morning" : null,
    free: /\b(for free|free (stuff|things?|events?|to do|activit\w+|fun)|(something|anything|what'?s|somewhere) free|no money|without spending|not spending|costs? nothing|zero dollars)\b/.test(raw) && !/without spending (much|a lot|too much)/.test(raw),
    cheap: /\b(cheap|broke|budget|affordable|inexpensive|expensive|low cost|without spending (much|a lot|too much)|not (too )?much money|on a dime|save money|student budget)\b/.test(raw),
    budget: budgetIn(text),
  };
}

// ---------- eligibility, then relevance ----------

/** records a person could act on right now: nothing cancelled, sold, pending or private to others */
export function eligible(c: Catalog, memberOf: string[] = []): Catalog {
  return {
    events: c.events.filter((e) => (e.status ?? "scheduled") === "scheduled"),
    groups: c.groups.filter((g) => (g.visibility ?? "public") === "public" || memberOf.includes(g.id)),
    listings: c.listings.filter((l) => (l.status ?? "available") === "available"),
    reels: c.reels,
  };
}

// a record whose main tag is the thing asked for beats one that only touches on it
const overlap = (tags: string[], topics: string[]) => topics.reduce((n, t, i) => n + (tags.includes(t) ? topics.length - i : 0), 0) + (tags[0] !== undefined && topics.includes(tags[0]) ? 1 : 0);
// the nouns of the ask found in a title, or in a tag that is not itself a topic key
const hits = (tokens: string[], title: string, tags: string[]) => {
  const have = new Set([...words(title), ...tags.filter((t) => !(t in TOPICS)).flatMap((t) => words(t))]);
  return tokens.filter((t) => have.has(t)).length;
};
function top<T extends { id: string; sort?: number }>(scored: Array<{ r: T; score: number }>, limit: number): T[] {
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (a.r.sort ?? 100) - (b.r.sort ?? 100) || a.r.id.localeCompare(b.r.id))
    .slice(0, limit)
    .map((x) => x.r);
}
/** plain tag ranking, for "more like this" */
function rank<T extends { id: string; tags: string[]; sort?: number }>(rows: T[], topics: string[], limit: number): T[] {
  return top(rows.map((r) => ({ r, score: overlap(r.tags, topics) })), limit);
}

// the catalog is small and static, so it is read once and kept for a minute.
let cache: { at: number; data: Catalog } | null = null;
export async function catalog(): Promise<Catalog> {
  if (cache && Date.now() - cache.at < 60_000) return cache.data;
  const db = serverDb();
  const [e, g, l, r] = await Promise.all([
    db.from("public_events").select("*").order("sort").order("id"),
    db.from("groups").select("*").order("sort").order("id"),
    db.from("listings").select("*").order("sort").order("id"),
    db.from("reels").select("*").order("sort").order("id"),
  ]);
  const failed = e.error ?? g.error ?? l.error ?? r.error;
  if (failed) throw new Error(`catalog: ${failed.message}`);
  cache = { at: Date.now(), data: { events: (e.data ?? []) as PublicEvent[], groups: (g.data ?? []) as Group[], listings: (l.data ?? []) as Listing[], reels: (r.data ?? []) as Reel[] } };
  return cache.data;
}
/** tests search the seed arrays directly, with no database. null goes back to the database. */
export function setCatalog(data: Catalog | null): void {
  cache = data ? { at: Number.MAX_SAFE_INTEGER, data } : null;
}

type Who = { starterFree: FreeWindow[]; interests?: string[]; memberOf?: string[] };

/** public events for this intent that the starter could actually make */
export function searchEvents(c: Catalog, intent: Intent, who: Who, limit = 3): PublicEvent[] {
  // nothing recognisable in the ask: say so with an empty list rather than guess
  if (intent.topics.length === 0) return [];
  const generic = intent.topics.every((t) => t === FALLBACK);
  const mine = topicsFor(...(who.interests ?? []));
  let pool = eligible(c).events.filter((ev) => isDay(ev.when_day) && isFreeAt(who.starterFree, ev.when_day, ev.when_time));
  if (intent.days.length > 0) pool = pool.filter((ev) => intent.days.includes(ev.when_day));
  if (intent.free) pool = pool.filter((ev) => (ev.price ?? 0) === 0);
  if (intent.budget !== null) pool = pool.filter((ev) => (ev.price ?? 0) <= intent.budget!);
  const late = (ev: PublicEvent) => ev.when_time >= "17:00";
  if (intent.part === "night" && pool.some(late)) pool = pool.filter(late);
  if (intent.part === "morning" && pool.some((ev) => ev.when_time < "12:00")) pool = pool.filter((ev) => ev.when_time < "12:00");
  const scored = pool.map((ev) => {
    const base = overlap(ev.tags, intent.topics);
    if (base === 0) return { r: ev, score: 0 };
    const price = ev.price ?? 0;
    return {
      r: ev,
      score: base + 1.5 * hits(intent.tokens, ev.title, ev.tags)
        + (ev.tags.some((t) => mine.includes(t)) ? (generic ? 2 : 0.5) : 0)
        + (intent.cheap ? (price === 0 ? 1 : price <= 15 ? 0.5 : price > 30 ? -1 : 0) : 0)
        + (intent.today && ev.when_day === intent.today ? 1 : 0),
    };
  });
  if (!generic) return top(scored, limit);
  // "i'm bored": a spread of different things, not three of one kind
  const seen = new Set<string>();
  return top(scored, scored.length).filter((ev) => !seen.has(ev.tags[0] ?? "") && seen.add(ev.tags[0] ?? "")).slice(0, limit);
}

export function searchGroups(c: Catalog, intent: Intent, who: Who, limit = 2): Group[] {
  const topics = intent.topics.filter((t) => t !== FALLBACK);
  return top(eligible(c, who.memberOf).groups.map((g) => {
    const base = overlap(g.tags, topics);
    return { r: g, score: base === 0 ? 0 : base + 1.5 * hits(intent.tokens, g.name, g.tags) };
  }), limit);
}

/** listings for this intent. a stated budget drops anything over it; "cheap" puts cheaper first. */
export function searchListings(c: Catalog, intent: Intent, limit = 4): Listing[] {
  const topics = intent.topics.filter((t) => !NOT_SHOPPING.has(t));
  return top(eligible(c).listings.filter((l) => intent.budget === null || l.price <= intent.budget).map((l) => {
    const named = hits(intent.tokens, l.title, l.tags);
    const base = overlap(l.tags, topics) + 2 * named;
    return { r: l, score: base === 0 ? 0 : base + (intent.cheap || intent.free ? (l.price <= 40 ? 1 : l.price <= 80 ? 0.5 : l.price > 150 ? -1 : 0) : 0) };
  }), limit);
}

// the three searches by topic alone, kept for callers that have topics and nothing else
export async function searchMockEvents(topics: string[], starterFree: FreeWindow[], limit = 3): Promise<PublicEvent[]> {
  return searchEvents(await catalog(), { ...readIntent(""), topics }, { starterFree }, limit);
}
export async function searchMockGroups(topics: string[], limit = 2): Promise<Group[]> {
  return searchGroups(await catalog(), { ...readIntent(""), topics }, { starterFree: [] }, limit);
}
export async function searchMockMarketplace(topics: string[], budget: number | null, limit = 4): Promise<Listing[]> {
  return searchListings(await catalog(), { ...readIntent(""), topics, budget }, limit);
}

/** the event a group runs, the group behind an event, listings on the same topic */
export async function getRelatedOpportunities(kind: OpportunityKind | "reel", id: string): Promise<Candidates> {
  const c = eligible(await catalog());
  const source = kind === "event" ? c.events.find((x) => x.id === id) : kind === "group" ? c.groups.find((x) => x.id === id) : kind === "listing" ? c.listings.find((x) => x.id === id) : c.reels.find((x) => x.id === id);
  if (!source) return { events: [], groups: [], listings: [] };
  const tags = source.tags;
  // the group an event belongs to, and the events a group runs, come before anything merely on topic
  const linkedGroup = kind === "event" ? c.groups.filter((g) => g.id === (source as PublicEvent).group_id) : [];
  const linkedEvents = kind === "group" ? c.events.filter((e) => e.group_id === id) : [];
  const uniq = <T extends { id: string }>(rows: T[], limit: number) => rows.filter((r, i) => rows.findIndex((x) => x.id === r.id) === i).slice(0, limit);
  return {
    events: kind === "event" ? [] : uniq([...linkedEvents, ...rank(c.events, tags, 3)], 3),
    groups: kind === "group" ? [] : uniq([...linkedGroup, ...rank(c.groups, tags, 2)], 2),
    listings: rank(c.listings.filter((l) => !(kind === "listing" && l.id === id) && !l.tags.every((t) => NOT_SHOPPING.has(t))), tags.filter((t) => !NOT_SHOPPING.has(t)), 3),
  };
}

const budgetIn = (text: string): number | null => {
  const m = text.match(/(?:under|below|less than|max|up to)\s*\$?\s*(\d{1,5})/i) ?? text.match(/\$\s*(\d{1,5})/);
  return m ? Number(m[1]) : null;
};

/** a context sent by the app is only trusted once it resolves to a real catalog row (or a plain reel topic) */
export async function validContext(v: unknown): Promise<SignalContext | null> {
  if (!v || typeof v !== "object") return null;
  const { kind, id } = v as { kind?: unknown; id?: unknown };
  if (typeof id !== "string" || id.length === 0 || id.length > 60) return null;
  const c = await catalog();
  if (kind === "event") return c.events.some((x) => x.id === id) ? { kind, id } : null;
  if (kind === "group") return c.groups.some((x) => x.id === id) ? { kind, id } : null;
  if (kind === "listing") return c.listings.some((x) => x.id === id) ? { kind, id } : null;
  // a reel is either one from the catalog, or a plain topic from someone's reels feed
  if (kind === "reel") return c.reels.some((x) => x.id === id) || /^[a-z ]+$/.test(id) ? { kind, id } : null;
  return null;
}

/** one line for the prompts about where the thought started */
export async function describeContext(ctx: SignalContext | null): Promise<string | null> {
  if (!ctx) return null;
  const c = await catalog();
  if (ctx.kind === "listing") {
    const l = c.listings.find((x) => x.id === ctx.id);
    return l ? `they were looking at a marketplace listing: "${l.title}" ($${l.price}, ${l.category.toLowerCase()})` : null;
  }
  if (ctx.kind === "event") {
    const ev = c.events.find((x) => x.id === ctx.id);
    return ev ? `they were looking at a public event: "${ev.title}", ${ev.when_text}, ${ev.area}` : null;
  }
  if (ctx.kind === "group") {
    const g = c.groups.find((x) => x.id === ctx.id);
    return g ? `they were looking at a group: "${g.name}" (${g.description})` : null;
  }
  const reel = c.reels.find((x) => x.id === ctx.id);
  return reel ? `they were watching a reel: "${reel.title}" (${reel.topic})` : `they were watching a reel about ${ctx.id}`;
}

/**
 * everything muse may choose from for one thought. filtered and ranked here, so the
 * prompt stays small. the thing the person started from is always first in its list.
 */
export async function discover(input: {
  text: string; activity: string; budgetHint: string; starterFree: FreeWindow[]; context: SignalContext | null;
  /** the starter's own interests. they break ties and shape a vague ask, never override a specific one. */
  interests?: string[];
  /** groups the starter is in, so a private group of theirs can be found */
  memberOf?: string[];
  now?: Date;
}): Promise<Candidates & { topics: string[] }> {
  const c = await catalog();
  const open = eligible(c, input.memberOf);
  const ctx = input.context;
  const reel = ctx?.kind === "reel" ? c.reels.find((x) => x.id === ctx.id) : undefined;
  const seed = ctx?.kind === "event" ? open.events.find((x) => x.id === ctx.id) : ctx?.kind === "group" ? open.groups.find((x) => x.id === ctx.id) : ctx?.kind === "listing" ? open.listings.find((x) => x.id === ctx.id) : undefined;
  const intent = readIntent(input.text, [input.activity, reel ? reel.topic : ctx?.kind === "reel" ? ctx.id : null], input.now);
  intent.topics = [...new Set([...(seed?.tags ?? []), ...(reel?.tags ?? []), ...intent.topics])];
  intent.budget = intent.budget ?? budgetIn(input.budgetHint);
  const who: Who = { starterFree: input.starterFree, interests: input.interests, memberOf: input.memberOf };
  const first = <T extends { id: string }>(rows: T[], pinned: T | undefined, limit: number) => (pinned ? [pinned, ...rows.filter((r) => r.id !== pinned.id)] : rows).slice(0, limit);
  return {
    topics: intent.topics,
    events: first(searchEvents(c, intent, who), ctx?.kind === "event" ? (seed as PublicEvent | undefined) : undefined, 3),
    groups: first(searchGroups(c, intent, who), ctx?.kind === "group" ? (seed as Group | undefined) : undefined, 2),
    listings: first(searchListings(c, intent), ctx?.kind === "listing" ? (seed as Listing | undefined) : undefined, 4),
  };
}

// ---------- what a plan uses, shaped for the app ----------

/** `topic` is the record's main tag, so the app can draw a fitting placeholder when there is no photo */
export type OpportunityView = { kind: OpportunityKind; id: string; title: string; sub: string; reason: string | null; cover: string | null; topic?: string | null };

export async function planOpportunities(planId: string): Promise<OpportunityView[]> {
  const { data, error } = await serverDb().from("plan_opportunities").select("kind,ref_id,reason").eq("plan_id", planId);
  if (error) throw new Error(`plan_opportunities: ${error.message}`);
  if (!data || data.length === 0) return [];
  const c = await catalog();
  const order: OpportunityKind[] = ["event", "group", "listing"];
  return data
    .map((row): OpportunityView | null => {
      const reason = (row.reason as string | null) ?? null;
      if (row.kind === "event") {
        const ev = c.events.find((x) => x.id === row.ref_id);
        return ev ? { kind: "event", id: ev.id, title: ev.title, sub: `${ev.when_text} · ${ev.area}`, reason, cover: ev.cover, topic: ev.tags[0] ?? null } : null;
      }
      if (row.kind === "group") {
        const g = c.groups.find((x) => x.id === row.ref_id);
        return g ? { kind: "group", id: g.id, title: g.name, sub: `${g.member_count.toLocaleString("en-US")} members · ${g.area}`, reason, cover: g.cover, topic: g.tags[0] ?? null } : null;
      }
      const l = c.listings.find((x) => x.id === row.ref_id);
      return l ? { kind: "listing", id: l.id, title: l.title, sub: `$${l.price.toLocaleString("en-US")} · ${l.place}`, reason, cover: l.cover ?? null, topic: l.tags[0] ?? null } : null;
    })
    .filter((o): o is OpportunityView => o !== null)
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}
