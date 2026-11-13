// Regression suite for the convergence + quorum hardening. Two parts:
//
//   R1 (offline, no server or model): the convergence participant gate
//      (validateParticipants) repairs only the one observed identity slip and
//      fails closed on everything else. After a pass, every participant is in
//      the authorized candidate set, paired with their own signal.
//
//   R2 (integration: needs the dev server on :3000 and MODEL_API_KEY set):
//      makeItReal under concurrent callers produces exactly one claim winner,
//      one group thread, one private event, one plan card and one create
//      execution; repeat calls are no-ops; a dead caller's claim does not
//      strand the plan (a fresh claim blocks, a stale one is retaken).
//
// Run: pnpm test:regression   (MODEL_API_KEY must be in the environment)
import { validateParticipants, type Converged, type SignalCandidate } from "../lib/muse/converge";
import { makeItReal } from "../lib/plans";
import { serverDb } from "../lib/db/server";

const API = process.env.MUSING_API ?? "http://localhost:3000";
let failures = 0;
function check(part: string, name: string, pass: boolean, detail = "") {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"} [${part}] ${name}${detail ? ` :: ${detail}` : ""}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --------------------------------------------------------------------- R1
function r1() {
  const P = "R1 participant gate";
  const sig = (userId: string, museId: string): SignalCandidate =>
    ({ userId, museId, firstName: userId, interests: [], free_windows: [], rawText: "x", understood: {} }) as unknown as SignalCandidate;
  const signals = [sig("alex", "m-alex"), sig("jo", "m-jo")];
  const out = (participants: Array<{ user_id: string; muse_id: string }>): Converged =>
    ({ match: true, participants: participants.map((p) => ({ ...p, reason: "r", personal_ask: "a" })) }) as unknown as Converged;

  let o = out([{ user_id: "alex", muse_id: "m-alex" }, { user_id: "jo", muse_id: "m-jo" }]);
  check(P, "valid participants pass unchanged", validateParticipants(o, signals) === null && o.participants[0].user_id === "alex", JSON.stringify(o.participants.map((p) => p.user_id)));

  o = out([{ user_id: "m-alex", muse_id: "m-alex" }]);
  check(P, "muse_id in the user_id slot is repaired to its owner", validateParticipants(o, signals) === null && o.participants[0].user_id === "alex", `user_id=${o.participants[0].user_id}`);

  o = out([{ user_id: "m-alex", muse_id: "m-jo" }]);
  check(P, "muse_id in user slot with a different muse_id fails closed", validateParticipants(o, signals) !== null, validateParticipants(o, signals) ?? "passed?!");

  o = out([{ user_id: "sam", muse_id: "m-alex" }]);
  check(P, "cross-user id (real user, not a candidate) fails closed", validateParticipants(o, signals) !== null, validateParticipants(o, signals) ?? "passed?!");

  o = out([{ user_id: "nobody", muse_id: "m-nope" }]);
  check(P, "fully fabricated ids fail closed", validateParticipants(o, signals) !== null, validateParticipants(o, signals) ?? "passed?!");

  o = out([{ user_id: "bogus", muse_id: "m-jo" }]);
  check(P, "fabricated user id with someone else's muse_id fails closed", validateParticipants(o, signals) !== null, validateParticipants(o, signals) ?? "passed?!");

  o = out([{ user_id: "alex", muse_id: "m-jo" }]);
  check(P, "candidate paired with another candidate's signal fails closed", validateParticipants(o, signals) !== null, validateParticipants(o, signals) ?? "passed?!");

  o = out([{ user_id: "alex", muse_id: "m-alex" }, { user_id: "alex", muse_id: "m-alex" }]);
  check(P, "duplicate participant fails closed", validateParticipants(o, signals) !== null, validateParticipants(o, signals) ?? "passed?!");

  o = out([{ user_id: "alex", muse_id: "m-alex" }, { user_id: "jo", muse_id: "m-jo" }, { user_id: "alex", muse_id: "m-alex" }, { user_id: "jo", muse_id: "m-jo" }]);
  check(P, "more than 3 participants fails closed", validateParticipants(o, signals) !== null, validateParticipants(o, signals) ?? "passed?!");
}

// --------------------------------------------------------------------- R2
async function api(method: string, path: string, user: string, body?: object): Promise<{ status: number; json: any }> {
  const res = await fetch(API + path, { method, headers: { "x-musing-user": user, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(180_000) });
  return { status: res.status, json: await res.json().catch(() => null) };
}
async function sse(path: string, user: string, body: object): Promise<any> {
  const res = await fetch(API + path, { method: "POST", headers: { "x-musing-user": user, "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(180_000) });
  const text = await res.text();
  for (const block of text.split("\n\n")) {
    if (/^event: done$/m.test(block)) {
      const raw = /^data: (.*)$/m.exec(block)?.[1];
      if (raw) return JSON.parse(raw);
    }
  }
  throw new Error(`no done event from ${path}: ${text.slice(0, 200)}`);
}

// build a plan that is "happening" but has no thread yet: the plan's muse_on
// is off while the final yes lands, so the route's own makeItReal stands down
// and this suite controls every invocation itself.
async function eligiblePlan(): Promise<string> {
  const db = serverDb();
  const u = await sse("/api/muse/understand", "ravi", { text: "board game night at mine saturday, who's in" });
  const m = await sse("/api/muse/match", "ravi", { museId: u.museId });
  const planId = m.planId as string;
  await api("POST", `/api/plans/${planId}/send`, "ravi", {});
  await db.from("plans").update({ muse_on: false }).eq("id", planId);
  const { data: members } = await db.from("plan_members").select("user_id").eq("plan_id", planId);
  for (const mem of members ?? []) await api("POST", `/api/plans/${planId}/respond`, mem.user_id as string, { status: "down" });
  const { data: plan } = await db.from("plans").select("state,thread_id").eq("id", planId).single();
  if (plan?.state !== "happening" || plan?.thread_id) throw new Error(`setup: plan not eligible (state=${plan?.state}, thread=${plan?.thread_id})`);
  await db.from("plans").update({ muse_on: true }).eq("id", planId);
  return planId;
}

async function counts(planId: string) {
  const db = serverDb();
  const [{ data: threads }, { data: events }, { data: traces }, { data: plan }] = await Promise.all([
    db.from("threads").select("id").eq("plan_id", planId),
    db.from("events").select("id").eq("plan_id", planId),
    db.from("muse_trace").select("id,ok").eq("plan_id", planId).eq("job", "create"),
    db.from("plans").select("thread_id,event_id,making_at").eq("id", planId).single(),
  ]);
  let cards = 0;
  if (plan?.thread_id) {
    const { data: msgs } = await db.from("messages").select("id").eq("thread_id", plan.thread_id).not("card", "is", null);
    cards = msgs?.length ?? 0;
  }
  return { threads: threads?.length ?? 0, events: events?.length ?? 0, createTraces: traces?.length ?? 0, cards, plan };
}

async function r2() {
  const P = "R2 makeItReal concurrency";
  await fetch(API + "/api/reset", { method: "POST", headers: { "x-musing-admin": "eval" } });
  for (const [key, value] of [["muse_on", true], ["muse_replay", false], ["posters_on", false]] as const) {
    await api("POST", "/api/settings", "maya", { key, value });
  }

  const planId = await eligiblePlan();
  const results = await Promise.allSettled([makeItReal(planId), makeItReal(planId), makeItReal(planId), makeItReal(planId), makeItReal(planId)]);
  check(P, "no concurrent caller threw", results.every((r) => r.status === "fulfilled"), results.map((r) => r.status).join(","));
  const c = await counts(planId);
  check(P, "exactly one group thread", c.threads === 1, `threads=${c.threads}`);
  check(P, "exactly one private event", c.events === 1, `events=${c.events}`);
  check(P, "exactly one plan card in the chat", c.cards === 1, `cards=${c.cards}`);
  check(P, "one create execution (at most one validation retry)", c.createTraces >= 1 && c.createTraces <= 2, `create traces=${c.createTraces}`);
  check(P, "plan points at the thread and event, claim cleared", !!c.plan?.thread_id && !!c.plan?.event_id && c.plan?.making_at === null, `thread=${c.plan?.thread_id} event=${c.plan?.event_id}`);

  await makeItReal(planId);
  await makeItReal(planId);
  const c2 = await counts(planId);
  check(P, "repeat calls are no-ops", c2.threads === 1 && c2.events === 1 && c2.cards === 1 && c2.createTraces === c.createTraces, `threads=${c2.threads} events=${c2.events} traces=${c2.createTraces}`);

  // a dead caller's claim: fresh claims block, stale claims are retaken.
  const P2 = "R2 claim recovery";
  const plan2 = await eligiblePlan();
  const db = serverDb();
  await db.from("plans").update({ making_at: new Date().toISOString() }).eq("id", plan2);
  await makeItReal(plan2);
  const blocked = await counts(plan2);
  check(P2, "a fresh claim from a dead caller blocks a duplicate run", blocked.threads === 0, `threads=${blocked.threads}`);
  await db.from("plans").update({ making_at: new Date(Date.now() - 120_000).toISOString() }).eq("id", plan2);
  await makeItReal(plan2);
  const recovered = await counts(plan2);
  check(P2, "once the claim is stale, the plan is completed", recovered.threads === 1 && recovered.events === 1, `threads=${recovered.threads} events=${recovered.events}`);
}

async function main() {
  r1();
  if (!process.env.MODEL_API_KEY) {
    console.log("SKIP [R2] MODEL_API_KEY not set; integration part not run");
  } else {
    await r2();
  }
  console.log(failures === 0 ? "\nALL REGRESSION CHECKS PASSED" : `\n${failures} REGRESSION CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
