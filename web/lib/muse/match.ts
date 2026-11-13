import { z } from "zod";
import type { Candidates } from "@/lib/discover";
import type { FreeWindow } from "@/lib/types";
import { DAYS, isFreeAt, isTime, windowsLine } from "@/lib/when";
import { runStructured, type StructuredResult } from "./run";
import type { Understood } from "./understand";
import { VOICE } from "./voice";

// job 2, "the mix": pick the few friends most likely to say yes, and shape a first plan.

export const MatchSchema = z.object({
  activity: z.string(),
  hear_me_out: z.string(),
  picks: z.array(
    z.object({
      user_id: z.string(),
      reason: z.string(),
      personal_ask: z.string(),
    }),
  ),
  when_day: z.enum(DAYS),
  when_text: z.string(),
  when_time: z.string(),
  where_text: z.string(),
  // opportunity discovery. ids come from the lists the backend found, or stay null / empty.
  event_id: z.string().nullable(),
  event_reason: z.string().nullable(),
  group_id: z.string().nullable(),
  group_reason: z.string().nullable(),
  listings: z.array(z.object({ listing_id: z.string(), reason: z.string() })),
});

export type Matched = z.infer<typeof MatchSchema>;

export type Candidate = {
  id: string;
  firstName: string;
  interests: string[];
  free_windows: FreeWindow[];
  /** only present when this friend opted in to sharing reels topics */
  reelsTopics: string[] | null;
  /** set for someone who is not a friend yet: how many friends they share with the starter */
  mutuals?: number;
};

export type MatchInput = {
  starter: { id: string; firstName: string; interests: string[]; free_windows: FreeWindow[] };
  rawText: string;
  understood: Understood;
  candidates: Candidate[];
  today: string;
  /** what the backend found for this thought. muse may only choose from these. */
  found: Candidates;
  /** one line on where the thought started (a listing, an event, a group, a reel), if anywhere */
  startedFrom: string | null;
  /** the starter read a first draft and asked for a change, in their words. the draft itself is described alongside. */
  revise?: { ask: string; draft: string } | null;
  planId?: string | null;
  preferCache?: boolean;
};

const SYSTEM = `you are muse, the quiet planner inside musing. someone shared a half-formed thought. you now pick the few friends most likely to actually say yes, and shape a first plan. the starter never has to ask anyone. you ask, privately, one person at a time.

${VOICE}

the plan is what they asked for. if they said food, it is a meal. if they said karaoke, it is karaoke. the starter's interests help you choose people, they never change the activity. if they named a far-away place or a trip, the plan is still about that place: plan the first real step toward it with friends (a night to plan it, pricing it out together), keep the place in the activity, and leave out any local event, group or listing that has nothing to do with it.

rules for picking:
- pick 3 friends, 4 only if a fourth is a clearly strong fit. fewer and better beats more. if only one or two candidates are free and fit, return just those.
- only use user_id values from the candidate list. never invent an id.
- a good pick shares the interest AND is free when the starter is free. someone who can't make the time is not a good pick.
- if the starter named a day or a time of day, keep it. move it only when the starter is not free then.
- otherwise choose one day and start time inside the starter's free windows where the most picks are free.
- never pick someone who is not free at the day and time you chose.
- the start time must suit the activity. dinner is an evening thing, brunch is late morning.

return these fields:
- activity: the plan in two to five lowercase words ("a thrift run", "ramen night").
- hear_me_out: what you say to the starter about this plan. two short sentences, under 200 characters. say the shape of it (what, when, roughly where). do not list names here.
- picks: for each pick:
  - user_id: from the candidate list.
  - reason: one short line only the starter reads, on why this friend fits ("free saturday afternoon and deep into vintage denim"). under 80 characters.
  - personal_ask: the one message this friend gets from you. speak to them directly. name the starter by first name, the activity and the time. tie it to one thing about them from their interests. end low pressure. under 180 characters. never mention any other invited person. never mention reels, watching, data, or how you know.
- when_day: one of sun, mon, tue, wed, thu, fri, sat.
- when_time: 24 hour start time, "HH:MM".
- when_text: how a friend would say it ("saturday around 1").
- where_text: a kind of place, not a real business name ("a couple of thrift spots downtown, coffee after"). if you chose an event, its area.

things found around this thought. the backend searched public events, groups and marketplace listings and gives you what it found. build one coherent move, not a list of links:
- use only ids from those lists. never invent an event, a group, a listing, a price, a date or a place. if a list is empty, leave that part out.
- do not force anything in. a simple dinner needs no listing. leave out whatever does not make this plan better.
- event_id: at most one event, and only when going to it IS the plan (a pop-up for a thrift run, a photo walk for a photography outing). its day, time and area are fixed: copy them into when_day, when_time, when_text and where_text exactly, and only pick friends who are free then. otherwise null.
- event_reason: one short line on why this event fits, under 80 characters. null when event_id is null.
- group_id: at most one group worth a look for this activity. otherwise null. nobody is joined to anything.
- group_reason: one short line, under 80 characters. null when group_id is null.
- listings: zero, one or two listings that would genuinely help with this plan, each with a reason under 80 characters. they are optional things to look at, never purchases. if the person started from a listing, include it.
- never say or imply that a friend is in a group, saw a listing or is going to an event.`;

function userPrompt(i: MatchInput): string {
  const lines = i.candidates.map((c) => {
    const reels = c.reelsTopics && c.reelsTopics.length > 0 ? ` | lately into: ${c.reelsTopics.join(", ")}` : "";
    const mutual = c.mutuals ? ` | mutual friend, not a friend yet: ${c.mutuals} friend${c.mutuals === 1 ? "" : "s"} in common` : "";
    return `- ${c.id} (${c.firstName}) | interests: ${c.interests.join(", ")} | free: ${windowsLine(c.free_windows)}${reels}${mutual}`;
  });
  // only said when the starter opened the plan up to mutual friends
  const mutualRule = i.candidates.some((c) => c.mutuals)
    ? `\nthe starter opened this up to mutual friends. friends come first: include a mutual friend only when they clearly fit and are free, and never more than two. in a mutual friend's personal_ask, say you have friends in common. never name those friends.\n`
    : "";
  return `today is ${i.today}.
starter: ${i.starter.firstName} | interests: ${i.starter.interests.join(", ")} | free: ${windowsLine(i.starter.free_windows)}
they typed: "${i.rawText}"${i.revise ? `\nyou already drafted this: ${i.revise.draft}\nthey read it and asked you to change it: "${i.revise.ask}"\nmake that change. keep everything they did not ask to change (the activity, the day, the people) when the rules still allow it. if they named a friend to add or drop, do it when that friend is a candidate and free.` : ""}
what you understood: activity=${i.understood.activity}; time=${i.understood.time_hint}; vibe=${i.understood.vibe}; budget=${i.understood.budget_hint}; group=${i.understood.group_size_hint}

candidate friends:
${lines.join("\n")}
${mutualRule}
${i.startedFrom ? `where this started: ${i.startedFrom}\n\n` : ""}public events found:
${i.found.events.map((e) => `- ${e.id} | ${e.title} | ${e.when_day} ${e.when_time} (${e.when_text}) | ${e.area} | ${e.description}`).join("\n") || "- none"}

groups found:
${i.found.groups.map((g) => `- ${g.id} | ${g.name} | ${g.area} | ${g.description}`).join("\n") || "- none"}

marketplace listings found:
${i.found.listings.map((l) => `- ${l.id} | ${l.title} | $${l.price} | ${l.category.toLowerCase()} | ${l.place}`).join("\n") || "- none"}`;
}

export function match(input: MatchInput, onText?: (delta: string) => void, onRestart?: () => void): Promise<StructuredResult<Matched>> {
  // muse sometimes writes an id the way the name is spelled ("tomás" for "tomas").
  // map anything that unambiguously means a candidate back to the real id; reject the rest.
  const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const canon = new Map<string, string>();
  for (const c of input.candidates) {
    canon.set(norm(c.id), c.id);
    if (!canon.has(norm(c.firstName))) canon.set(norm(c.firstName), c.id);
  }
  return runStructured({
    job: "match",
    schema: MatchSchema,
    schemaName: "the_mix",
    system: SYSTEM,
    user: userPrompt(input),
    maxTokens: 2400,
    planId: input.planId,
    preferCache: input.preferCache,
    // the backend is the only source of user ids. anything else is rejected here.
    check: (o) => {
      // a person with few free friends still gets a plan, even if it is just one friend
      if (o.picks.length < 1 || o.picks.length > 4) return `expected 1 to 4 picks, got ${o.picks.length}`;
      const seen = new Set<string>();
      for (const p of o.picks) {
        const id = canon.get(norm(p.user_id));
        if (!id) return `unknown user id "${p.user_id}"`;
        p.user_id = id;
        if (seen.has(p.user_id)) return `duplicate pick "${p.user_id}"`;
        seen.add(p.user_id);
      }
      // every opportunity id must be one the backend returned for this thought
      if (o.event_id === "" || o.event_id === "null") o.event_id = null;
      if (o.group_id === "" || o.group_id === "null") o.group_id = null;
      const ev = o.event_id ? input.found.events.find((e) => e.id === o.event_id) : null;
      if (o.event_id && !ev) return `unknown event id "${o.event_id}"`;
      if (o.group_id && !input.found.groups.some((g) => g.id === o.group_id)) return `unknown group id "${o.group_id}"`;
      if (o.listings.length > 2) o.listings = o.listings.slice(0, 2);
      const bad = o.listings.find((l) => !input.found.listings.some((x) => x.id === l.listing_id));
      if (bad) return `unknown listing id "${bad.listing_id}"`;
      if (new Set(o.listings.map((l) => l.listing_id)).size !== o.listings.length) return "the same listing twice";
      // a public event keeps its own day, time and place. the server writes them, not muse.
      if (ev) {
        o.when_day = ev.when_day as Matched["when_day"];
        o.when_time = ev.when_time;
        o.when_text = ev.when_text;
      }
      if (!isTime(o.when_time)) return `bad when_time "${o.when_time}"`;
      if (!isFreeAt(input.starter.free_windows, o.when_day, o.when_time)) return `the starter is not free ${o.when_day} ${o.when_time}`;
      return null;
    },
    summarize: (o) =>
      `${o.activity} · ${o.when_day} ${o.when_time} · picked ${o.picks.map((p) => p.user_id).join(", ")}` +
      ` · found ${input.found.events.length}e/${input.found.groups.length}g/${input.found.listings.length}l, used ${[o.event_id, o.group_id, ...o.listings.map((l) => l.listing_id)].filter(Boolean).join(", ") || "none"}`,
    stream: onText ? { field: "hear_me_out", onText, onRestart } : undefined,
  });
}
