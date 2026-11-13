import { serverDb } from "@/lib/db/server";
import { catalog, planOpportunities, topicsFor, type Listing, type PublicEvent } from "@/lib/discover";
import { answerRoute, routeAsk } from "@/lib/chatRouter";
import { chat } from "@/lib/muse/chat";
import { trace } from "@/lib/muse/run";
import { loadBundle, PlanError } from "@/lib/plans";
import { firstName } from "@/lib/time";
import type { FreeWindow, Person, User } from "@/lib/types";
import { DAYS, isDay, isFreeAt, isTime, nextOccurrence, todayLine } from "@/lib/when";

// group messaging. every read and write goes through here and checks that the person
// is a member of the thread. someone who is not gets "not found", never "forbidden".

type ThreadRow = { id: string; title: string; member_ids: string[]; plan_id: string | null; muse_muted: boolean };
type MessageRow = { id: string; thread_id: string; sender_id: string | null; kind: string; body: string | null; card: Record<string, unknown> | null; client_id: string | null; reply_to: string | null; pending: boolean; created_at: string };

export type MessageView = { id: string; senderId: string | null; kind: string; body: string | null; card: Record<string, unknown> | null; clientId: string | null; pending: boolean; createdAt: string };
export type ProposalView = { id: string; summary: string; status: string; yes: number; needed: number; myVote: "yes" | "no" | null; canVote: boolean };

const MUSE_MENTION = /(^|[^a-z0-9])@muse\b/i;
const lower = (s: string) => s.toLowerCase();
const now = () => new Date().toISOString();
const view = (m: MessageRow): MessageView => ({ id: m.id, senderId: m.sender_id, kind: m.kind, body: m.body, card: m.card, clientId: m.client_id, pending: m.pending, createdAt: m.created_at });

async function requireThread(threadId: string, userId: string): Promise<ThreadRow> {
  if (!/^[0-9a-f-]{36}$/i.test(threadId)) throw new PlanError("chat not found", 404);
  const { data, error } = await serverDb().from("threads").select("*").eq("id", threadId).maybeSingle();
  if (error) throw new Error(`thread: ${error.message}`);
  const thread = data as ThreadRow | null;
  if (!thread || !thread.member_ids.includes(userId)) throw new PlanError("chat not found", 404);
  return thread;
}

// tells every open client "something changed here". carries no content.
export async function ping(threadId: string): Promise<void> {
  await serverDb().from("thread_pings").upsert({ thread_id: threadId, at: now() });
}

export async function listThreads(userId: string) {
  const db = serverDb();
  const { data: threads, error } = await db.from("threads").select("*").contains("member_ids", [userId]);
  if (error) throw new Error(`threads: ${error.message}`);
  const list = (threads ?? []) as ThreadRow[];
  if (list.length === 0) return [];
  const { data: msgs, error: e2 } = await db.from("messages").select("*").in("thread_id", list.map((t) => t.id)).eq("pending", false).order("created_at", { ascending: false });
  if (e2) throw new Error(`messages: ${e2.message}`);
  const all = (msgs ?? []) as MessageRow[];
  return list
    .map((t) => {
      const last = all.find((m) => m.thread_id === t.id) ?? null;
      return { id: t.id, title: t.title, memberIds: t.member_ids, hasMuse: t.plan_id !== null, last: last ? view(last) : null };
    })
    .sort((a, b) => (b.last?.createdAt ?? "").localeCompare(a.last?.createdAt ?? ""));
}

export async function getThread(threadId: string, userId: string) {
  const db = serverDb();
  const thread = await requireThread(threadId, userId);
  const [{ data: msgs, error }, { data: users }] = await Promise.all([
    db.from("messages").select("*").eq("thread_id", threadId).order("created_at", { ascending: true }).order("id", { ascending: true }).limit(300),
    db.from("users").select("id,name,avatar_seed").in("id", thread.member_ids),
  ]);
  if (error) throw new Error(`messages: ${error.message}`);
  return {
    thread: {
      id: thread.id,
      title: thread.title,
      planId: thread.plan_id,
      members: (users ?? []) as Person[],
      // muse is part of plan chats only, as a capability, not an account
      hasMuse: thread.plan_id !== null,
      museMuted: thread.muse_muted,
    },
    messages: ((msgs ?? []) as MessageRow[]).map(view),
    proposals: thread.plan_id ? await proposalViews(thread.plan_id, userId) : [],
  };
}

/** post a message. the same clientId from the same sender is stored once, so a retry is safe. */
export async function postMessage(threadId: string, userId: string, body: string, clientId: string | null) {
  const db = serverDb();
  const thread = await requireThread(threadId, userId);
  const { data, error } = await db.from("messages").insert({ thread_id: threadId, sender_id: userId, kind: "text", body, client_id: clientId }).select("*").single();
  let row = data as MessageRow | null;
  if (error) {
    if (error.code !== "23505" || !clientId) throw new Error(`send: ${error.message}`);
    const { data: existing } = await db.from("messages").select("*").eq("thread_id", threadId).eq("sender_id", userId).eq("client_id", clientId).single();
    row = existing as MessageRow | null;
  }
  if (!row) throw new Error("send failed");
  await ping(threadId);
  return { message: view(row), wantsMuse: thread.plan_id !== null && !thread.muse_muted && MUSE_MENTION.test(body) };
}

export async function setMuseMuted(threadId: string, userId: string, muted: boolean) {
  const thread = await requireThread(threadId, userId);
  if (!thread.plan_id) throw new PlanError("muse isn't part of this chat", 409);
  await serverDb().from("threads").update({ muse_muted: muted }).eq("id", threadId);
  await ping(threadId);
  return { museMuted: muted };
}

// ---------- muse in the chat ----------

const going = (b: NonNullable<Awaited<ReturnType<typeof loadBundle>>>): User[] =>
  [b.plan.starter_id, ...b.members.filter((m) => m.status === "down").map((m) => m.user_id)].map((id) => b.users.get(id)).filter((u): u is User => Boolean(u));

/** when everyone going is free, day by day. no names, so it can sit in a group-visible prompt. */
function sharedFree(people: User[]): FreeWindow[] {
  const out: FreeWindow[] = [];
  for (const day of DAYS) {
    const windows = people.map((p) => p.free_windows.find((w) => w.day === day));
    if (windows.some((w) => !w)) continue;
    const start = windows.map((w) => w!.start).sort().at(-1)!;
    const end = windows.map((w) => w!.end).sort()[0]!;
    if (start < end) out.push({ day, start, end });
  }
  return out;
}

async function insertMuse(threadId: string, fields: Partial<MessageRow>): Promise<MessageRow> {
  const { data, error } = await serverDb().from("messages").insert({ thread_id: threadId, sender_id: null, kind: "muse", ...fields }).select("*").single();
  if (error || !data) throw Object.assign(new Error(error?.message ?? "insert failed"), { code: error?.code });
  return data as MessageRow;
}

export type MuseAsk = {
  messageId?: string | null;
  action?: "recap" | "finds" | "food" | null;
  /** dev servers only: stand in for a model that is slower than the limit. no model call is made. */
  test?: { delayMs: number; timeoutMs: number } | null;
};

/**
 * muse answers in a plan chat. called when someone mentions @muse or taps a muse action.
 * human messages never wait on this: it runs after the message is already stored.
 */
export async function museReply(threadId: string, userId: string, ask: MuseAsk, onText: (delta: string) => void, onRestart: () => void): Promise<MessageView> {
  const db = serverDb();
  const thread = await requireThread(threadId, userId);
  if (!thread.plan_id) throw new PlanError("muse isn't part of this chat", 409);
  if (thread.muse_muted) throw new PlanError("muse is muted in this chat", 409);
  const b = await loadBundle(thread.plan_id);
  if (!b || b.plan.state !== "happening") throw new PlanError("this plan isn't on anymore", 409);
  const uses = await planOpportunities(b.plan.id);

  // the two instant actions read the plan straight from the database. no model call.
  const names = going(b).map((u) => lower(firstName(u.name)));
  const plain = uses.map((u) => ({ kind: u.kind, id: u.id, title: u.title, sub: u.sub }));
  const routed = async (route: Parameters<typeof answerRoute>[0], replyTo: string | null, t0: number) => {
    const a = answerRoute(route, b.plan, names, plain);
    const card = a.planCard ? planCard(b.plan, uses) : a.items ? { type: "finds", items: a.items } : null;
    let row: MessageRow;
    try {
      row = await insertMuse(threadId, { body: a.body, card, reply_to: replyTo });
    } catch (e) {
      if ((e as { code?: string }).code === "23505") throw new PlanError("muse already answered that", 409);
      throw e;
    }
    await ping(threadId);
    await trace({ job: "chat", model: "router", latencyMs: Date.now() - t0, ok: true, summary: `routed "${route}" · answered from the plan, no model call`, planId: b.plan.id });
    return view(row);
  };

  // the two instant actions read the plan straight from the database. no model call.
  if (ask.action === "recap" || ask.action === "finds") return routed(ask.action, null, Date.now());

  // the text muse is answering: the member's own message, or the food action
  let askText = "find food nearby for after";
  let trigger: MessageRow | null = null;
  if (ask.action !== "food") {
    const { data } = await db.from("messages").select("*").eq("id", ask.messageId ?? "").eq("thread_id", threadId).maybeSingle();
    trigger = data as MessageRow | null;
    if (!trigger || trigger.sender_id !== userId || !trigger.body) throw new PlanError("nothing to answer", 404);
    askText = trigger.body.replace(/@muse\b[,:]?/gi, "").trim() || "what's the plan?";
    // intent router: what the plan already knows is answered without the model
    const route = ask.test ? null : routeAsk(askText);
    if (route) return routed(route, trigger.id, Date.now());
  }

  // clear out a reply that died mid-way, then check nobody else has muse busy
  await db.from("messages").delete().eq("thread_id", threadId).eq("pending", true).lt("created_at", new Date(Date.now() - 90_000).toISOString());
  const { data: recentMuse } = await db.from("messages").select("id,pending").eq("thread_id", threadId).eq("kind", "muse").gte("created_at", new Date(Date.now() - 60_000).toISOString());
  if ((recentMuse ?? []).some((m) => m.pending)) throw new PlanError("muse is answering someone. give it a sec.", 429);
  if ((recentMuse ?? []).length >= 6) throw new PlanError("muse needs a minute. the chat still works.", 429);

  // claim the reply. the unique index on reply_to means one answer per message, even
  // if two clients ask at once. everyone sees the row as "muse is typing".
  let placeholder: MessageRow;
  try {
    placeholder = await insertMuse(threadId, { pending: true, body: "", reply_to: trigger?.id ?? null });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new PlanError("muse already answered that", 409);
    throw e;
  }
  await ping(threadId);

  try {
    const c = await catalog();
    const people = going(b);
    const free = sharedFree(people);
    const fixed = b.plan.public_event_id ? (c.events.find((e) => e.id === b.plan.public_event_id) ?? null) : null;
    // search the catalog for this request. only what fits goes to the model.
    const topics = [...new Set([...(fixed?.tags ?? []), ...topicsFor(b.plan.activity, askText)])];
    const score = (tags: string[]) => topics.filter((t) => tags.includes(t)).length;
    const usedIds = new Set(uses.map((u) => `${u.kind}:${u.id}`));
    const events: PublicEvent[] = c.events.filter((e) => score(e.tags) > 0 || usedIds.has(`event:${e.id}`)).sort((x, y) => score(y.tags) - score(x.tags)).slice(0, 5);
    const groups = c.groups.filter((g) => score(g.tags) > 0 || usedIds.has(`group:${g.id}`)).slice(0, 3);
    const listings: Listing[] = c.listings.filter((l) => score(l.tags) > 0 || usedIds.has(`listing:${l.id}`)).sort((x, y) => Number(usedIds.has(`listing:${y.id}`)) - Number(usedIds.has(`listing:${x.id}`))).slice(0, 6);

    const [{ data: history }, { data: open }, { data: limits }] = await Promise.all([
      db.from("messages").select("sender_id,body").eq("thread_id", threadId).eq("pending", false).not("body", "is", null).order("created_at", { ascending: false }).limit(12),
      db.from("plan_proposals").select("summary").eq("plan_id", b.plan.id).eq("status", "open").maybeSingle(),
      db.from("plan_private_limits").select("limit_text").eq("plan_id", b.plan.id),
    ]);
    const nameOf = (id: string | null) => (id ? lower(firstName(b.users.get(id)?.name ?? "someone")) : "muse");

    // a slow model never holds the chat. past this, muse bows out and the placeholder is removed.
    const giveUp = new Promise<never>((_, reject) => setTimeout(() => reject(new PlanError("muse took too long. the chat still works, ask again in a bit.", 504)), ask.test?.timeoutMs ?? 62_000));
    if (ask.test) await Promise.race([giveUp, new Promise((resolve) => setTimeout(resolve, ask.test!.delayMs))]);
    const r = await Promise.race([giveUp, chat(
      {
        planId: b.plan.id,
        today: todayLine(),
        plan: { activity: b.plan.activity ?? "the plan", when_day: b.plan.when_day ?? "sat", when_time: b.plan.when_time ?? "13:00", when_text: b.plan.when_text ?? "soon", where_text: b.plan.where_text ?? "" },
        fixedEvent: fixed,
        goingFirstNames: people.map((u) => lower(firstName(u.name))),
        sharedFree: free.map((w) => `${w.day} ${w.start}-${w.end}`).join(", "),
        uses,
        found: { events, groups, listings },
        openProposal: (open?.summary as string | undefined) ?? null,
        recent: (history ?? []).reverse().map((m) => ({ who: nameOf(m.sender_id as string | null), text: String(m.body).slice(0, 240) })),
        asker: nameOf(userId),
        ask: askText.slice(0, 280),
        worksForAll: (day, time) => isDay(day) && isTime(time) && isFreeAt(free, day, time),
        // used only to reject a leak. these never reach the model.
        privateLimits: (limits ?? []).map((l) => l.limit_text as string),
      },
      onText,
      onRestart,
    )]);
    const o = r.data;

    // cards come from the catalog rows the server looked up, never from model text
    const items = o.cards
      .map((card) => {
        if (card.kind === "event") {
          const e = events.find((x) => x.id === card.id);
          return e ? { kind: "event", id: e.id, title: e.title, sub: `${e.when_text} · ${e.area}` } : null;
        }
        if (card.kind === "group") {
          const g = groups.find((x) => x.id === card.id);
          return g ? { kind: "group", id: g.id, title: g.name, sub: `${g.member_count.toLocaleString("en-US")} members · ${g.area}` } : null;
        }
        const l = listings.find((x) => x.id === card.id);
        return l ? { kind: "listing", id: l.id, title: l.title, sub: `$${l.price.toLocaleString("en-US")} · ${l.place}` } : null;
      })
      .filter(Boolean);

    let card: Record<string, unknown> | null = items.length > 0 ? { type: "finds", items } : null;
    if (o.propose !== "none") {
      const ev = o.propose === "switch_event" ? events.find((e) => e.id === o.propose_event_id) : null;
      const change = ev
        ? { when_day: ev.when_day, when_time: ev.when_time, when_text: ev.when_text, where_text: lower(ev.area), public_event_id: ev.id }
        : { when_day: o.propose_day, when_time: o.propose_time, when_text: lower(o.propose_when_text), where_text: lower(o.propose_where_text), public_event_id: null };
      // one open proposal per plan: the unique index turns a second one into a no-op
      const { data: made } = await db
        .from("plan_proposals")
        .insert({ plan_id: b.plan.id, thread_id: threadId, proposer_id: userId, summary: lower(o.propose_summary), change, plan_version: b.plan.version })
        .select("id")
        .maybeSingle();
      if (made) {
        // asking for it counts as agreeing to it
        await db.from("proposal_votes").insert({ proposal_id: made.id, user_id: userId, vote: "yes" });
        card = { type: "proposal", proposal_id: made.id, summary: lower(o.propose_summary), items };
      }
    }

    const { data: done } = await db.from("messages").update({ body: lower(o.reply), card, pending: false }).eq("id", placeholder.id).select("*").single();
    await ping(threadId);
    return view((done as MessageRow | null) ?? { ...placeholder, body: lower(o.reply), card, pending: false });
  } catch (e) {
    // muse failed. the placeholder goes away and the chat carries on without it.
    await db.from("messages").delete().eq("id", placeholder.id);
    await ping(threadId);
    throw e;
  }
}

function planCard(plan: { id: string; event_id: string | null; activity: string | null; when_text: string | null; where_text: string | null }, uses: Array<{ kind: string; id: string; title: string; sub: string }>) {
  return { type: "plan", plan_id: plan.id, event_id: plan.event_id, title: plan.activity, when: plan.when_text, where: plan.where_text, line: null, found: uses.map((u) => ({ kind: u.kind, id: u.id, title: u.title, sub: u.sub })) };
}

// ---------- group change proposals ----------
// the rule: a confirmed plan changes only when every person who is going agrees.
// one "no" ends the proposal. the person who asked for it counts as a yes.

async function proposalViews(planId: string, viewerId: string): Promise<ProposalView[]> {
  const db = serverDb();
  const { data: rows } = await db.from("plan_proposals").select("id,summary,status").eq("plan_id", planId).order("created_at", { ascending: false }).limit(10);
  if (!rows || rows.length === 0) return [];
  const [{ data: votes }, b] = await Promise.all([db.from("proposal_votes").select("proposal_id,user_id,vote").in("proposal_id", rows.map((r) => r.id as string)), loadBundle(planId)]);
  const voters = b ? going(b).map((u) => u.id) : [];
  return rows.map((r) => {
    const mine = (votes ?? []).filter((v) => v.proposal_id === r.id);
    const my = mine.find((v) => v.user_id === viewerId)?.vote as "yes" | "no" | undefined;
    return { id: r.id as string, summary: r.summary as string, status: r.status as string, yes: mine.filter((v) => v.vote === "yes" && voters.includes(v.user_id as string)).length, needed: voters.length, myVote: my ?? null, canVote: r.status === "open" && voters.includes(viewerId) };
  });
}

export async function voteOnProposal(proposalId: string, userId: string, vote: "yes" | "no") {
  const db = serverDb();
  const { data: p } = await db.from("plan_proposals").select("*").eq("id", proposalId).maybeSingle();
  if (!p) throw new PlanError("proposal not found", 404);
  await requireThread(p.thread_id as string, userId);
  const b = await loadBundle(p.plan_id as string);
  if (!b) throw new PlanError("plan not found", 404);
  const voters = going(b).map((u) => u.id);
  if (!voters.includes(userId)) throw new PlanError("only people who are going can vote", 403);
  if (p.status !== "open") throw new PlanError("this one is already settled", 409);

  const { error } = await db.from("proposal_votes").upsert({ proposal_id: proposalId, user_id: userId, vote });
  if (error) throw new Error(`vote: ${error.message}`);
  const { data: votes } = await db.from("proposal_votes").select("user_id,vote").eq("proposal_id", proposalId);
  const said = new Map((votes ?? []).map((v) => [v.user_id as string, v.vote as string]));
  const threadId = p.thread_id as string;

  if (voters.some((id) => said.get(id) === "no")) {
    // conditional update: whoever settles it first posts the one message
    const { data: won } = await db.from("plan_proposals").update({ status: "declined", resolved_at: now() }).eq("id", proposalId).eq("status", "open").select("id");
    if (won && won.length > 0) await insertMuse(threadId, { body: "okay, keeping the plan as it is." });
  } else if (voters.every((id) => said.get(id) === "yes")) {
    const { data: won } = await db.from("plan_proposals").update({ status: "accepted", resolved_at: now() }).eq("id", proposalId).eq("status", "open").select("id");
    if (won && won.length > 0) await applyProposal(p as { id: string; plan_id: string; thread_id: string; change: Record<string, unknown>; summary: string; plan_version: number });
  }
  await ping(threadId);
  return { ok: true };
}

// everyone agreed. move the shared plan and its private event, once.
async function applyProposal(p: { id: string; plan_id: string; thread_id: string; change: Record<string, unknown>; summary: string; plan_version: number }) {
  const db = serverDb();
  const ch = p.change as { when_day: string; when_time: string; when_text: string; where_text: string; public_event_id: string | null };
  // only if the plan is still the version the group voted on
  const { data: moved } = await db
    .from("plans")
    .update({ when_day: ch.when_day, when_time: ch.when_time, when_text: ch.when_text, where_text: ch.where_text, public_event_id: ch.public_event_id, note: p.summary, version: p.plan_version + 1, updated_at: now() })
    .eq("id", p.plan_id)
    .eq("version", p.plan_version)
    .eq("state", "happening")
    .select("*");
  if (!moved || moved.length === 0) {
    await db.from("plan_proposals").update({ status: "expired" }).eq("id", p.id);
    await insertMuse(p.thread_id, { body: "the plan changed while that vote was open, so i left it alone." });
    return;
  }
  const plan = moved[0] as { id: string; event_id: string | null; activity: string | null; when_text: string | null; where_text: string | null };
  await db.from("plan_opportunities").delete().eq("plan_id", p.plan_id).eq("kind", "event");
  if (ch.public_event_id) await db.from("plan_opportunities").insert({ plan_id: p.plan_id, kind: "event", ref_id: ch.public_event_id, reason: "the group switched to this" });
  if (plan.event_id && isDay(ch.when_day) && isTime(ch.when_time)) {
    const startsAt = nextOccurrence(ch.when_day, ch.when_time);
    // a title like "Saturday Thrift Run" follows the plan to its new day
    const { data: ev } = await db.from("events").select("title").eq("id", plan.event_id).maybeSingle();
    const newDay = startsAt.toLocaleDateString("en-US", { weekday: "long" });
    const title = String(ev?.title ?? "").replace(/\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/g, newDay);
    await db.from("events").update({ starts_at: startsAt.toISOString(), location: ch.where_text, ...(title ? { title } : {}) }).eq("id", plan.event_id);
  }
  const uses = await planOpportunities(p.plan_id);
  await insertMuse(p.thread_id, { body: `everyone's in. it's now ${ch.when_text}, ${ch.where_text}.`, card: planCard(plan, uses) });
}
