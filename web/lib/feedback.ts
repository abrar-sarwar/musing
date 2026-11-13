// Pure feedback and recommendation rules. Private notes deliberately never enter this file.

export const FEEDBACK_TAGS = [
  "great_activity", "great_crew", "great_place", "good_timing", "good_value", "do_again",
  "not_my_vibe", "wrong_crew", "too_far", "wrong_timing", "too_expensive", "not_again",
] as const;

export type FeedbackTag = (typeof FEEDBACK_TAGS)[number];
export type FeedbackFacets = { area?: string; daypart?: string; price?: string };
export type Affinity = {
  topics: Record<string, number>;
  areas: Record<string, number>;
  dayparts: Record<string, number>;
  prices: Record<string, number>;
};

export type FeedbackSignal = {
  rating: number;
  tags: string[];
  recommendation_topics: string[];
  recommendation_facets: FeedbackFacets;
};

export const EMPTY_AFFINITY: Affinity = { topics: {}, areas: {}, dayparts: {}, prices: {} };
export const starWeight = (stars: number): number => stars - 3;
const clamp = (n: number): number => Math.max(-6, Math.min(6, n));
const add = (scores: Record<string, number>, key: string | undefined, amount: number) => {
  if (key && amount !== 0) scores[key] = clamp((scores[key] ?? 0) + amount);
};

/** Latest feedback for each hangout is represented by one database row. */
export function aggregateAffinity(rows: FeedbackSignal[]): Affinity {
  const out: Affinity = { topics: {}, areas: {}, dayparts: {}, prices: {} };
  for (const row of rows) {
    const tags = new Set(row.tags);
    const activity = (tags.has("great_activity") ? 1 : 0) + (tags.has("do_again") ? 1 : 0)
      - (tags.has("not_my_vibe") ? 1 : 0) - (tags.has("not_again") ? 1 : 0);
    for (const topic of new Set(row.recommendation_topics)) add(out.topics, topic, starWeight(row.rating) + activity);
    add(out.areas, row.recommendation_facets.area, (tags.has("great_place") ? 1 : 0) - (tags.has("too_far") ? 1 : 0));
    add(out.dayparts, row.recommendation_facets.daypart, (tags.has("good_timing") ? 1 : 0) - (tags.has("wrong_timing") ? 1 : 0));
    add(out.prices, row.recommendation_facets.price, (tags.has("good_value") ? 1 : 0) - (tags.has("too_expensive") ? 1 : 0));
    // Crew tags are intentionally archived only. They never affect people or friend ranking.
  }
  return out;
}

export function affinityScore(
  affinity: Affinity,
  topics: string[],
  facets: FeedbackFacets = {},
): number {
  return [...new Set(topics)].reduce((n, topic) => n + (affinity.topics[topic] ?? 0), 0)
    + (facets.area ? affinity.areas[facets.area] ?? 0 : 0)
    + (facets.daypart ? affinity.dayparts[facets.daypart] ?? 0 : 0)
    + (facets.price ? affinity.prices[facets.price] ?? 0 : 0);
}

/** Personal affinity is the first key for passive surfaces. No candidate is filtered out. */
export function rankPassive<T>(rows: T[], score: (row: T) => number): T[] {
  return rows.map((row, index) => ({ row, index, personal: score(row) }))
    .sort((a, b) => b.personal - a.personal || a.index - b.index)
    .map(({ row }) => row);
}

/** Explicit Muse intent remains primary; feedback only breaks equal relevance. */
export function rankIntentFirst<T>(rows: T[], relevance: (row: T) => number, personal: (row: T) => number): T[] {
  return rows.map((row, index) => ({ row, index, relevant: relevance(row), personal: personal(row) }))
    .sort((a, b) => b.relevant - a.relevant || b.personal - a.personal || a.index - b.index)
    .map(({ row }) => row);
}

export function parseFeedback(input: { rating?: unknown; tags?: unknown; note?: unknown }): { rating: number; tags: FeedbackTag[]; note: string | null } {
  if (!Number.isInteger(input.rating) || (input.rating as number) < 1 || (input.rating as number) > 5) throw new Error("rating must be an integer from 1 to 5");
  if (!Array.isArray(input.tags) || input.tags.length > 4 || new Set(input.tags).size !== input.tags.length || input.tags.some((t) => typeof t !== "string" || !FEEDBACK_TAGS.includes(t as FeedbackTag))) {
    throw new Error("choose up to four known feedback tags");
  }
  if (input.note !== undefined && input.note !== null && typeof input.note !== "string") throw new Error("note must be text");
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > 500) throw new Error("note must be 500 characters or fewer");
  return { rating: input.rating as number, tags: input.tags as FeedbackTag[], note: note || null };
}

export function daypartFor(iso: string | null): string | undefined {
  if (!iso) return undefined;
  const hour = new Date(iso).getHours();
  return hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 22 ? "evening" : "night";
}
