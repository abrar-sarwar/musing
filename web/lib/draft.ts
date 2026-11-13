import { serverDb } from "@/lib/db/server";
import { PlanError } from "@/lib/plans";
import { quorumFor } from "@/lib/signals";

// editing a draft before it goes out. a draft belongs to its starter alone, so these only
// ever work for the starter and only while the plan is still a draft. no muse call here:
// muse suggests the first few people, and the starter has the last word on who is asked.

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
const MAX_ASKED = 8;

async function draftOf(planId: string, starterId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(planId)) throw new PlanError("plan not found", 404);
  const { data: plan, error } = await serverDb().from("plans").select("id,muse_id,starter_id,state,activity,when_text").eq("id", planId).maybeSingle();
  if (error) throw new Error(`plan: ${error.message}`);
  if (!plan || plan.starter_id !== starterId) throw new PlanError("plan not found", 404);
  if (plan.state !== "draft") throw new PlanError("this one already went out, so who was asked can't change", 409);
  return plan as { id: string; muse_id: string | null; starter_id: string; state: string; activity: string | null; when_text: string | null };
}

// wait-for can never ask for more people than are being asked
async function refitQuorum(planId: string, museId: string | null): Promise<void> {
  const db = serverDb();
  const [{ count }, { data: muse }] = await Promise.all([
    db.from("plan_members").select("user_id", { count: "exact", head: true }).eq("plan_id", planId),
    museId ? db.from("muses").select("wait_for").eq("id", museId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const waitFor = ((muse as { wait_for?: number } | null)?.wait_for as number | undefined) ?? 2;
  await db.from("plans").update({ quorum: quorumFor(waitFor, count ?? 1), updated_at: new Date().toISOString() }).eq("id", planId);
}

/** the starter adds a friend muse did not pick. only their own friends, never anyone else. */
export async function addPick(planId: string, starterId: string, friendId: string): Promise<void> {
  const db = serverDb();
  const plan = await draftOf(planId, starterId);
  const [{ data: edge }, { data: members }, { data: people }] = await Promise.all([
    db.from("friendships").select("friend_id").eq("user_id", starterId).eq("friend_id", friendId).maybeSingle(),
    db.from("plan_members").select("user_id").eq("plan_id", planId),
    db.from("users").select("id,name").in("id", [starterId, friendId]),
  ]);
  if (!edge) throw new PlanError("you can only add your own friends", 403);
  if ((members ?? []).some((m) => m.user_id === friendId)) return;
  if ((members ?? []).length >= MAX_ASKED) throw new PlanError(`that's the most people one plan asks (${MAX_ASKED})`, 409);
  const starter = firstName(people?.find((p) => p.id === starterId)?.name ?? "a friend").toLowerCase();
  // muse did not write this one, so the ask is plain and says only what the plan says
  const ask = `${starter} is thinking ${plan.activity ?? "something"}${plan.when_text ? `, ${plan.when_text}` : ""}. you in? no pressure.`;
  const { error } = await db.from("plan_members").insert({ plan_id: planId, user_id: friendId, reason: "you added them", personal_ask: ask });
  if (error) throw new Error(`add: ${error.message}`);
  await refitQuorum(planId, plan.muse_id);
}

/** the starter takes someone off the draft. they were never asked, so nobody is told. */
export async function removePick(planId: string, starterId: string, friendId: string): Promise<void> {
  const db = serverDb();
  const plan = await draftOf(planId, starterId);
  const { data: members } = await db.from("plan_members").select("user_id").eq("plan_id", planId);
  if (!(members ?? []).some((m) => m.user_id === friendId)) return;
  if ((members ?? []).length <= 1) throw new PlanError("a plan needs at least one person to ask", 409);
  const { error } = await db.from("plan_members").delete().eq("plan_id", planId).eq("user_id", friendId);
  if (error) throw new Error(`remove: ${error.message}`);
  await refitQuorum(planId, plan.muse_id);
}

/** a draft that muse was asked to redo is replaced by the new one */
export async function dropDraft(planId: string, starterId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(planId)) return;
  await serverDb().from("plans").delete().eq("id", planId).eq("starter_id", starterId).eq("state", "draft");
}

/** the signal a draft was made from, for "ask muse to change it" */
export async function museOfDraft(planId: string, starterId: string): Promise<string | null> {
  return (await draftOf(planId, starterId)).muse_id;
}
