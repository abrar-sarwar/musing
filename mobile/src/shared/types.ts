// shared row types. keep in sync with supabase/migrations/0001_init.sql

export type FreeWindow = {
  day: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  start: string; // "11:00"
  end: string; // "16:00"
};

export type User = {
  id: string;
  name: string;
  avatar_seed: string;
  bio: string | null;
  interests: string[];
  free_windows: FreeWindow[];
  reels_opt_in: boolean;
  settings: Record<string, unknown>;
};

export type Friendship = { user_id: string; friend_id: string };

export type ReelsTopic = { user_id: string; topic: string; score: number };

export type Muse = {
  id: string;
  user_id: string;
  raw_text: string;
  understood: Understood | null;
  visibility: "just_friends";
  created_at: string;
};

// output of the understand job
export type Understood = {
  activity: string;
  vibe: string;
  time_hint: string;
  budget_hint: string;
  group_size_hint: string;
  reply: string; // the one line the user reads
  clarifying_question: string | null;
};

export type PlanState = "proposing" | "happening" | "done";
export type MemberStatus = "pending" | "down" | "out";

export type Plan = {
  id: string;
  muse_id: string;
  starter_id: string;
  version: number;
  state: PlanState;
  solving: boolean;
  activity: string | null;
  when_text: string | null;
  where_text: string | null;
  pitch: string | null;
  quorum: number;
  muse_on: boolean;
  created_at: string;
  updated_at: string;
};

export type PlanMember = {
  plan_id: string;
  user_id: string;
  reason: string | null;
  personal_ask: string | null;
  status: MemberStatus;
  counteroffer: string | null;
  updated_at: string;
};

export type MuseJob = "understand" | "match" | "coordinate" | "create" | "suggest";

export type MuseTrace = {
  id: number;
  plan_id: string | null;
  job: MuseJob;
  model: string;
  latency_ms: number;
  ok: boolean;
  summary: string;
  created_at: string;
};

export type Post = {
  id: string;
  author_id: string;
  body: string;
  kind: "post" | "recap";
  plan_id: string | null;
  created_at: string;
};

export type Thread = { id: string; title: string; member_ids: string[] };

export type Message = {
  id: string;
  thread_id: string;
  sender_id: string | null; // null = muse
  body: string | null;
  card: Record<string, unknown> | null;
  created_at: string;
};

export type Event = {
  id: string;
  plan_id: string | null;
  host_id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  location: string | null;
  poster_url: string | null;
  created_at: string;
};
