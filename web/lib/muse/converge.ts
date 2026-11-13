import { z } from "zod";
import type { Candidates } from "@/lib/discover";
import { DAYS, isFreeAt, isTime } from "@/lib/when";
import { runStructured, type StructuredResult } from "./run";
import type { Understood } from "./understand";
import { VOICE } from "./voice";

// job 7, convergence: several friends each shared their own half-formed thought.
// nobody asked for a group plan. decide whether one experience genuinely serves
// the fresh signal AND each friend's own signal, and if so, invent it.

export const ConvergeSchema = z.object({
  match: z.boolean(),
  activity: z.string(),
  hear_me_out: z.string(),
  participants: z.array(
    z.object({
      user_id: z.string(),
      muse_id: z.string(),
      reason: z.string(),
      personal_ask: z.string(),
    }),
  ),
  when_day: z.enum(DAYS),
  when_text: z.string(),
  when_time: z.string(),
  where_text: z.string(),
  event_id: z.string().nullable(),
  event_reason: z.string().nullable(),
  group_id: z.string().nullable(),
  group_reason: z.string().nullable(),
  listings: z.array(z.object({ listing_id: z.string(), reason: z.string() })),
});

export type Converged = z.infer<typeof ConvergeSchema>;

export type SignalCandidate = {
  museId: string;
  userId: string;
  firstName: string;
  interests: string[];
  free_windows: import("@/lib/types").FreeWindow[];
  rawText: string;
  understood: Understood;
};

export type ConvergeInput = {
  owner: { id: string; firstName: string; interests: string[]; free_windows: import("@/lib/types").FreeWindow[] };
  trigger: { museId: string; rawText: string; understood: Understood };
  signals: SignalCandidate[];
  today: string;
  found: Candidates;
};

const SYSTEM = `you are muse, the quiet planner inside musing. several friends each shared their own half-formed thought, at different times, without asking each other. nobody requested a group plan. your job is to notice whether one shared experience genuinely serves the fresh thought AND each friend's own thought, and to invent that experience. if it does not, say so. most combinations are not a match.

${VOICE}

what counts as a match:
- one experience that weaves at least two different thoughts together. a plan that only serves one person's wish is not a match, even if other people could tag along.
- a vague thought ("need something fun to do this weekend") can be served by an experience shaped by the others, as long as it fits that person's time and general openness.
- unrelated wishes, clashing vibes (a quiet study session and a karaoke night), or no shared free time means match is false. never force people together.
- only include a friend whose own thought the experience actually uses. 1 to 3 friends.

rules:
- only use user_id and muse_id values from the list given. never invent an id.
- choose one day and start time when the owner and every included friend are free, inside their free windows as given. the start time must suit the activity.
- if an event below is chosen, going to it IS the plan: its day, time and area are fixed, copy them into when_day, when_time, when_text and where_text exactly, and only include friends who are free then.

return these fields:
- match: true or false.
- activity: the experience in two to five lowercase words ("a vintage market photo walk"). when match is false, still name the closest idea you considered, briefly.
- hear_me_out: what you say to the owner. two short sentences, under 220 characters. the shape of the experience, when, and that it connects their thought with their friends' own recent thoughts. paraphrase the friends' thoughts, never quote them word for word. no names needed beyond first names.
- participants: for each included friend:
  - user_id and muse_id: from the list.
  - reason: one short line only the owner reads, on how this friend's own thought fits the experience. under 80 characters.
  - personal_ask: the one message this friend gets from you. speak to them directly. you may name the owner by first name. tie the experience to their own thought or one of their interests, and give the time. never mention any other participant. never quote or reveal anyone else's thought. never mention reels, watching, data, or how you know. end low pressure. under 180 characters.
- when_day: one of sun, mon, tue, wed, thu, fri, sat.
- when_time: 24 hour start time, "HH:MM".
- when_text: how a friend would say it ("saturday around 1").
- where_text: a kind of place, not a real business name. if you chose an event, its area.

things found around these thoughts. the backend searched public events, groups and marketplace listings. build one coherent move, not a list of links:
- use only ids from those lists. never invent an event, a group, a listing, a price, a date or a place.
- do not force anything in. leave out whatever does not make this experience better.
- event_id: at most one event, and only when going to it IS the experience. otherwise null.
- event_reason: one short line, under 80 characters. null when event_id is null.
- group_id: at most one group worth a look. otherwise null. nobody is joined to anything.
- group_reason: one short line, under 80 characters. null when group_id is null.
- listings: zero, one or two listings that would genuinely help, each with a reason under 80 characters. optional things to look at, never purchases.
- never say or imply that a friend is in a group, saw a listing or is going to an event.

when match is false: return empty participants, null ids, empty listings, and set when_day, when_time and when_text to the owner's first free slot you can see, or saturday 13:00 if none is visible. those fields are ignored.`;

function userPrompt(i: ConvergeInput): string {
  const sig = (s: SignalCandidate) =>
    `- user_id: ${s.userId} (${s.firstName}) | muse_id: ${s.museId} | they typed: "${s.rawText}" | understood: activity=${s.understood.activity}; time=${s.understood.time_hint}; vibe=${s.understood.vibe}; budget=${s.understood.budget_hint} | interests: ${s.interests.join(", ")} | free: ${s.free_windows.map((w) => `${w.day} ${w.start}-${w.end}`).join(", ") || "none listed"}`;
  return `today is ${i.today}.
the fresh thought, from ${i.owner.firstName} (the owner):
"${i.trigger.rawText}"
understood: activity=${i.trigger.understood.activity}; time=${i.trigger.understood.time_hint}; vibe=${i.trigger.understood.vibe}; budget=${i.trigger.understood.budget_hint}; group=${i.trigger.understood.group_size_hint}
owner: ${i.owner.firstName} | interests: ${i.owner.interests.join(", ")} | free: ${i.owner.free_windows.map((w) => `${w.day} ${w.start}-${w.end}`).join(", ") || "none listed"}

open thoughts from the owner's friends:
${i.signals.map(sig).join("\n")}

public events found:
${i.found.events.map((e) => `- ${e.id} | ${e.title} | ${e.when_day} ${e.when_time} (${e.when_text}) | ${e.area} | ${e.description}`).join("\n") || "- none"}

groups found:
${i.found.groups.map((g) => `- ${g.id} | ${g.name} | ${g.area} | ${g.description}`).join("\n") || "- none"}

marketplace listings found:
${i.found.listings.map((l) => `- ${l.id} | ${l.title} | $${l.price} | ${l.category.toLowerCase()} | ${l.place}`).join("\n") || "- none"}`;
}

// the participant gate for a convergence verdict, exported for the regression
// suite. it repairs exactly one slip: the model putting a candidate's muse_id
// in the user_id field while the muse_id field names that same candidate
// (observed in live traces). anything else that is not already a candidate
// user id paired with that user's own signal fails closed. when this returns
// null, every participant is in the candidate set, paired with their own
// signal, with no duplicates.
export function validateParticipants(o: Converged, signals: SignalCandidate[]): string | null {
  if (o.participants.length < 1 || o.participants.length > 3) return `expected 1 to 3 participants, got ${o.participants.length}`;
  // a friend can have several open signals. the participant must name one of
  // THAT friend's signals: any of them is a true reference to the friend,
  // and the engine consumes exactly the one named. a signal belonging to
  // someone else, or to nobody, fails closed.
  const byUser = new Map<string, SignalCandidate[]>();
  for (const s of signals) byUser.set(s.userId, [...(byUser.get(s.userId) ?? []), s]);
  const byMuse = new Map(signals.map((s) => [s.museId, s]));
  for (const p of o.participants) {
    if (!byUser.has(p.user_id)) {
      const meant = byMuse.get(p.user_id);
      if (meant && p.muse_id === meant.museId) p.user_id = meant.userId;
    }
  }
  const seen = new Set<string>();
  for (const p of o.participants) {
    const theirs = byUser.get(p.user_id);
    if (!theirs) return `unknown user id "${p.user_id}"`;
    if (!theirs.some((s) => s.museId === p.muse_id)) return `muse id "${p.muse_id}" is not ${p.user_id}'s open signal`;
    if (seen.has(p.user_id)) return `duplicate participant "${p.user_id}"`;
    seen.add(p.user_id);
  }
  return null;
}

export function converge(input: ConvergeInput): Promise<StructuredResult<Converged>> {
  const byUser = new Map(input.signals.map((s) => [s.userId, s]));
  return runStructured({
    job: "converge",
    schema: ConvergeSchema,
    schemaName: "convergence",
    system: SYSTEM,
    user: userPrompt(input),
    maxTokens: 2400,
    // a verdict is about these exact signals. an old one must never stand in for it,
    // and if muse is unreachable, convergence simply does not fire.
    noCache: true,
    check: (o) => {
      if (!o.match) return null;
      const pErr = validateParticipants(o, input.signals);
      if (pErr) return pErr;
      if (o.event_id === "" || o.event_id === "null") o.event_id = null;
      if (o.group_id === "" || o.group_id === "null") o.group_id = null;
      const ev = o.event_id ? input.found.events.find((e) => e.id === o.event_id) : null;
      if (o.event_id && !ev) return `unknown event id "${o.event_id}"`;
      if (o.group_id && !input.found.groups.some((g) => g.id === o.group_id)) return `unknown group id "${o.group_id}"`;
      if (o.listings.length > 2) o.listings = o.listings.slice(0, 2);
      const bad = o.listings.find((l) => !input.found.listings.some((x) => x.id === l.listing_id));
      if (bad) return `unknown listing id "${bad.listing_id}"`;
      if (new Set(o.listings.map((l) => l.listing_id)).size !== o.listings.length) return "the same listing twice";
      if (ev) {
        o.when_day = ev.when_day as Converged["when_day"];
        o.when_time = ev.when_time;
        o.when_text = ev.when_text;
      }
      if (!isTime(o.when_time)) return `bad when_time "${o.when_time}"`;
      if (!isFreeAt(input.owner.free_windows, o.when_day, o.when_time)) return `the owner is not free ${o.when_day} ${o.when_time}`;
      // every participant's own thought is being answered, so every participant must
      // actually be able to come. a plan that drops someone's availability is no match.
      for (const p of o.participants) {
        const sig = byUser.get(p.user_id);
        if (sig && !isFreeAt(sig.free_windows, o.when_day, o.when_time)) return `${p.user_id} is not free ${o.when_day} ${o.when_time}`;
      }
      return null;
    },
    summarize: (o) =>
      o.match
        ? `match · ${o.activity} · ${o.when_day} ${o.when_time} · with ${o.participants.map((p) => p.user_id).join(", ")}`
        : `no match · closest idea: ${o.activity}`,
  });
}
