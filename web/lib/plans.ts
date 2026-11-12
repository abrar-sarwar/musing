import { serverDb } from "@/lib/db/server";
import { planOpportunities } from "@/lib/discover";
import { coordinate } from "@/lib/muse/coordinate";
import { create } from "@/lib/muse/create";
import type { Matched } from "@/lib/muse/match";
import { cacheGet, cachePut, generateImage } from "@/lib/muse/run";
import { getSettings } from "@/lib/settings";
import { firstName } from "@/lib/time";
import type { MemberStatus, Muse, MusingHome, Person, Plan, PlanMember, PlanView, User } from "@/lib/types";
import { isDay, isFreeAt, isTime, nextOccurrence, todayLine } from "@/lib/when";

// the plan engine. every rule about who may see what lives in this file.

export const QUORUM = 2; // friends needed. starter + 2 = a plan.
const POLL_INVITES = 5;

export class PlanError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const lower = (s: string) => s.toLowerCase();
const person = (u: User): Person => ({ id: u.id, name: u.name, avatar_seed: u.avatar_seed });

type Bundle = { plan: Plan; members: PlanMember[]; rawText: string | null; users: Map<string, User> };

async function loadBundle(planId: string): Promise<Bundle | null> {
  const db = serverDb();
  const { data: plan, error } = await db.from("plans").select("*").eq("id", planId).maybeSingle();
  if (error) throw new Error(`plan: ${error.message}`);
  if (!plan) return null;
  const [{ data: members, error: e2 }, { data: muse }] = await Promise.all([
    db.from("plan_members").select("*").eq("plan_id", planId),
    db.from("muses").select("raw_text").eq("id", plan.muse_id).maybeSingle(),
  ]);
  if (e2) throw new Error(`plan_members: ${e2.message}`);
  const ids = [plan.starter_id, ...(members ?? []).map((m) => m.user_id as string)];
  const { data: users, error: e3 } = await db.from("users").select("*").in("id", ids);
  if (e3) throw new Error(`users: ${e3.message}`);
  return {
    plan: plan as Plan,
    members: (members ?? []) as PlanMember[],
    rawText: (muse?.raw_text as string | undefined) ?? null,
    users: new Map((users as User[]).map((u) => [u.id, u])),
  };
}

// shape one plan for one viewer. returns null when the viewer has no business seeing it.
async function buildView(b: Bundle, viewerId: string): Promise<PlanView | null> {
  const { plan, members, users } = b;
  const starter = users.get(plan.starter_id);
  if (!starter) return null;
  const isStarter = viewerId === plan.starter_id;
  const mine = members.find((m) => m.user_id === viewerId) ?? null;
  if (!isStarter && !mine) return null;
  if (!isStarter && plan.state === "draft") return null; // nothing has been sent yet

  const down = members.filter((m) => m.status === "down");
  const happening = plan.state === "happening";

  let privateLimit: string | null = null;
  if (mine) {
    const { data } = await serverDb().from("plan_private_limits").select("limit_text").eq("plan_id", plan.id).eq("user_id", viewerId).maybeSingle();
    privateLimit = (data?.limit_text as string | undefined) ?? null;
  }

  return {
    id: plan.id,
    state: plan.state,
    version: plan.version,
    solving: plan.solving,
    museOn: plan.muse_on,
    role: isStarter ? "starter" : "member",
    starter: person(starter),
    rawText: isStarter || !plan.muse_on ? b.rawText : null,
    activity: plan.activity,
    when: plan.when_text,
    where: plan.where_text,
    pitch: isStarter ? plan.pitch : null,
    note: plan.note,
    quorum: plan.quorum,
    invited: members.length,
    downCount: down.length,
    // the starter sees who muse picked and why. never who answered what.
    picks: isStarter
      ? members
          .map((m) => ({ user: users.get(m.user_id), reason: m.reason }))
          .filter((p): p is { user: User; reason: string | null } => Boolean(p.user))
          .map((p) => ({ user: person(p.user), reason: p.reason }))
      : null,
    // names appear only once it's real, and only the people who are in.
    going: happening ? [starter, ...down.map((m) => users.get(m.user_id)).filter((u): u is User => Boolean(u))].map(person) : null,
    me: mine ? { personalAsk: mine.personal_ask, status: mine.status, counteroffer: mine.counteroffer, privateLimit } : null,
    // the chat is for people who are in. the event page is fine for anyone who was asked.
    threadId: happening && (isStarter || mine?.status === "down") ? plan.thread_id : null,
    eventId: happening ? plan.event_id : null,
    opportunities: await planOpportunities(plan.id),
    updatedAt: plan.updated_at,
  };
}

export async function getPlanView(planId: string, viewerId: string): Promise<PlanView> {
  const b = await loadBundle(planId);
  const view = b ? await buildView(b, viewerId) : null;
  if (!view) throw new PlanError("plan not found", 404);
  return view;
}

export async function getHome(viewerId: string): Promise<MusingHome> {
  const db = serverDb();
  const [settings, { data: started }, { data: memberOf }, { data: muses }] = await Promise.all([
    getSettings(),
    db.from("plans").select("id").eq("starter_id", viewerId).order("updated_at", { ascending: false }).limit(10),
    db.from("plan_members").select("plan_id").eq("user_id", viewerId).neq("status", "out"),
    db.from("muses").select("*").eq("user_id", viewerId).order("created_at", { ascending: false }).limit(8),
  ]);
  const views = async (ids: string[]) => {
    const out = await Promise.all(ids.map(async (id) => {
      const b = await loadBundle(id);
      return b ? buildView(b, viewerId) : null;
    }));
    return out.filter((v): v is PlanView => v !== null).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  };
  const [mine, asks] = await Promise.all([
    views((started ?? []).map((p) => p.id as string)),
    views((memberOf ?? []).map((m) => m.plan_id as string)),
  ]);
  return {
    settings,
    mine,
    asks: asks.filter((a) => a.state === "proposing" || a.state === "happening"),
    muses: (muses ?? []) as Muse[],
  };
}

// ---------- creating ----------

export async function createDraftFromMatch(museId: string, starterId: string, m: Matched): Promise<string> {
  const db = serverDb();
  const { data: plan, error } = await db
    .from("plans")
    .insert({
      muse_id: museId,
      starter_id: starterId,
      state: "draft",
      activity: lower(m.activity),
      when_text: lower(m.when_text),
      when_day: m.when_day,
      when_time: m.when_time,
      where_text: lower(m.where_text),
      pitch: lower(m.hear_me_out),
      quorum: Math.min(QUORUM, m.picks.length),
      muse_on: true,
      // a plan built around a public event keeps that event's day, time and place
      public_event_id: m.event_id,
    })
    .select("id")
    .single();
  if (error || !plan) throw new Error(`plan insert: ${error?.message}`);
  const { error: e2 } = await db.from("plan_members").insert(
    m.picks.map((p) => ({ plan_id: plan.id, user_id: p.user_id, reason: lower(p.reason), personal_ask: lower(p.personal_ask) })),
  );
  if (e2) throw new Error(`plan_members insert: ${e2.message}`);
  const found = [
    ...(m.event_id ? [{ plan_id: plan.id, kind: "event", ref_id: m.event_id, reason: m.event_reason ? lower(m.event_reason) : null }] : []),
    ...(m.group_id ? [{ plan_id: plan.id, kind: "group", ref_id: m.group_id, reason: m.group_reason ? lower(m.group_reason) : null }] : []),
    ...m.listings.map((l) => ({ plan_id: plan.id, kind: "listing", ref_id: l.listing_id, reason: lower(l.reason) })),
  ];
  if (found.length > 0) {
    const { error: e3 } = await db.from("plan_opportunities").insert(found);
    if (e3) throw new Error(`plan_opportunities insert: ${e3.message}`);
  }
  return plan.id as string;
}

// muse off: what's left is a plain poll. no mix, no reasons, no re-solve. it goes
// to the first few friends as typed.
export async function createPoll(starterId: string, text: string): Promise<string> {
  const db = serverDb();
  const { data: edges, error: e0 } = await db.from("friendships").select("friend_id").eq("user_id", starterId).order("friend_id").limit(POLL_INVITES);
  if (e0) throw new Error(`friends: ${e0.message}`);
  const friendIds = (edges ?? []).map((e) => e.friend_id as string);
  if (friendIds.length === 0) throw new PlanError("no friends to ask yet");
  const { data: muse, error: e1 } = await db.from("muses").insert({ user_id: starterId, raw_text: text }).select("id").single();
  if (e1 || !muse) throw new Error(`muse insert: ${e1?.message}`);
  const { data: plan, error } = await db
    .from("plans")
    .insert({ muse_id: muse.id, starter_id: starterId, state: "proposing", activity: text, quorum: Math.min(QUORUM, friendIds.length), muse_on: false })
    .select("id")
    .single();
  if (error || !plan) throw new Error(`plan insert: ${error?.message}`);
  const { error: e2 } = await db.from("plan_members").insert(friendIds.map((id) => ({ plan_id: plan.id, user_id: id })));
  if (e2) throw new Error(`plan_members insert: ${e2.message}`);
  return plan.id as string;
}

// ---------- starter actions ----------

export async function sendPlan(planId: string, userId: string): Promise<void> {
  const { data, error } = await serverDb()
    .from("plans")
    .update({ state: "proposing", updated_at: new Date().toISOString() })
    .eq("id", planId)
    .eq("starter_id", userId)
    .eq("state", "draft")
    .select("id");
  if (error) throw new Error(`send: ${error.message}`);
  if (!data || data.length === 0) throw new PlanError("nothing to send", 409);
}

// "not this" on a draft, or quietly calling it off before it's real.
export async function cancelPlan(planId: string, userId: string): Promise<void> {
  const { data, error } = await serverDb().from("plans").delete().eq("id", planId).eq("starter_id", userId).in("state", ["draft", "proposing", "faded"]).select("id");
  if (error) throw new Error(`cancel: ${error.message}`);
  if (!data || data.length === 0) throw new PlanError("can't call this one off", 409);
}

// ---------- friend actions ----------

export type Settled = { state: Plan["state"]; becameReal: boolean };

export async function respond(planId: string, userId: string, status: Extract<MemberStatus, "down" | "out">): Promise<Settled> {
  const db = serverDb();
  const b = await loadBundle(planId);
  if (!b) throw new PlanError("plan not found", 404);
  const mine = b.members.find((m) => m.user_id === userId);
  // a draft doesn't exist as far as anyone but the starter is concerned
  if (!mine || b.plan.state === "draft") throw new PlanError("plan not found", 404);
  if (b.plan.state !== "proposing" && b.plan.state !== "happening") throw new PlanError("this plan isn't open", 409);

  const now = new Date().toISOString();
  const { error } = await db.from("plan_members").update({ status, updated_at: now }).eq("plan_id", planId).eq("user_id", userId);
  if (error) throw new Error(`respond: ${error.message}`);

  // someone joining after it's already real just gets added to the chat
  if (b.plan.state === "happening" && b.plan.thread_id) await syncThreadMembers(planId, b.plan.thread_id, b.plan.starter_id);

  return settle(planId);
}

// after any change in answers: has it become real, or quietly impossible?
async function settle(planId: string): Promise<Settled> {
  const db = serverDb();
  const now = new Date().toISOString();
  const { data: plan } = await db.from("plans").select("state,quorum,version").eq("id", planId).single();
  const { data: members } = await db.from("plan_members").select("status").eq("plan_id", planId);
  const list = members ?? [];
  const down = list.filter((m) => m.status === "down").length;
  const out = list.filter((m) => m.status === "out").length;
  const quorum = (plan?.quorum as number) ?? QUORUM;

  if (plan?.state === "proposing" && down >= quorum) {
    // conditional update: only one request wins the transition, so the event is made once
    const { data: won } = await db.from("plans").update({ state: "happening", updated_at: now }).eq("id", planId).eq("state", "proposing").select("id");
    return { state: "happening", becameReal: Boolean(won && won.length > 0) };
  }
  if (plan?.state === "proposing" && list.length - out < quorum) {
    await db.from("plans").update({ state: "faded", updated_at: now }).eq("id", planId).eq("state", "proposing");
    return { state: "faded", becameReal: false };
  }
  // touch the row so everyone's realtime subscription fires and counts refresh
  await db.from("plans").update({ updated_at: now }).eq("id", planId);
  return { state: (plan?.state as Plan["state"]) ?? "proposing", becameReal: false };
}

async function syncThreadMembers(planId: string, threadId: string, starterId: string) {
  const db = serverDb();
  const { data: members } = await db.from("plan_members").select("user_id,status").eq("plan_id", planId);
  const ids = [starterId, ...(members ?? []).filter((m) => m.status === "down").map((m) => m.user_id as string)];
  await db.from("threads").update({ member_ids: ids }).eq("id", threadId);
}

// ---------- quorum: the plan becomes real ----------

// runs after the response. writes the group chat, the plan card and the event,
// then kicks off the poster without waiting for it.
export async function makeItReal(planId: string): Promise<void> {
  const db = serverDb();
  const b = await loadBundle(planId);
  if (!b || b.plan.state !== "happening" || b.plan.thread_id) return;
  const { plan, members, users } = b;
  if (!plan.muse_on) return; // poll mode stops at the count

  const settings = await getSettings();
  const going = [plan.starter_id, ...members.filter((m) => m.status === "down").map((m) => m.user_id)];
  const startsAt = isDay(plan.when_day) && isTime(plan.when_time) ? nextOccurrence(plan.when_day, plan.when_time) : null;
  const dateLine = startsAt
    ? `${startsAt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at ${startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`.toLowerCase()
    : (plan.when_text ?? "soon");

  let made: { announce: string; event_description: string; event_title: string; poster_prompt: string; thread_title: string };
  try {
    const r = await create({
      planId,
      activity: plan.activity ?? "a plan",
      when_text: plan.when_text ?? "soon",
      where_text: plan.where_text ?? "somewhere easy",
      dateLine,
      goingFirstNames: going.map((id) => lower(firstName(users.get(id)?.name ?? id))),
      preferCache: settings.muse_replay,
    });
    made = r.data;
  } catch {
    // muse is down and there is no cache. the plan is still real, so say it plainly.
    made = {
      announce: `it's happening. ${plan.activity}, ${plan.when_text}. ${plan.where_text}.`,
      event_description: `${plan.activity}, ${plan.when_text}.`,
      event_title: plan.activity ?? "A plan",
      poster_prompt: "",
      thread_title: plan.activity ?? "the plan",
    };
  }

  // the public event, group and listings this plan uses ride along on the card. the
  // private event made below is this group's plan to go, not a second public event.
  const found = (await planOpportunities(planId)).map((o) => ({ kind: o.kind, id: o.id, title: o.title, sub: o.sub }));
  const { data: thread, error: e1 } = await db.from("threads").insert({ title: lower(made.thread_title), member_ids: going }).select("id").single();
  if (e1 || !thread) throw new Error(`thread insert: ${e1?.message}`);
  const { data: event, error: e2 } = await db
    .from("events")
    .insert({ plan_id: planId, host_id: plan.starter_id, title: made.event_title, description: made.event_description, starts_at: startsAt?.toISOString() ?? null, location: plan.where_text })
    .select("id")
    .single();
  if (e2 || !event) throw new Error(`event insert: ${e2?.message}`);
  await db.from("messages").insert({
    thread_id: thread.id,
    sender_id: null,
    body: lower(made.announce),
    card: { type: "plan", plan_id: planId, event_id: event.id, title: plan.activity, when: plan.when_text, where: plan.where_text, line: lower(made.announce), found },
  });
  await db.from("plans").update({ thread_id: thread.id, event_id: event.id, updated_at: new Date().toISOString() }).eq("id", planId);

  if (settings.posters_on && made.poster_prompt) {
    void makePoster(planId, event.id as string, made.poster_prompt, settings.muse_replay).catch((e) => console.error("poster failed:", e));
  }
}

// muse image takes ~45s. the event shows a gradient until this lands.
async function makePoster(planId: string, eventId: string, prompt: string, replay: boolean): Promise<void> {
  const img = await generateImage({ job: "create", prompt, size: "1024x1024", planId, cacheKey: "poster", preferCache: replay });
  await cachePut(`poster_${eventId}`, { b64: img.b64, format: img.format });
  await serverDb().from("events").update({ poster_url: `/api/posters/${eventId}` }).eq("id", eventId);
}

export async function getPoster(eventId: string): Promise<Buffer | null> {
  const hit = (await cacheGet(`poster_${eventId}`)) as { b64?: string } | null;
  return hit?.b64 ? Buffer.from(hit.b64, "base64") : null;
}

// ---------- "what if..." and "just between us": the live re-solve ----------

export type WhatIfInput = { planId: string; userId: string; counteroffer: string | null; privateLimit: string | null };
export type WhatIfResult = { changed: boolean; worksForAsker: boolean; note: string; source: "live" | "cache"; latencyMs: number; settled: Settled };

export async function whatIf(input: WhatIfInput, onText: (delta: string) => void, onRestart: () => void): Promise<WhatIfResult> {
  const db = serverDb();
  const b = await loadBundle(input.planId);
  if (!b) throw new PlanError("plan not found", 404);
  const { plan, members, users } = b;
  const mine = members.find((m) => m.user_id === input.userId) ?? null;
  const isStarter = plan.starter_id === input.userId;
  if (!mine && !isStarter) throw new PlanError("plan not found", 404);
  if (plan.state !== "proposing") throw new PlanError("this plan isn't open to changes", 409);
  if (!plan.muse_on) throw new PlanError("muse is off for this plan", 409);
  if (plan.solving) throw new PlanError("muse is already reworking this one. give it a sec.", 409);
  if (!input.counteroffer && !input.privateLimit) throw new PlanError("say what you'd change");
  const starter = users.get(plan.starter_id);
  const asker = users.get(input.userId);
  if (!starter || !asker) throw new PlanError("plan not found", 404);

  const now = () => new Date().toISOString();
  if (mine && input.counteroffer) {
    await db.from("plan_members").update({ counteroffer: input.counteroffer, updated_at: now() }).eq("plan_id", plan.id).eq("user_id", input.userId);
  }
  if (input.privateLimit) {
    const { error } = await db.from("plan_private_limits").upsert({ plan_id: plan.id, user_id: input.userId, limit_text: input.privateLimit, updated_at: now() });
    if (error) throw new Error(`private limit: ${error.message}`);
  }
  // everyone watching this plan sees "muse is reworking it" within a second or two.
  // conditional update: of two requests that arrive together, only one gets to re-solve.
  const { data: locked } = await db.from("plans").update({ solving: true, updated_at: now() }).eq("id", plan.id).eq("solving", false).eq("state", "proposing").select("id");
  if (!locked || locked.length === 0) throw new PlanError("muse is already reworking this one. give it a sec.", 409);

  try {
    const [{ data: limits }, settings] = await Promise.all([db.from("plan_private_limits").select("user_id,limit_text").eq("plan_id", plan.id), getSettings()]);
    const r = await coordinate(
      {
        planId: plan.id,
        today: todayLine(),
        plan: { activity: plan.activity ?? "", when_day: plan.when_day ?? "sat", when_time: plan.when_time ?? "13:00", when_text: plan.when_text ?? "", where_text: plan.where_text ?? "" },
        starter: { firstName: lower(firstName(starter.name)), free_windows: starter.free_windows },
        members: members.map((m) => {
          const u = users.get(m.user_id);
          return { id: m.user_id, firstName: lower(firstName(u?.name ?? m.user_id)), status: m.status, free_windows: u?.free_windows ?? [], interests: u?.interests ?? [] };
        }),
        asker: { id: asker.id, firstName: lower(firstName(asker.name)) },
        counteroffer: input.counteroffer,
        fixedEvent: plan.public_event_id ? true : false,
        privateLimits: (limits ?? []).map((l) => ({ firstName: lower(firstName(users.get(l.user_id as string)?.name ?? "someone")), text: l.limit_text as string })),
        preferCache: settings.muse_replay,
      },
      onText,
      onRestart,
    );
    const o = r.data;
    // a public event does not move for anyone. whatever came back, its time and place stand.
    if (plan.public_event_id) {
      o.when_day = (plan.when_day ?? o.when_day) as typeof o.when_day;
      o.when_time = plan.when_time ?? o.when_time;
      o.when_text = plan.when_text ?? o.when_text;
      o.where_text = plan.where_text ?? o.where_text;
    }
    const timeMoved = o.when_day !== plan.when_day || o.when_time !== plan.when_time;
    const changed = o.changed || timeMoved || lower(o.where_text) !== plan.where_text;

    // answers follow the new shape: the asker is in if it works for them; anyone who
    // had said yes but isn't free at the new time gets asked again, quietly.
    const generic = `${lower(firstName(starter.name))} is thinking ${lower(o.activity)}, ${lower(o.when_text)}. ${lower(o.where_text)}. no pressure either way.`;
    for (const m of members) {
      const u = users.get(m.user_id);
      const patch: Partial<PlanMember> = {};
      if (m.user_id === input.userId) {
        if (o.works_for_asker && m.status !== "out") patch.status = "down";
      } else if (changed) {
        if (m.status === "down" && timeMoved && !isFreeAt(u?.free_windows ?? [], o.when_day, o.when_time)) patch.status = "pending";
        if (m.status !== "down" || patch.status === "pending") patch.personal_ask = generic;
      }
      if (Object.keys(patch).length > 0) {
        await db.from("plan_members").update({ ...patch, updated_at: now() }).eq("plan_id", plan.id).eq("user_id", m.user_id);
      }
    }

    await db
      .from("plans")
      .update({
        activity: lower(o.activity),
        when_day: o.when_day,
        when_time: o.when_time,
        when_text: lower(o.when_text),
        where_text: lower(o.where_text),
        note: lower(o.heads_up),
        version: plan.version + (changed ? 1 : 0),
        solving: false,
        updated_at: now(),
      })
      .eq("id", plan.id);

    const settled = await settle(plan.id);
    return { changed, worksForAsker: o.works_for_asker, note: lower(o.heads_up), source: r.source, latencyMs: r.latencyMs, settled };
  } catch (e) {
    await db.from("plans").update({ solving: false, updated_at: now() }).eq("id", plan.id);
    throw e;
  }
}
