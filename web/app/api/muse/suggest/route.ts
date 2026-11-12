import { serverDb } from "@/lib/db/server";
import { json, requireUser } from "@/lib/http";
import { suggest } from "@/lib/muse/suggest";
import { PlanError } from "@/lib/plans";
import { getSettings } from "@/lib/settings";
import { firstName } from "@/lib/time";
import type { Suggestion } from "@/lib/types";
import { todayLine } from "@/lib/when";

// muse suggests. GET serves this person's cached suggestion when there is one
// (one live call per person per reset). GET ?fresh=1 asks muse again.
export function GET(req: Request) {
  return json(async (): Promise<Suggestion> => {
    const fresh = new URL(req.url).searchParams.get("fresh") === "1";
    const user = await requireUser();
    const settings = await getSettings();
    if (!settings.muse_on) throw new PlanError("muse is off", 409);

    const db = serverDb();
    const [{ data: muses }, { data: plans }] = await Promise.all([
      db.from("muses").select("id,raw_text,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8),
      db.from("plans").select("muse_id").eq("starter_id", user.id),
    ]);
    const planned = new Set((plans ?? []).map((p) => p.muse_id as string));
    const pastMuses = (muses ?? [])
      .filter((m) => !planned.has(m.id as string))
      .map((m) => ({ text: m.raw_text as string, daysAgo: Math.max(0, Math.round((Date.now() - new Date(m.created_at as string).getTime()) / 86_400_000)) }));

    const r = await suggest({
      userId: user.id,
      firstName: firstName(user.name).toLowerCase(),
      interests: user.interests,
      pastMuses,
      today: todayLine(),
      preferCache: !fresh || settings.muse_replay,
    });
    return { suggestion: r.data.suggestion.toLowerCase(), why: r.data.why.toLowerCase(), source: r.source };
  });
}
