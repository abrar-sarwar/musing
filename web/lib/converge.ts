import { serverDb } from "@/lib/db/server";
import { discover } from "@/lib/discover";
import { affinityFor } from "@/lib/hangouts";
import { converge, type SignalCandidate } from "@/lib/muse/converge";
import type { Matched } from "@/lib/muse/match";
import { understand, UnderstandSchema } from "@/lib/muse/understand";
import { createDraftFromMatch, sendPlan, cancelPlan } from "@/lib/plans";
import { getSettings } from "@/lib/settings";
import { canSeeSignal, isExpired, parseAudience } from "@/lib/signals";
import { firstName } from "@/lib/time";
import type { FreeWindow, User } from "@/lib/types";
import { todayLine } from "@/lib/when";

// convergence engine. when a signal lands, look once at the open signals of the
// owner's friends and ask muse whether they converge. the signals system is the
// source of truth for what may be matched: only signals their author chose to
// share, only while they are live, and a plan made from one carries its
// wait-for count and its expiry. deterministic code owns eligibility (friends
// only, shared, unexpired, unconsumed, overlapping free time), privacy (a
// friend's raw signal is only ever read by the model, never shown to anyone),
// dedupe and state. muse owns the judgment and the invented experience.

export type ConvergeOutcome = {
  status: "matched" | "no_match" | "no_candidates" | "duplicate" | "skipped";
  planId?: string;
  summary: string;
};

const MAX_SIGNALS = 8;
const MAX_UNDERSTAND_ON_DEMAND = 3;

const overlaps = (a: FreeWindow[], b: FreeWindow[]) =>
  a.some((x) => b.some((y) => x.day === y.day && x.start < y.end && y.start < x.end));

type MuseRow = { id: string; user_id: string; raw_text: string; understood: unknown; created_at: string; consumed_plan_id: string | null; audience: string | null; wait_for: number | null; expires_at: string | null };

export async function convergeOnSignal(museId: string): Promise<ConvergeOutcome> {
  const db = serverDb();
  const settings = await getSettings();
  if (!settings.muse_on) return { status: "skipped", summary: "muse is off" };

  const { data: muse } = await db.from("muses").select("*").eq("id", museId).maybeSingle();
  const trigger = muse as MuseRow | null;
  if (!trigger) return { status: "skipped", summary: "signal not found" };
  if (trigger.consumed_plan_id) return { status: "skipped", summary: "signal already folded into a plan" };
  // a thought kept between its author and muse never starts a match, and
  // neither does one that has run out. both are the author's call, recorded
  // on the signal itself.
  if (parseAudience(trigger.audience) === "muse") return { status: "skipped", summary: "signal is private to its author and muse" };
  if (isExpired(trigger.expires_at, new Date())) return { status: "skipped", summary: "signal has expired" };
  const understood = UnderstandSchema.safeParse(trigger.understood);
  if (!understood.success) return { status: "skipped", summary: "signal not understood yet" };

  // a signal that already became a starter plan is spent
  const { data: ownPlan } = await db.from("plans").select("id").eq("muse_id", museId).in("state", ["draft", "proposing", "happening"]).limit(1);
  if (ownPlan && ownPlan.length > 0) return { status: "skipped", summary: "signal already has an active plan" };
  const { data: already } = await db.from("signal_matches").select("id").eq("trigger_muse_id", museId).limit(1);
  if (already && already.length > 0) return { status: "skipped", summary: "convergence already ran for this signal" };

  const { data: ownerRow } = await db.from("users").select("*").eq("id", trigger.user_id).maybeSingle();
  const owner = ownerRow as User | null;
  if (!owner) return { status: "skipped", summary: "owner not found" };

  const { data: edges } = await db.from("friendships").select("user_id,friend_id,close").or(`user_id.eq.${owner.id},friend_id.eq.${owner.id}`);
  const outClose = new Map<string, boolean>();
  const inClose = new Map<string, boolean>();
  for (const e of (edges ?? []) as Array<{ user_id: string; friend_id: string; close: boolean }>) {
    if (e.user_id === owner.id) outClose.set(e.friend_id, Boolean(e.close));
    else if (e.friend_id === owner.id) inClose.set(e.user_id, Boolean(e.close));
  }
  let friendIds = [...outClose.keys()];
  if (friendIds.length === 0) return { status: "no_candidates", summary: "no friends" };
  // a signal shown to close friends alone is picked from those people alone
  if (parseAudience(trigger.audience) === "close") friendIds = friendIds.filter((id) => outClose.get(id));

  // signals already spent as the origin of an active plan are not open any more
  const { data: activePlans } = await db.from("plans").select("muse_id").in("state", ["draft", "proposing", "happening"]);
  const spentMuses = new Set((activePlans ?? []).map((p) => p.muse_id as string));

  const now = new Date();
  const { data: rows } = await db
    .from("muses")
    .select("*")
    .in("user_id", friendIds)
    .neq("audience", "muse")
    .is("consumed_plan_id", null)
    .order("created_at", { ascending: false })
    .limit(24);
  const open = ((rows ?? []) as MuseRow[]).filter((r) => {
    if (spentMuses.has(r.id) || isExpired(r.expires_at, now)) return false;
    // the author decides who a signal is shown to; convergence may only use
    // one this owner actually sees. a close-friends signal counts only when
    // the author counts the owner as close (the flag is one-directional).
    return canSeeSignal(parseAudience(r.audience), inClose.get(r.user_id) ? "close" : "friend");
  });
  if (open.length === 0) return { status: "no_candidates", summary: "no open friend signals" };

  const { data: friendRows } = await db.from("users").select("*").in("id", friendIds);
  const friendById = new Map(((friendRows ?? []) as User[]).map((u) => [u.id, u]));

  // eligibility is deterministic: the friend must share some free time with the owner
  const eligible = open.filter((r) => {
    const f = friendById.get(r.user_id);
    return f ? overlaps(owner.free_windows, f.free_windows) : false;
  });

  // friends' older signals may never have been understood (seeded ones, or ones
  // whose owner never opened the mix). understand a few now, for real, and keep it.
  let understoodBudget = MAX_UNDERSTAND_ON_DEMAND;
  const signals: SignalCandidate[] = [];
  for (const r of eligible) {
    if (signals.length >= MAX_SIGNALS) break;
    const f = friendById.get(r.user_id);
    if (!f) continue;
    let u = UnderstandSchema.safeParse(r.understood);
    if (!u.success && understoodBudget > 0) {
      understoodBudget--;
      try {
        const res = await understand({ text: r.raw_text, starterName: firstName(f.name).toLowerCase(), interests: f.interests, today: todayLine() });
        await db.from("muses").update({ understood: res.data }).eq("id", r.id);
        u = UnderstandSchema.safeParse(res.data);
      } catch {
        u = UnderstandSchema.safeParse(null);
      }
    }
    if (!u.success) continue;
    signals.push({ museId: r.id, userId: f.id, firstName: firstName(f.name).toLowerCase(), interests: f.interests, free_windows: f.free_windows, rawText: r.raw_text, understood: u.data });
  }
  if (signals.length === 0) return { status: "no_candidates", summary: "no eligible friend signals" };

  const found = await discover({
    text: [trigger.raw_text, ...signals.map((s) => s.rawText)].join(" "),
    activity: understood.data.activity,
    budgetHint: understood.data.budget_hint,
    starterFree: owner.free_windows,
    context: null,
    affinity: await affinityFor(owner.id),
  });

  const r = await converge({
    owner: { id: owner.id, firstName: firstName(owner.name).toLowerCase(), interests: owner.interests, free_windows: owner.free_windows },
    trigger: { museId: trigger.id, rawText: trigger.raw_text, understood: understood.data },
    signals,
    today: todayLine(),
    found: { events: found.events, groups: found.groups, listings: found.listings },
  });
  const o = r.data;
  if (!o.match) return { status: "no_match", summary: `no convergence: closest idea was "${o.activity}"` };

  const participantIds = [owner.id, ...o.participants.map((p) => p.user_id)].sort();
  // the dedupe unit is the set of signals that converged, not the wording of
  // the idea: two of those signals landing at the same moment (each firing
  // its own convergence pass) compute the same key, so only one plan is made.
  const dedupeKey = `signals:${[trigger.id, ...o.participants.map((p) => p.muse_id)].sort().join(",")}`;
  // overlap counts too: if any of these signals already folded into an open
  // convergence plan, a second pass over a slightly different subset must
  // not invite the same people twice.
  const myMuses = new Set([trigger.id, ...o.participants.map((p) => p.muse_id)]);
  const { data: prior } = await db.from("signal_matches").select("dedupe_key,plan_id,participant_ids");
  for (const row of (prior ?? []) as Array<{ dedupe_key: string; plan_id: string | null; participant_ids: string[] }>) {
    if (!row.plan_id) continue;
    const { data: pl } = await db.from("plans").select("state").eq("id", row.plan_id).maybeSingle();
    if (!pl) continue;
    if (["draft", "proposing", "happening"].includes(pl.state as string)) {
      const ids = String(row.dedupe_key).replace(/^signals:/, "").split(",");
      if (ids.some((id) => myMuses.has(id))) {
        return { status: "duplicate", planId: row.plan_id, summary: "some of these signals already converged into an open plan" };
      }
    }
    // a group that already passed on a plan together is not proposed the
    // same group again from their leftover signals. a different group (one
    // person more or fewer) is a different offer and stays possible.
    if (pl.state === "faded") {
      const theirs = [...(row.participant_ids ?? [])].sort();
      if (theirs.length === participantIds.length && theirs.every((id, i) => id === participantIds[i])) {
        return { status: "duplicate", planId: row.plan_id, summary: "this group already passed on a plan together" };
      }
    }
  }

  const matched: Matched = {
    activity: o.activity,
    hear_me_out: o.hear_me_out,
    picks: o.participants.map((p) => ({ user_id: p.user_id, reason: p.reason, personal_ask: p.personal_ask })),
    when_day: o.when_day,
    when_text: o.when_text,
    when_time: o.when_time,
    where_text: o.where_text,
    event_id: o.event_id,
    event_reason: o.event_reason,
    group_id: o.group_id,
    group_reason: o.group_reason,
    listings: o.listings,
  };
  // the plan inherits the trigger signal's own terms: how many people its
  // author is waiting for, and when the offer runs out.
  const planId = await createDraftFromMatch(trigger.id, owner.id, matched, { waitFor: trigger.wait_for ?? 2, expiresAt: trigger.expires_at ?? null });

  const { error: matchErr } = await db.from("signal_matches").insert({
    trigger_muse_id: trigger.id,
    owner_id: owner.id,
    participant_ids: participantIds,
    dedupe_key: dedupeKey,
    plan_id: planId,
    summary: `${o.activity} · ${o.when_day} ${o.when_time}`,
  });
  if (matchErr) {
    // someone else recorded this convergence first. fold this plan away.
    await cancelPlan(planId, owner.id).catch(() => undefined);
    return { status: "duplicate", summary: "convergence was recorded concurrently" };
  }

  const usedMuseIds = [trigger.id, ...o.participants.map((p) => p.muse_id)];
  await db.from("muses").update({ consumed_plan_id: planId }).in("id", usedMuseIds);

  // the suggestion goes out as a proposal: everyone, owner included, can still
  // say no, and the owner can call it off like any plan they started.
  await sendPlan(planId, owner.id);

  return { status: "matched", planId, summary: `${o.activity} · ${o.when_day} ${o.when_time} · ${participantIds.join(", ")}` };
}
