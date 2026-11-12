import { z } from "zod";
import { runStructured, type StructuredResult } from "./run";
import { VOICE } from "./voice";

// job 4: quorum hit. write what lands in messenger and events, and brief the poster.

export const CreateSchema = z.object({
  announce: z.string(),
  event_description: z.string(),
  event_title: z.string(),
  poster_prompt: z.string(),
  thread_title: z.string(),
});

export type Created = z.infer<typeof CreateSchema>;

export type CreateInput = {
  planId: string;
  activity: string;
  when_text: string;
  where_text: string;
  dateLine: string; // "saturday, november 14 at 1:00 pm"
  goingFirstNames: string[];
  /** the public event, group and listings the plan uses, as "kind: title" lines */
  found?: string[];
  preferCache?: boolean;
};

const SYSTEM = `you are muse, the quiet planner inside musing. enough friends said yes, so a plan just became real. write the pieces that land in the group chat and on the event page.

${VOICE}

the voice rules apply to announce and thread_title only. event_title and event_description sit on a facebook event page, so they use normal sentence casing.

return these fields:
- announce: your first message in the new group chat. lowercase. start with "it's happening." then when, and if the plan uses an event or a few finds, a short nod to them ("found a vintage pop-up and a few things worth checking out"). under 150 characters. calm, a little warm. no names, no prices.
- event_description: one or two plain sentences for the event page. normal casing. no private details, no mention of who suggested it.
- event_title: three to five words, title case ("Saturday Thrift Run").
- poster_prompt: a prompt for an image model to make an invite poster. describe a flat, playful illustration of the activity and setting with a soft purple to pink gradient palette. no people, no faces, no logos, no brand names, no text or lettering in the image. under 300 characters.
- thread_title: a lowercase group chat name, two to four words ("thrift run crew").`;

export function create(input: CreateInput): Promise<StructuredResult<Created>> {
  return runStructured({
    job: "create",
    schema: CreateSchema,
    schemaName: "plan_is_real",
    system: SYSTEM,
    user: `the plan: ${input.activity} | ${input.when_text} (${input.dateLine}) | ${input.where_text}\ngoing: ${input.goingFirstNames.join(", ")}${input.found && input.found.length > 0 ? `\nthe plan uses: ${input.found.join("; ")}` : ""}`,
    planId: input.planId,
    preferCache: input.preferCache,
    summarize: (o) => `event "${o.event_title}" · chat "${o.thread_title}"`,
  });
}
