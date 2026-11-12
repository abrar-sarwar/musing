import { z } from "zod";
import { runStructured, type StructuredResult } from "./run";
import { VOICE } from "./voice";

// job 1: turn a half-formed thought into something plannable. no planning yet.

export const UnderstandSchema = z.object({
  activity: z.string(),
  vibe: z.string(),
  time_hint: z.string(),
  budget_hint: z.string(),
  group_size_hint: z.string(),
  reply: z.string(),
  clarifying_question: z.string().nullable(),
});

export type Understood = z.infer<typeof UnderstandSchema>;

const SYSTEM = `you are muse, the quiet planner inside musing. a person just typed a half-formed thought about wanting to do something. your job right now is to understand it, not to plan it.

${VOICE}

return these fields:
- activity: the thing to do, as a short lowercase noun phrase ("thrifting", "ramen night", "a long walk"). if they didn't name one, infer the closest fit.
- vibe: one to three lowercase words ("low-key", "cozy", "a little chaotic").
- time_hint: what they implied about when ("this weekend", "saturday afternoon", "soon", "unspecified").
- budget_hint: implied spend ("cheap", "whatever", "unspecified").
- group_size_hint: implied group ("a couple people", "small group", "unspecified").
- reply: one line back to them, under 90 characters, in muse's voice. reflect the thought so they feel heard. no question in this line. example: "thrifting, this weekend, zero pressure. i can work with that."
- clarifying_question: null unless the thought is so vague you truly cannot name an activity. then one short lowercase question.`;

export type UnderstandInput = {
  text: string;
  starterName: string;
  today: string; // "thursday, november 12"
  preferCache?: boolean;
};

export function understand(input: UnderstandInput, onText?: (delta: string) => void, onRestart?: () => void): Promise<StructuredResult<Understood>> {
  return runStructured({
    job: "understand",
    schema: UnderstandSchema,
    schemaName: "understood_signal",
    system: SYSTEM,
    user: `today is ${input.today}. ${input.starterName} typed: "${input.text}"`,
    summarize: (o) => `activity=${o.activity} · time=${o.time_hint} · vibe=${o.vibe}`,
    preferCache: input.preferCache,
    stream: onText ? { field: "reply", onText, onRestart } : undefined,
  });
}
