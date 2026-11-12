import { z } from "zod";
import { runStructured, type StructuredResult } from "./run";
import { VOICE } from "./voice";

// job 5: a nudge from muse. looks at thoughts that never became plans and at what the
// person is into, and offers one thought they could send with a tap.

export const SuggestSchema = z.object({
  suggestion: z.string(),
  why: z.string(),
});

export type Suggested = z.infer<typeof SuggestSchema>;

export type SuggestInput = {
  userId: string;
  firstName: string;
  interests: string[];
  pastMuses: Array<{ text: string; daysAgo: number }>;
  today: string;
  preferCache?: boolean;
};

const SYSTEM = `you are muse, the quiet planner inside musing. offer this person one small thing they might want to do with friends soon. base it on a thought they shared before that never turned into a plan, or on their interests.

${VOICE}

return these fields:
- suggestion: the thought, written the way they would type it themselves, first person, casual, under 70 characters ("ramen night this week?"). it goes straight into their composer.
- why: your one line to them on why this one, under 110 characters. if it comes from an old thought, say roughly when ("you floated this three weeks ago"). never guilt them for not doing it.`;

export function suggest(input: SuggestInput): Promise<StructuredResult<Suggested>> {
  const past = input.pastMuses.length > 0 ? input.pastMuses.map((m) => `- ${m.daysAgo} days ago: "${m.text}"`).join("\n") : "- none yet";
  return runStructured({
    job: "suggest",
    schema: SuggestSchema,
    schemaName: "muse_suggests",
    system: SYSTEM,
    user: `today is ${input.today}.\n${input.firstName}'s interests: ${input.interests.join(", ")}\nthoughts they shared that never became a plan:\n${past}`,
    cacheKey: `suggest_${input.userId}`,
    preferCache: input.preferCache,
    summarize: (o) => `"${o.suggestion}"`,
  });
}
