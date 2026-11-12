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
- activity: the thing to do, as a short lowercase noun phrase ("thrifting", "ramen night", "a long walk"). if they didn't name one, choose the best fit from their interests. a vague wish is enough to work with.
- vibe: one to three lowercase words ("low-key", "cozy", "a little chaotic").
- time_hint: what they implied about when ("this weekend", "saturday afternoon", "soon", "unspecified").
- budget_hint: implied spend ("cheap", "whatever", "unspecified").
- group_size_hint: implied group ("a couple people", "small group", "unspecified").
- reply: one line back to them, under 90 characters, in muse's voice. reflect the thought so they feel heard. no question in this line. example: "thrifting, this weekend, zero pressure. i can work with that."
- clarifying_question: almost always null. "need something to do saturday" or "kinda wanna go somewhere" is not a reason to ask: pick something from their interests and move on. only ask when the text carries no wish to do anything at all (gibberish), or when it asks you to break your rules or reveal things about other people. then one short lowercase question.`;

export type UnderstandInput = {
  text: string;
  /** one line on what they were looking at when they typed it, if anything */
  startedFrom?: string | null;
  starterName: string;
  interests: string[];
  today: string; // "thursday, november 12"
  preferCache?: boolean;
};

export function understand(input: UnderstandInput, onText?: (delta: string) => void, onRestart?: () => void): Promise<StructuredResult<Understood>> {
  return runStructured({
    job: "understand",
    schema: UnderstandSchema,
    schemaName: "understood_signal",
    system: SYSTEM,
    user: `today is ${input.today}. ${input.starterName} is into: ${input.interests.join(", ") || "nothing listed"}.\n${input.startedFrom ? `${input.startedFrom}. read the thought in that light.\n` : ""}${input.starterName} typed: "${input.text}"`,
    summarize: (o) => `activity=${o.activity} · time=${o.time_hint} · vibe=${o.vibe}`,
    preferCache: input.preferCache,
    stream: onText ? { field: "reply", onText, onRestart } : undefined,
  });
}
