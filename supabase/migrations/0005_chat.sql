-- real group messaging, muse as a co-planner in plan chats, and group change proposals.

-- a thread made for a plan knows its plan. ordinary threads have no plan and no muse.
alter table threads
  add column plan_id uuid references plans(id) on delete set null,
  add column muse_muted boolean not null default false;   -- the thread's "mute muse" switch

alter table messages
  add column kind text not null default 'text',           -- text | muse
  add column client_id text,                              -- the sender's id for this send. makes retries safe.
  add column reply_to uuid,                               -- the message a muse reply answers
  add column pending boolean not null default false;      -- muse is still writing this one

-- sending the same message twice stores it once
create unique index messages_client_once on messages (thread_id, sender_id, client_id) where client_id is not null;
-- one muse reply per trigger, however many clients ask
create unique index messages_reply_once on messages (reply_to) where reply_to is not null;
create index messages_thread_time on messages (thread_id, created_at);

-- chats are private to their members. the app reads and writes them through the api
-- server, which checks membership. the anonymous role can no longer read them.
drop policy "read messages" on messages;
drop policy "read threads" on threads;
alter publication supabase_realtime drop table messages;

-- what the app listens to instead: "something changed in this thread". no content.
create table thread_pings (
  thread_id uuid primary key references threads(id) on delete cascade,
  at timestamptz not null default now()
);
alter table thread_pings enable row level security;
create policy "read thread_pings" on thread_pings for select to anon, authenticated using (true);
alter publication supabase_realtime add table thread_pings;

-- a change to a confirmed plan that the group has to agree to. one open at a time.
create table plan_proposals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  thread_id uuid not null references threads(id) on delete cascade,
  proposer_id text not null references users(id),
  summary text not null,                                  -- what everyone reads
  change jsonb not null,                                  -- when_day, when_time, when_text, where_text, public_event_id
  status text not null default 'open' check (status in ('open', 'accepted', 'declined', 'expired')),
  plan_version int not null,                              -- the plan version it was made against
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index one_open_proposal on plan_proposals (plan_id) where status = 'open';

create table proposal_votes (
  proposal_id uuid not null references plan_proposals(id) on delete cascade,
  user_id text not null references users(id),
  vote text not null check (vote in ('yes', 'no')),
  primary key (proposal_id, user_id)
);
alter table plan_proposals enable row level security;
alter table proposal_votes enable row level security;

-- set while the chat and event for a plan are being made, so a retry can't make a second set
alter table plans add column making_at timestamptz;
