import { cleanText, json, requireUser } from "@/lib/http";
import { describeSchedule } from "@/lib/muse/schedule";
import { PlanError } from "@/lib/plans";
import { parseRules, ymd } from "@/lib/schedule";
import { saveRules, scheduleOf } from "@/lib/scheduleStore";
import { getSettings } from "@/lib/settings";
import { todayLine } from "@/lib/when";

export const maxDuration = 120;

// POST { text } -> { rules, windows }. the person describes when they are free in their own
// words and taps submit; muse reads that into rules, and the rules are saved as their schedule.
// one muse call. the description itself is not stored, and nothing here is cached or replayed.
export function POST(req: Request) {
  return json(async () => {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { text?: unknown };
    const text = cleanText(body.text, 1000);
    if (!text) throw new PlanError("describe when you're free first");
    const settings = await getSettings();
    if (!settings.muse_on || settings.muse_replay) throw new PlanError("muse is off right now, so it can't read a description. you can still edit a rule by hand.", 409);

    const now = new Date();
    let read;
    try {
      read = await describeSchedule({ text, today: todayLine(now), todayIso: ymd(now), existing: scheduleOf(user).rules });
    } catch {
      throw new PlanError("muse couldn't read that one. try saying it another way.", 502);
    }
    const rules = parseRules(read.data.rules);
    if (typeof rules === "string") throw new PlanError("muse couldn't read that one. try saying it another way.", 502);
    if (rules.length === 0) throw new PlanError("muse didn't find a schedule in that. try a day and a time, like “free tuesdays after 6”.");
    return saveRules(user.id, rules);
  });
}
