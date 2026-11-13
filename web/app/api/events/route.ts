import { readIntent } from "@/lib/discover";
import { serverDb } from "@/lib/db/server";
import { cleanText, json, requireUser } from "@/lib/http";
import { PlanError } from "@/lib/plans";
import { isDay, nextOccurrence } from "@/lib/when";

// "create event": a thought becomes a public in-app event that anyone in the app can see.
// from the composer, instead of a signal: POST { text }. from one of your own signals, after
// it went out: POST { signalId }, or from a plan you started: POST { planId }. either is the
// author's explicit tap. -> { eventId }
// it is a mock event: nothing is published to facebook.
export function POST(req: Request) {
  return json(async () => {
    const body = (await req.json().catch(() => ({}))) as { text?: unknown; signalId?: unknown; planId?: unknown };
    const user = await requireUser();
    const signalId = typeof body.planId === "string" ? await ownPlanSignal(body.planId, user.id) : body.signalId;
    const text = typeof signalId === "string" ? await ownSignalText(signalId, user.id) : cleanText(body.text, 280);
    if (!text || text.length < 2) throw new PlanError("say a little more (2 to 280 characters)");
    // a day named in the words sets the date. a time of day sets the hour. no day, no date yet.
    const intent = readIntent(text);
    const day = intent.days[0] ?? intent.today;
    const time = intent.part === "night" ? "19:00" : intent.part === "morning" ? "10:00" : "13:00";
    const startsAt = isDay(day) ? nextOccurrence(day, time) : null;
    const title = text.length > 80 ? `${text.slice(0, 77).trimEnd()}...` : text;
    const { data, error } = await serverDb()
      .from("events")
      .insert({ plan_id: null, host_id: user.id, visibility: "public", title: title[0]!.toUpperCase() + title.slice(1), description: text, starts_at: startsAt?.toISOString() ?? null, location: null })
      .select("id")
      .single();
    if (error || !data) throw new Error(`event insert: ${error?.message}`);
    return { eventId: data.id as string };
  });
}

// only the author can make their own signal public
async function ownSignalText(signalId: string, userId: string): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(signalId)) throw new PlanError("signal not found", 404);
  const { data } = await serverDb().from("muses").select("raw_text").eq("id", signalId).eq("user_id", userId).maybeSingle();
  if (!data) throw new PlanError("signal not found", 404);
  return data.raw_text as string;
}

// only the starter can make their own plan public. it goes out as the thought behind it.
async function ownPlanSignal(planId: string, userId: string): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(planId)) throw new PlanError("plan not found", 404);
  const { data } = await serverDb().from("plans").select("muse_id").eq("id", planId).eq("starter_id", userId).maybeSingle();
  if (!data?.muse_id) throw new PlanError("plan not found", 404);
  return data.muse_id as string;
}
