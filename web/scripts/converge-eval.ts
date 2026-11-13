// convergence evaluation harness. drives the real api as seeded users, with live
// muse calls, and scores the proactive matching loop: separate friends post
// separate signals, nobody asks for a group, and the test watches whether muse
// notices, invents a shared experience, and respects consent and privacy.
//
// run: pnpm eval:converge   (dev server + supabase up, MODEL_API_KEY set,
//                            replay off. see scripts/muse-eval.ts for the base harness)
// cost: roughly 30 to 40 text calls per run. writes converge-eval.json.
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { FRIEND_EDGES, USERS } from "../lib/seed/data";

const API = process.env.EVAL_API ?? "http://localhost:3000";
const OUT = process.env.EVAL_OUT ?? "converge-eval.json";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const byId = new Map(USERS.map((u) => [u.id, u]));
const friendsOf = (id: string) => new Set(FRIEND_EDGES.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : [])));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Sse = { events: Array<{ event: string; data: any }>; error: string | null };
async function sse(path: string, user: string, body: object): Promise<Sse> {
  const out: Sse = { events: [], error: null };
  try {
    const res = await fetch(API + path, { method: "POST", headers: { "x-musing-user": user, "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(180_000) });
    if (!res.ok || !res.body) { out.error = `http ${res.status}: ${(await res.text()).slice(0, 160)}`; return out; }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const event = /^event: (.*)$/m.exec(block)?.[1] ?? "message";
        const raw = /^data: (.*)$/m.exec(block)?.[1] ?? "null";
        let data: any = raw;
        try { data = JSON.parse(raw); } catch { /* text */ }
        if (event === "error") out.error = String(data?.message ?? data);
        out.events.push({ event, data });
      }
    }
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
  }
  return out;
}

async function api(method: string, path: string, user: string, body?: object): Promise<{ status: number; json: any }> {
  const res = await fetch(API + path, { method, headers: { "x-musing-user": user, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(180_000) });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function reset() {
  const r = await fetch(API + "/api/reset", { method: "POST", headers: { "x-musing-admin": "eval" } });
  if (!r.ok) throw new Error(`reset failed: ${r.status}`);
  await api("POST", "/api/settings", "maya", undefined).catch(() => undefined);
  for (const [key, value] of [["muse_on", true], ["muse_replay", false], ["posters_on", false]] as const) {
    await fetch(API + "/api/settings", { method: "POST", headers: { "x-musing-admin": "eval", "content-type": "application/json" }, body: JSON.stringify({ key, value }) });
  }
}

/** post a signal exactly like the composer does. returns the muse id. */
async function postSignal(user: string, text: string): Promise<string> {
  const r = await sse("/api/muse/understand", user, { text });
  if (r.error) throw new Error(`understand as ${user} failed: ${r.error}`);
  const done = r.events.find((e) => e.event === "done")?.data;
  const museId = done?.museId ?? done?.muse_id;
  if (!museId) throw new Error(`no muse id in understand done event for ${user}: ${JSON.stringify(done).slice(0, 200)}`);
  return museId as string;
}

async function homePlans(user: string): Promise<any[]> {
  // the home payload splits plans into "mine" (started by the user) and "asks"
  // (the user is a member). a convergence plan is started by the trigger signal's
  // owner, so for the owner it lands in "mine"; members see it under "asks".
  const { json } = await api("GET", "/api/musing/home", user);
  const all = [...((json?.mine ?? []) as any[]), ...((json?.asks ?? []) as any[])];
  return [...new Map(all.map((p) => [p.id, p])).values()];
}

const memberIds = (plan: any) => ((plan?.picks ?? []) as any[]).map((p) => (p.user?.id ?? p.userId) as string);

/** convergence runs after the signal response. poll until a plan shows up. */
async function waitForNewPlan(user: string, knownIds: Set<string>, timeoutMs = 180_000): Promise<any | null> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const plans = await homePlans(user);
    const fresh = plans.find((p) => !knownIds.has(p.id));
    if (fresh) return fresh;
    await sleep(4_000);
  }
  return null;
}

/** wait until at least `n` converge rows exist in the trace since `since`. */
async function waitForConvergeTrace(sinceIso: string, n = 1, timeoutMs = 180_000): Promise<any[]> {
  const t0 = Date.now();
  for (;;) {
    const { data } = await db.from("muse_trace").select("*").eq("job", "converge").gte("created_at", sinceIso).order("created_at", { ascending: true });
    if ((data ?? []).length >= n) return data as any[];
    if (Date.now() - t0 > timeoutMs) return (data ?? []) as any[];
    await sleep(4_000);
  }
}

type Check = { scenario: string; name: string; pass: boolean; detail: string };
const checks: Check[] = [];
const check = (scenario: string, name: string, pass: boolean, detail: string) => {
  checks.push({ scenario, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} [${scenario}] ${name} :: ${detail}`);
};
const nowIso = () => new Date().toISOString();

async function traceSince(sinceIso: string) {
  const { data } = await db.from("muse_trace").select("*").gte("created_at", sinceIso).order("created_at", { ascending: true });
  return (data ?? []) as any[];
}

// ---------------------------------------------------------------- scenarios

async function c1_canonical() {
  const S = "C1 canonical complementary trio";
  await reset();
  const since = nowIso();
  const before = new Set((await homePlans("maya")).map((p) => p.id));
  // alex and jo already hold seeded open signals. only maya posts. nobody calls match.
  await postSignal("maya", "i lowkey wanna get into film photography");
  const plan = await waitForNewPlan("maya", before);
  check(S, "a plan appeared on its own", !!plan, plan ? `plan ${plan.id} "${plan.activity}" state=${plan.state}` : "no new plan within timeout");
  if (!plan) return;
  const members = memberIds(plan);
  check(S, "plan is a proposal, not a formed group", plan.state === "proposing", `state=${plan.state}`);
  check(S, "alex or jo (or both) were brought in", members.includes("alex") || members.includes("jo"), `members=${members.join(",")}`);
  check(S, "every member is maya's friend", members.every((m) => friendsOf("maya").has(m)), `members=${members.join(",")}`);
  check(S, "experience is not the seeded thrift template", !/thrift/i.test(plan.activity ?? "") || /photo|market|walk/i.test(plan.activity ?? ""), `activity="${plan.activity}"`);

  // privacy: no plan view may contain another person's raw signal text. the
  // starter legitimately sees their own words back (rawText is starter-only);
  // a member's view must contain nobody's raw signal, including the starter's.
  const raws: Record<string, string> = {
    maya: "i lowkey wanna get into film photography",
    alex: "need something fun to do this weekend",
    jo: "i've been wanting to explore some vintage markets",
  };
  const viewers = ["maya", ...members];
  for (const v of viewers) {
    const { json } = await api("GET", `/api/plans/${plan.id}`, v);
    const text = JSON.stringify(json ?? {});
    const others = Object.entries(raws).filter(([u]) => u !== v).map(([, t]) => t);
    const leaked = others.find((t) => text.includes(t));
    check(S, `other people's raw signals hidden from ${v}`, !leaked, leaked ? `leaked: "${leaked}"` : "no other raw signal text in view");
    if (v !== "maya") check(S, `member ${v} sees no raw thought at all`, (json as any)?.rawText === null, `rawText=${JSON.stringify((json as any)?.rawText)}`);
  }
  const outsider = ["dev", "theo", "ravi", "sam"].find((u) => !members.includes(u) && u !== "maya")!;
  const out = await api("GET", `/api/plans/${plan.id}`, outsider);
  check(S, "non-member gets 404", out.status === 404, `status=${out.status}`);

  // consent: nothing is a group until enough members explicitly say down
  const need: Record<string, string> = {};
  for (const m of members) need[m] = m;
  let view: any = plan;
  for (const m of members) {
    const r = await api("POST", `/api/plans/${plan.id}/respond`, m, { status: "down" });
    view = r.json ?? view;
  }
  check(S, "quorum made it real", view?.state === "happening", `state=${view?.state}`);
  // the group chat, card and event are written by makeItReal after the last
  // response returns, so poll the plan view until the thread shows up.
  let threadId: string | null = null;
  for (let i = 0; i < 30 && !threadId; i++) {
    const { json: fresh } = await api("GET", `/api/plans/${plan.id}`, "maya");
    if (typeof fresh?.threadId === "string" && fresh.threadId) threadId = fresh.threadId;
    else await sleep(3_000);
  }
  check(S, "group chat exists once real", !!threadId, `threadId=${threadId ?? "none after polling"}`);
  if (threadId) {
    const member = members[0];
    const posted = await api("POST", `/api/threads/${threadId}/messages`, member, { body: "this actually works for me", clientId: `eval-c1-${Date.now()}` });
    check(S, "member can post in the group chat", posted.status === 200, `status=${posted.status}`);
    const ask = await api("POST", `/api/threads/${threadId}/messages`, member, { body: "@muse what should we bring?", clientId: `eval-c1-q-${Date.now()}` });
    const msgId = ask.json?.id ?? ask.json?.message?.id;
    if (msgId) {
      const reply = await sse(`/api/threads/${threadId}/muse`, member, { messageId: msgId });
      const doneMsg = reply.events.find((e) => e.event === "done")?.data?.message;
      check(S, "@muse answers in the chat", !!doneMsg && typeof doneMsg.body === "string" && doneMsg.body.length > 0, doneMsg ? `"${String(doneMsg.body).slice(0, 90)}"` : `error=${reply.error}`);
    } else {
      check(S, "@muse answers in the chat", false, "could not post the @muse message");
    }
  }
  const trace = await traceSince(since);
  const conv = trace.filter((t) => t.job === "converge");
  check(S, "converge ran live", conv.some((t) => t.ok && t.model === "muse-spark-1.3"), `converge rows=${conv.length} models=${[...new Set(conv.map((t) => t.model))].join(",")}`);
  check(S, "no cached converge verdicts", conv.every((t) => t.model !== "cache"), `models=${[...new Set(conv.map((t) => t.model))].join(",")}`);
}

async function c2_sports() {
  const S = "C2 pickleball (new topic + event)";
  await reset();
  await postSignal("cyrus", "been wanting to get back into pickleball");
  await postSignal("dev", "down for something active saturday morning");
  const before = new Set((await homePlans("kai")).map((p) => p.id));
  await postSignal("kai", "anyone down for pickleball this weekend?");
  const plan = await waitForNewPlan("kai", before);
  check(S, "a plan appeared on its own", !!plan, plan ? `"${plan.activity}" state=${plan.state}` : "no new plan");
  if (!plan) return;
  const members = memberIds(plan);
  check(S, "cyrus was brought in", members.includes("cyrus"), `members=${members.join(",")}`);
  const { data: prow } = await db.from("plans").select("when_day,when_time").eq("id", plan.id).single();
  check(S, "time is saturday morning, when all three are free", prow?.when_day === "sat" && typeof prow?.when_time === "string" && prow.when_time >= "08:00" && prow.when_time <= "10:00", `when=${prow?.when_day} ${prow?.when_time ?? ""}`);
}

async function c3_food() {
  const S = "C3 market + cooking (complementary)";
  await reset();
  await postSignal("eli", "farmers market run sunday morning, need to actually go this time");
  const before = new Set((await homePlans("ollie")).map((p) => p.id));
  await postSignal("ollie", "want to actually cook something new this sunday");
  const plan = await waitForNewPlan("ollie", before);
  check(S, "a plan appeared on its own", !!plan, plan ? `"${plan.activity}" state=${plan.state}` : "no new plan");
  if (!plan) return;
  const members = memberIds(plan);
  check(S, "eli was brought in", members.includes("eli"), `members=${members.join(",")}`);
  const { data: prow } = await db.from("plans").select("when_day,when_time").eq("id", plan.id).single();
  check(S, "plan is on sunday", prow?.when_day === "sun", `when=${prow?.when_day} ${prow?.when_time ?? ""}`);
}

async function c4a_noPlansWanted() {
  const S = "C4a owner said no plans (judgment no-match)";
  await reset();
  const since = nowIso();
  await postSignal("lena", "bookstore wandering and tea on sunday");
  await postSignal("maya", "i need to actually study sunday, heads down, no plans, no people");
  const rows = await waitForConvergeTrace(since, 1);
  check(S, "convergence actually ran", rows.length >= 1, `converge rows=${rows.length}`);
  await sleep(5_000);
  const plans = await homePlans("maya");
  check(S, "no plan was created", plans.length === 0, `plans=${plans.length}`);
}

async function c4b_noOverlap() {
  const S = "C4b no shared free time (eligibility no-match)";
  await reset();
  const since = nowIso();
  await postSignal("finn", "finally trying that sourdough recipe sunday morning");
  await postSignal("cyrus", "pickleball saturday, early, who's in");
  const rows = await waitForConvergeTrace(since, 1);
  check(S, "convergence actually ran", rows.length >= 1, `converge rows=${rows.length}`);
  await sleep(5_000);
  const plans = await homePlans("cyrus");
  check(S, "no plan was created", plans.length === 0, `plans=${plans.length}`);
}

async function c5_study() {
  const S = "C5 quiet study (new topic, same friend signal as C4a)";
  await reset();
  await postSignal("lena", "bookstore wandering and tea on sunday");
  const before = new Set((await homePlans("maya")).map((p) => p.id));
  await postSignal("maya", "i need a quiet place to study sunday afternoon, company would help me focus");
  const plan = await waitForNewPlan("maya", before);
  check(S, "a plan appeared on its own", !!plan, plan ? `"${plan.activity}" state=${plan.state}` : "no new plan");
  if (!plan) return;
  const members = memberIds(plan);
  check(S, "lena was brought in", members.includes("lena"), `members=${members.join(",")}`);
}

async function c6_selective() {
  const S = "C6 quiet games vs loud karaoke (selective inclusion)";
  await reset();
  await postSignal("dara", "board games and dim sum saturday");
  await postSignal("theo", "karaoke saturday night, the louder the better");
  const before = new Set((await homePlans("ravi")).map((p) => p.id));
  await postSignal("ravi", "quiet board game afternoon saturday, nothing loud");
  const plan = await waitForNewPlan("ravi", before);
  check(S, "a plan appeared on its own", !!plan, plan ? `"${plan.activity}" state=${plan.state}` : "no new plan");
  if (!plan) return;
  const members = memberIds(plan);
  check(S, "dara was brought in", members.includes("dara"), `members=${members.join(",")}`);
  check(S, "theo was left out (vibe clash)", !members.includes("theo"), `members=${members.join(",")}`);
  if (members.includes("dara")) {
    const r = await api("POST", `/api/plans/${plan.id}/respond`, "dara", { status: "down" });
    check(S, "one down reaches quorum for a pair", r.json?.state === "happening", `state=${r.json?.state}`);
  }
}

async function c7_declineAndDedupe() {
  const S = "C7 declines fade it, re-runs do not duplicate";
  await reset();
  const museId = await postSignal("maya", "i lowkey wanna get into film photography");
  const before = new Set<string>();
  const plan = await waitForNewPlan("maya", before);
  check(S, "a plan appeared on its own", !!plan, plan ? `"${plan.activity}"` : "no new plan");
  if (!plan) return;
  const again1 = await api("POST", "/api/muse/converge", "maya", { museId });
  const again2 = await api("POST", "/api/muse/converge", "maya", { museId });
  const plansNow = await homePlans("maya");
  check(S, "manual re-runs created nothing new", plansNow.length === 1, `plans=${plansNow.length} statuses=${again1.json?.status},${again2.json?.status}`);
  const members = memberIds(plan);
  let view: any = plan;
  for (const m of members) {
    const r = await api("POST", `/api/plans/${plan.id}/respond`, m, { status: "out" });
    view = r.json ?? view;
  }
  const { json: finalView } = await api("GET", `/api/plans/${plan.id}`, "maya");
  check(S, "everyone out means it faded", (finalView?.state ?? view?.state) === "faded", `state=${finalView?.state ?? view?.state}`);
  await postSignal("maya", "ok film photography again, but a market morning this time");
  await sleep(20_000);
  const after = await homePlans("maya");
  const open = after.filter((p) => p.state === "proposing" || p.state === "happening");
  check(S, "consumed signals do not re-form the group", open.length === 0, `open plans=${open.length}`);
}

// ---------------------------------------------------------------- main

async function c8_whatIfIsNotACommitment() {
  const S = "C8 what-if explores, only a tap commits";
  await reset();
  // classic starter flow: ravi's board game signal draws dara (maybe among
  // others). everyone else is set to yes first, so dara exploring a change
  // is exactly the case that used to fire the plan by accident.
  const museId = await postSignal("ravi", "board game night at mine saturday, who's in");
  const mm = await sse("/api/muse/match", "ravi", { museId });
  const planId = (mm.events.find((e) => e.event === "done")?.data?.planId ?? null) as string | null;
  check(S, "starter plan created", !!planId, `planId=${planId ?? "none"}`);
  if (!planId) return;
  await api("POST", `/api/plans/${planId}/send`, "ravi", {});
  const { json: view0 } = await api("GET", `/api/plans/${planId}`, "ravi");
  const picks = memberIds(view0);
  check(S, "dara is the pick", picks.includes("dara"), `picks=${picks.join(",")}`);
  const quorum = (view0 as any)?.quorum as number;
  // set the trap: everyone except dara says yes first, so dara's answer is
  // the one that would complete quorum. if exploring a change silently
  // counted as her yes, the plan would fire right here.
  const others = picks.filter((p) => p !== "dara");
  for (const o of others) await api("POST", `/api/plans/${planId}/respond`, o, { status: "down" });
  const { json: armed } = await api("GET", `/api/plans/${planId}`, "ravi");
  check(S, "one yes short of quorum, still proposing", (armed as any)?.state === "proposing", `state=${(armed as any)?.state} quorum=${quorum} picks=${picks.length}`);

  const w = await sse(`/api/plans/${planId}/whatif`, "dara", { counteroffer: "could we start at 5 instead? i have to leave by 9" });
  const done = w.events.find((e) => e.event === "done")?.data;
  check(S, "what-if re-solve completed live", !!done && done.source === "live", done ? `source=${done.source} changed=${done.changed} worksForAsker=${done.worksForAsker}` : `error=${w.error}`);
  check(S, "plan did NOT become happening from exploring", done?.state === "proposing", `state=${done?.state}`);

  const { json: daraView } = await api("GET", `/api/plans/${planId}`, "dara");
  check(S, "dara is asked again, not marked down", (daraView as any)?.me?.status === "pending", `me.status=${(daraView as any)?.me?.status}`);
  check(S, "plan still proposing afterwards", (daraView as any)?.state === "proposing", `state=${(daraView as any)?.state}`);

  // the explicit tap is what commits her, and only then does it become real.
  const r = await api("POST", `/api/plans/${planId}/respond`, "dara", { status: "down" });
  check(S, "explicit down makes it real", r.json?.state === "happening", `state=${r.json?.state}`);
  let threadId: string | null = null;
  for (let i = 0; i < 30 && !threadId; i++) {
    const { json: fresh } = await api("GET", `/api/plans/${planId}`, "ravi");
    if (typeof fresh?.threadId === "string" && fresh.threadId) threadId = fresh.threadId;
    else await sleep(3_000);
  }
  check(S, "group chat created after the explicit yes", !!threadId, `threadId=${threadId ?? "none after polling"}`);
}

const scenarios: Array<[string, () => Promise<void>]> = [
  ["C1", c1_canonical],
  ["C2", c2_sports],
  ["C3", c3_food],
  ["C4a", c4a_noPlansWanted],
  ["C4b", c4b_noOverlap],
  ["C5", c5_study],
  ["C6", c6_selective],
  ["C7", c7_declineAndDedupe],
  ["C8", c8_whatIfIsNotACommitment],
];

const only = process.env.CONVERGE_ONLY?.split(",").map((s) => s.trim()).filter(Boolean);

async function main() {
  const t0 = Date.now();
  for (const [name, fn] of scenarios) {
    if (only && !only.includes(name)) continue;
    console.log(`\n=== ${name} ===`);
    try {
      await fn();
    } catch (e) {
      check(name, "scenario completed", false, e instanceof Error ? e.message : String(e));
    }
  }
  const { data: allTrace } = await db.from("muse_trace").select("*").order("created_at", { ascending: true });
  const failed = checks.filter((c) => !c.pass);
  const summary = {
    ranAt: new Date().toISOString(),
    ms: Date.now() - t0,
    passed: checks.length - failed.length,
    failed: failed.length,
    checks,
    trace: (allTrace ?? []).filter((t: any) => ["understand", "converge", "create", "chat"].includes(t.job)),
  };
  writeFileSync(OUT, JSON.stringify(summary, null, 2));
  console.log(`\n${summary.passed}/${checks.length} checks passed. wrote ${OUT}`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
