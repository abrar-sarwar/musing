import { serverDb } from "@/lib/db/server";
import type { FreeWindow } from "@/lib/types";
import { isDay, isFreeAt } from "@/lib/when";

// opportunity discovery. plain, fast lookups over the fictional catalog (public events,
// groups, marketplace listings). these run before muse is called: muse only ever chooses
// among the records returned here, and every id it writes is checked against them.

export type PublicEvent = { id: string; title: string; description: string; when_day: string; when_time: string; when_text: string; area: string; tags: string[]; organizer: string; capacity: number | null; group_id: string | null; cover: string | null };
export type Group = { id: string; name: string; description: string; tags: string[]; area: string; cover: string | null; member_count: number; activity: string[] };
export type Listing = { id: string; title: string; price: number; category: string; place: string; tags: string[]; seller_id: string };

export type OpportunityKind = "event" | "group" | "listing";
/** where a thought started, when it didn't start from the composer */
export type SignalContext = { kind: OpportunityKind | "reel"; id: string };
export type Candidates = { events: PublicEvent[]; groups: Group[]; listings: Listing[] };

// topic keys and the words that point at them. catalog rows are tagged with the keys.
const TOPICS: Record<string, string[]> = {
  thrifting: ["thrift", "vintage", "secondhand", "second hand", "flea", "clothing swap", "clothes", "denim", "jacket", "upcycl"],
  home: ["room", "makeover", "furniture", "decor", "apartment", "bedroom", "redecorat", "dorm"],
  photography: ["photo", "camera", "film", "35mm", "golden hour"],
  games: ["board game", "boardgame", "game night", "games", "gaming", "tabletop"],
  music: ["record", "vinyl", "crate", "guitar", "turntable"],
  running: ["run club", "running", "jog"],
  food: ["food", "eat", "dinner", "lunch", "brunch", "ramen", "bite"],
  outdoors: ["hike", "hiking", "walk", "outside", "bike", "cycling"],
  weekend: ["weekend", "something to do", "saturday", "sunday", "go somewhere", "bored"],
};

/** the topics a piece of text is about, strongest first */
export function topicsFor(...texts: Array<string | null | undefined>): string[] {
  const hay = texts.filter(Boolean).join(" ").toLowerCase();
  const scored = Object.entries(TOPICS)
    .map(([topic, words]) => [topic, (hay.includes(topic) ? 2 : 0) + words.filter((w) => hay.includes(w)).length] as const)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  // "weekend" is a fallback: it only counts when nothing more specific matched
  const specific = scored.filter(([t]) => t !== "weekend").map(([t]) => t);
  return specific.length > 0 ? specific : scored.map(([t]) => t);
}

const overlap = (tags: string[], topics: string[]) => topics.reduce((n, t, i) => n + (tags.includes(t) ? topics.length - i : 0), 0);
function rank<T extends { tags: string[] }>(rows: T[], topics: string[], limit: number): T[] {
  return rows
    .map((r) => ({ r, score: overlap(r.tags, topics) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.r);
}

// the catalog is small and static, so it is read once and kept for a minute.
let cache: { at: number; data: Candidates } | null = null;
export async function catalog(): Promise<Candidates> {
  if (cache && Date.now() - cache.at < 60_000) return cache.data;
  const db = serverDb();
  const [e, g, l] = await Promise.all([db.from("public_events").select("*"), db.from("groups").select("*"), db.from("listings").select("*")]);
  const failed = e.error ?? g.error ?? l.error;
  if (failed) throw new Error(`catalog: ${failed.message}`);
  cache = { at: Date.now(), data: { events: (e.data ?? []) as PublicEvent[], groups: (g.data ?? []) as Group[], listings: (l.data ?? []) as Listing[] } };
  return cache.data;
}

/** public events about these topics that the starter could actually make */
export async function searchMockEvents(topics: string[], starterFree: FreeWindow[], limit = 3): Promise<PublicEvent[]> {
  const { events } = await catalog();
  return rank(events.filter((ev) => isDay(ev.when_day) && isFreeAt(starterFree, ev.when_day, ev.when_time)), topics, limit);
}

export async function searchMockGroups(topics: string[], limit = 2): Promise<Group[]> {
  return rank((await catalog()).groups, topics.filter((t) => t !== "weekend"), limit);
}

/** listings about these topics. a stated budget drops anything clearly over it. */
export async function searchMockMarketplace(topics: string[], budget: number | null, limit = 4): Promise<Listing[]> {
  const { listings } = await catalog();
  return rank(listings.filter((l) => budget === null || l.price <= budget), topics.filter((t) => t !== "weekend" && t !== "food"), limit);
}

/** the event a group runs, the group behind an event, listings on the same topic */
export async function getRelatedOpportunities(kind: OpportunityKind, id: string): Promise<Candidates> {
  const c = await catalog();
  const source = kind === "event" ? c.events.find((x) => x.id === id) : kind === "group" ? c.groups.find((x) => x.id === id) : c.listings.find((x) => x.id === id);
  if (!source) return { events: [], groups: [], listings: [] };
  const tags = source.tags;
  return {
    events: kind === "event" ? [] : rank(c.events, tags, 2),
    groups: kind === "group" ? [] : rank(c.groups, tags, 2),
    listings: rank(c.listings.filter((l) => !(kind === "listing" && l.id === id)), tags, 3),
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
  if (kind === "reel") return /^[a-z ]+$/.test(id) ? { kind, id } : null;
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
  return `they were watching a reel about ${ctx.id}`;
}

/**
 * everything muse may choose from for one thought. filtered and ranked here, so the
 * prompt stays small. the thing the person started from is always first in its list.
 */
export async function discover(input: { text: string; activity: string; budgetHint: string; starterFree: FreeWindow[]; context: SignalContext | null }): Promise<Candidates & { topics: string[] }> {
  const c = await catalog();
  const ctx = input.context;
  const seed = ctx?.kind === "event" ? c.events.find((x) => x.id === ctx.id) : ctx?.kind === "group" ? c.groups.find((x) => x.id === ctx.id) : ctx?.kind === "listing" ? c.listings.find((x) => x.id === ctx.id) : undefined;
  const topics = [...new Set([...(seed?.tags ?? []), ...topicsFor(input.activity, input.text, ctx?.kind === "reel" ? ctx.id : null)])];
  const budget = budgetIn(input.text) ?? budgetIn(input.budgetHint);
  const [events, groups, listings] = await Promise.all([searchMockEvents(topics, input.starterFree), searchMockGroups(topics), searchMockMarketplace(topics, budget)]);
  const first = <T extends { id: string }>(rows: T[], pinned: T | undefined, limit: number) => (pinned ? [pinned, ...rows.filter((r) => r.id !== pinned.id)] : rows).slice(0, limit);
  return {
    topics,
    events: first(events, ctx?.kind === "event" ? (seed as PublicEvent | undefined) : undefined, 3),
    groups: first(groups, ctx?.kind === "group" ? (seed as Group | undefined) : undefined, 2),
    listings: first(listings, ctx?.kind === "listing" ? (seed as Listing | undefined) : undefined, 4),
  };
}

// ---------- what a plan uses, shaped for the app ----------

export type OpportunityView = { kind: OpportunityKind; id: string; title: string; sub: string; reason: string | null; cover: string | null };

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
        return ev ? { kind: "event", id: ev.id, title: ev.title, sub: `${ev.when_text} · ${ev.area}`, reason, cover: ev.cover } : null;
      }
      if (row.kind === "group") {
        const g = c.groups.find((x) => x.id === row.ref_id);
        return g ? { kind: "group", id: g.id, title: g.name, sub: `${g.member_count.toLocaleString("en-US")} members · ${g.area}`, reason, cover: g.cover } : null;
      }
      const l = c.listings.find((x) => x.id === row.ref_id);
      return l ? { kind: "listing", id: l.id, title: l.title, sub: `$${l.price.toLocaleString("en-US")} · ${l.place}`, reason, cover: `market/${l.id}.jpg` } : null;
    })
    .filter((o): o is OpportunityView => o !== null)
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}
