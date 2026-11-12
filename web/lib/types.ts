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

// draft: only the starter has seen it. faded: quorum became impossible, ends quietly.
export type PlanState = "draft" | "proposing" | "happening" | "faded";
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
  note: string | null;
  when_day: FreeWindow["day"] | null;
  when_time: string | null;
  thread_id: string | null;
  event_id: string | null;
  public_event_id: string | null; // set when the plan is to go to a public event. its time and place are fixed.
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

export type MuseJob = "understand" | "match" | "coordinate" | "create" | "suggest" | "chat";

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

// ---------- api view models (what the app is allowed to see) ----------

export type Person = { id: string; name: string; avatar_seed: string };

export type Settings = {
  muse_on: boolean; // false = plain poll mode, no muse calls
  muse_replay: boolean; // true = serve last good muse responses, no live calls
  posters_on: boolean; // false = skip the invite poster image
};

// one plan, shaped for one viewer. responses stay private until quorum:
// before "happening" nobody (starter included) sees who said yes or who passed.
export type PlanView = {
  id: string;
  state: PlanState;
  version: number;
  solving: boolean;
  museOn: boolean;
  role: "starter" | "member";
  starter: Person;
  rawText: string | null; // the starter's own words. starter only, or everyone in poll mode
  activity: string | null;
  when: string | null;
  where: string | null;
  pitch: string | null; // starter only
  note: string | null; // muse's line after a re-solve. no names, no reasons
  quorum: number; // friends needed
  invited: number;
  downCount: number;
  picks: Array<{ user: Person; reason: string | null }> | null; // starter only
  going: Person[] | null; // only once it's happening
  me: {
    personalAsk: string | null;
    status: MemberStatus;
    counteroffer: string | null;
    privateLimit: string | null; // your own, echoed back to you only
  } | null; // members only
  threadId: string | null;
  eventId: string | null;
  // what muse found for this plan: at most one public event, one group, two listings.
  // catalog records only. never anyone's membership, saves or history.
  opportunities: Array<{ kind: "event" | "group" | "listing"; id: string; title: string; sub: string; reason: string | null; cover: string | null }>;
  updatedAt: string;
};

export type MusingHome = {
  settings: Settings;
  asks: PlanView[]; // plans where someone's thought reached me
  mine: PlanView[]; // plans i started
  muses: Muse[]; // my own past thoughts
};

export type Suggestion = { suggestion: string; why: string; source: "live" | "cache" };

export type Overlap = { topic: string; count: number } | null;
