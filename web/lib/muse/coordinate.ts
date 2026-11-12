import { z } from "zod";
import type { FreeWindow, MemberStatus } from "@/lib/types";
import { DAYS, isTime, windowsLine } from "@/lib/when";
import { findLeak } from "./leak";
import { runStructured, type StructuredResult } from "./run";
import { VOICE } from "./voice";

// job 3, the re-solve: someone said "what if..." or shared something just between us.
// find the smallest change that works, and never say who asked or why.

export const CoordinateSchema = z.object({
  activity: z.string(),
  changed: z.boolean(),
  heads_up: z.string(),
  when_day: z.enum(DAYS),
  when_text: z.string(),
  when_time: z.string(),
  where_text: z.string(),
  works_for_asker: z.boolean(),
});

export type Coordinated = z.infer<typeof CoordinateSchema>;

export type CoordinateInput = {
  planId: string;
  today: string;
  plan: { activity: string; when_day: string; when_time: string; when_text: string; where_text: string };
  starter: { firstName: string; free_windows: FreeWindow[] };
  members: Array<{ id: string; firstName: string; status: MemberStatus; free_windows: FreeWindow[]; interests: string[] }>;
  asker: { id: string; firstName: string };
  /** said in the open to muse. may be empty when only a private limit was shared */
  counteroffer: string | null;
  /** confidential. constraints only. */
  privateLimits: Array<{ firstName: string; text: string }>;
  preferCache?: boolean;
};

const SYSTEM = `you are muse, the quiet planner inside musing. a small plan is already forming. one person just asked for a change, and some people have told you things in confidence. re-solve the plan.

${VOICE}

how to re-solve:
- make the smallest change that honors the request and every confidential limit.
- keep the people who already said yes if you can. check everyone's free windows. the starter must be free at the new time.
- if the request cannot work for the group, keep the plan as close as possible and set works_for_asker to false.
- if nothing needs to change, set changed to false and keep every field as it was.

confidential limits, the most important rule:
- they are constraints. the plan must satisfy them.
- never restate them. never hint at them. never explain a change with them. no "to keep it cheap", no "since some of us", no "for budget reasons", no "easier on everyone".
- never say who asked for a change or that anyone asked. present the new shape as simply the plan.
- do not reuse any distinctive word or number from a confidential limit anywhere in your output.

return these fields:
- activity: two to five lowercase words. usually unchanged.
- changed: true if day, time, place or activity is different now.
- heads_up: the one message everyone in the plan reads. one or two short sentences, under 160 characters. state the plan as it stands now. no names, no reasons, no apology.
- when_day: one of sun, mon, tue, wed, thu, fri, sat.
- when_time: 24 hour start time, "HH:MM".
- when_text: how a friend would say it ("sunday around 2").
- where_text: a kind of place, not a real business name.
- works_for_asker: true if the new plan gives the asker what they asked for.`;

function userPrompt(i: CoordinateInput): string {
  const members = i.members.map((m) => `- ${m.id} (${m.firstName}) | ${m.status === "down" ? "said yes" : m.status === "out" ? "passed" : "hasn't answered"} | free: ${windowsLine(m.free_windows)} | interests: ${m.interests.join(", ")}`);
  const limits = i.privateLimits.length > 0 ? i.privateLimits.map((l) => `- ${l.firstName}: "${l.text}"`).join("\n") : "- none";
  return `today is ${i.today}.

the plan right now: ${i.plan.activity} | ${i.plan.when_text} (${i.plan.when_day} ${i.plan.when_time}) | ${i.plan.where_text}
starter: ${i.starter.firstName} | free: ${windowsLine(i.starter.free_windows)}

people asked:
${members.join("\n")}

the request, from ${i.asker.firstName}: ${i.counteroffer ? `"${i.counteroffer}"` : "(no open request. they only shared something in confidence, below.)"}

confidential limits. constraints only. never restate or hint:
${limits}`;
}

export function coordinate(input: CoordinateInput, onText?: (delta: string) => void, onRestart?: () => void): Promise<StructuredResult<Coordinated>> {
  const limits = input.privateLimits.map((l) => l.text);
  // text that was already in the open before this call
  const publicBefore = [input.plan.activity, input.plan.when_text, input.plan.where_text, input.counteroffer ?? ""].join(" ");
  return runStructured({
    job: "coordinate",
    schema: CoordinateSchema,
    schemaName: "re_solve",
    system: SYSTEM,
    user: userPrompt(input),
    maxTokens: 2000,
    // minimal keeps the re-solve near the 5 second target; the leak check below is the net
    planId: input.planId,
    preferCache: input.preferCache,
    check: (o) => {
      if (!isTime(o.when_time)) return `bad when_time "${o.when_time}"`;
      const leak = findLeak([o.activity, o.heads_up, o.when_text, o.where_text].join(" "), limits, publicBefore);
      if (leak) return `private limit leak ("${leak}")`;
      const names = [input.asker.firstName, ...input.members.map((m) => m.firstName)].map((n) => n.toLowerCase());
      const said = o.heads_up.toLowerCase();
      const named = names.find((n) => new RegExp(`\\b${n}\\b`).test(said));
      if (named) return `heads_up names a person ("${named}")`;
      return null;
    },
    summarize: (o) => `${o.changed ? "changed" : "kept"} · ${o.when_day} ${o.when_time} · ${o.where_text.slice(0, 40)} · limits honored: ${limits.length}`,
    stream: onText ? { field: "heads_up", onText, onRestart } : undefined,
  });
}
