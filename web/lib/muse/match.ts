import { z } from "zod";
import type { FreeWindow } from "@/lib/types";
import { DAYS, isTime, windowsLine } from "@/lib/when";
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
});

export type Matched = z.infer<typeof MatchSchema>;

export type Candidate = {
  id: string;
  firstName: string;
  interests: string[];
  free_windows: FreeWindow[];
  /** only present when this friend opted in to sharing reels topics */
  reelsTopics: string[] | null;
};

export type MatchInput = {
  starter: { id: string; firstName: string; interests: string[]; free_windows: FreeWindow[] };
  rawText: string;
  understood: Understood;
  candidates: Candidate[];
  today: string;
  planId?: string | null;
  preferCache?: boolean;
};

const SYSTEM = `you are muse, the quiet planner inside musing. someone shared a half-formed thought. you now pick the few friends most likely to actually say yes, and shape a first plan. the starter never has to ask anyone. you ask, privately, one person at a time.

${VOICE}

rules for picking:
- pick 3 friends, 4 only if a fourth is a clearly strong fit. fewer and better beats more.
- only use user_id values from the candidate list. never invent an id.
- a good pick shares the interest AND is free when the starter is free. someone who can't make the time is not a good pick.
- choose one day and start time inside the starter's free windows where the most picks are free.

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
- where_text: a kind of place, not a real business name ("a couple of thrift spots downtown, coffee after").`;

function userPrompt(i: MatchInput): string {
  const lines = i.candidates.map((c) => {
    const reels = c.reelsTopics && c.reelsTopics.length > 0 ? ` | lately into: ${c.reelsTopics.join(", ")}` : "";
    return `- ${c.id} (${c.firstName}) | interests: ${c.interests.join(", ")} | free: ${windowsLine(c.free_windows)}${reels}`;
  });
  return `today is ${i.today}.
starter: ${i.starter.firstName} | interests: ${i.starter.interests.join(", ")} | free: ${windowsLine(i.starter.free_windows)}
they typed: "${i.rawText}"
what you understood: activity=${i.understood.activity}; time=${i.understood.time_hint}; vibe=${i.understood.vibe}; budget=${i.understood.budget_hint}; group=${i.understood.group_size_hint}

candidate friends:
${lines.join("\n")}`;
}

export function match(input: MatchInput, onText?: (delta: string) => void, onRestart?: () => void): Promise<StructuredResult<Matched>> {
  const allowed = new Set(input.candidates.map((c) => c.id));
  return runStructured({
    job: "match",
    schema: MatchSchema,
    schemaName: "the_mix",
    system: SYSTEM,
    user: userPrompt(input),
    maxTokens: 2000,
    planId: input.planId,
    preferCache: input.preferCache,
    // the backend is the only source of user ids. anything else is rejected here.
    check: (o) => {
      if (o.picks.length < 2 || o.picks.length > 4) return `expected 2 to 4 picks, got ${o.picks.length}`;
      const seen = new Set<string>();
      for (const p of o.picks) {
        if (!allowed.has(p.user_id)) return `unknown user id "${p.user_id}"`;
        if (seen.has(p.user_id)) return `duplicate pick "${p.user_id}"`;
        seen.add(p.user_id);
      }
      if (!isTime(o.when_time)) return `bad when_time "${o.when_time}"`;
      return null;
    },
    summarize: (o) => `${o.activity} · ${o.when_day} ${o.when_time} · picked ${o.picks.map((p) => p.user_id).join(", ")}`,
    stream: onText ? { field: "hear_me_out", onText, onRestart } : undefined,
  });
}
