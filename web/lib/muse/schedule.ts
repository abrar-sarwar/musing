import { z } from "zod";
import { parseRules } from "@/lib/schedule";
import type { ScheduleRule } from "@/lib/types";
import { DAYS } from "@/lib/when";
import { runStructured, type StructuredResult } from "./run";

// a person describes when they are free, in their own words, and muse reads it into a few
// rules. this is the person's own private schedule: it is never cached, never replayed for
// anyone else, and the trace line says only how many rules came back.

const RuleSchema = z.object({
  days: z.array(z.enum(DAYS)),
  end: z.string().nullable(),
  from: z.string().nullable(),
  kind: z.enum(["free", "ask", "busy"]),
  note: z.string().nullable(),
  start: z.string().nullable(),
  until: z.string().nullable(),
});

export const ScheduleSchema = z.object({ rules: z.array(RuleSchema) });

const SYSTEM = `you read one person's description of when they are free and turn it into a short list of schedule rules. a few rules, not a timetable. only what they said: never invent hours, days or dates they did not give.

each rule has:
- kind: "free" (they are usually free then), "ask" (maybe or sometimes: check with them each time), or "busy" (they are not free then: work, class, away).
- days: the weekdays it repeats on, from sun mon tue wed thu fri sat. empty when the rule is a stretch of dates rather than a weekly pattern.
- start, end: 24-hour "HH:MM", start before end. both null when they gave no hours or mean the whole day.
- from, until: "YYYY-MM-DD", the first and last day the rule holds. null when not given. "after nov 20" means from the 21st. "until the end of the year" means until december 31. a date with no year is the next one coming after today.
- note: null, except for a rule with no hours where a few plain words help ("no hours or pattern given"). under 80 characters. sentence case.

how to read it:
- days that share the same hours and dates are one rule ("tuesdays and thursdays 6 to 10" is one rule with two days).
- "some saturdays", "saturdays sometimes", "not every week" is one "ask" rule with no hours. do not guess a pattern.
- work, class or anything they cannot skip is "busy". time away is "busy" with from and until, empty days and null hours.
- "evenings" with no hours is 18:00 to 22:00. "mornings" is 08:00 to 12:00. "afternoons" is 12:00 to 17:00. "all day" is null hours.
- you may be given the rules they already have. return the full list as it should stand now: keep a rule the new description does not touch, change or drop one it replaces or contradicts, add what is new. if the description says to start over, return only what it describes.
- if the text describes no schedule at all, return an empty list.`;

export type DescribeInput = { text: string; today: string; todayIso: string; existing: ScheduleRule[] };

export function describeSchedule(input: DescribeInput): Promise<StructuredResult<z.infer<typeof ScheduleSchema>>> {
  const existing = input.existing.map(({ kind, days, start, end, from, until, note }) => ({ kind, days, start, end, from, until, note }));
  return runStructured({
    job: "schedule",
    schema: ScheduleSchema,
    schemaName: "schedule_rules",
    system: SYSTEM,
    user: `today is ${input.today} (${input.todayIso}).\nrules they already have: ${existing.length > 0 ? JSON.stringify(existing) : "none"}\nthey wrote: "${input.text}"`,
    maxTokens: 2500,
    // their schedule is theirs: no shared cache slot, no replay
    noCache: true,
    summarize: (o) => `${o.rules.length} schedule rule${o.rules.length === 1 ? "" : "s"}`,
    check: (o) => {
      const parsed = parseRules(o.rules);
      return typeof parsed === "string" ? parsed : null;
    },
  });
}
