-- musing. schema. prototype only: all writes go through server routes with the
-- service role key; the browser uses the anon key for reads + realtime.

create extension if not exists pgcrypto;

-- ---------- people ----------
create table users (
  id text primary key,                        -- 'maya', 'alex', 'jo', 'sam', ...
  name text not null,
  avatar_seed text not null,                  -- initials avatar, deterministic color
  bio text,
  interests text[] not null default '{}',
  free_windows jsonb not null default '[]',   -- [{"day":"sat","start":"11:00","end":"16:00"}]
  reels_opt_in boolean not null default false,
  settings jsonb not null default '{}'        -- step 14 toggles
);

create table friendships (                    -- seeded symmetrically
  user_id text references users(id) on delete cascade,
  friend_id text references users(id) on delete cascade,
  primary key (user_id, friend_id)
);

create table reels_topics (
  user_id text references users(id) on delete cascade,
  topic text not null,
  score int not null default 1,
  primary key (user_id, topic)
);

-- ---------- musing ----------
create table muses (                          -- one raw signal
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id),
  raw_text text not null,
  understood jsonb,
  visibility text not null default 'just_friends',
  created_at timestamptz not null default now()
);

create table plans (
  id uuid primary key default gen_random_uuid(),
  muse_id uuid not null references muses(id) on delete cascade,
  starter_id text not null references users(id),
  version int not null default 1,
  state text not null default 'proposing',    -- proposing | happening | done
  solving boolean not null default false,     -- true while muse re-solves
  activity text,
  when_text text,
  where_text text,
  pitch text,                                 -- the "wait, hear me out..." text
  quorum int not null default 3,
  muse_on boolean not null default true,      -- false = plain poll mode
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table plan_members (
  plan_id uuid references plans(id) on delete cascade,
  user_id text references users(id),
  reason text,                                -- why muse picked them
  personal_ask text,                          -- what this friend sees
  status text not null default 'pending',     -- pending | down | out
  counteroffer text,                          -- "what if..."
  updated_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);

-- "just between us". separate table, never in the realtime publication,
-- no anon select policy. only the server with the service role reads it.
create table plan_private_limits (
  plan_id uuid references plans(id) on delete cascade,
  user_id text references users(id),
  limit_text text not null,
  updated_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);

create table muse_trace (
  id bigserial primary key,
  plan_id uuid,
  job text not null,                          -- understand | match | coordinate | create | suggest
  model text not null,
  latency_ms int not null,
  ok boolean not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create table muse_cache (                     -- last good output per job
  job text primary key,
  output jsonb not null,
  updated_at timestamptz not null default now()
);

create table app_settings (
  key text primary key,
  value jsonb not null
);

-- ---------- mock facebook shell ----------
create table posts (
  id uuid primary key default gen_random_uuid(),
  author_id text not null references users(id),
  body text not null,
  kind text not null default 'post',          -- post | recap
  plan_id uuid,
  created_at timestamptz not null default now()
);

create table threads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  member_ids text[] not null
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references threads(id) on delete cascade,
  sender_id text references users(id),        -- null = muse
  body text,
  card jsonb,                                 -- plan card payload
  created_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid,
  host_id text not null references users(id),
  title text not null,
  description text,
  starts_at timestamptz,
  location text,
  poster_url text,
  created_at timestamptz not null default now()
);

-- ---------- helpers ----------
-- opted-in friends of p_user who share p_topic in their reels
create or replace function reels_overlap(p_user text, p_topic text)
returns int
language sql stable
set search_path = public
as $$
  select count(*)::int
  from friendships f
  join users u on u.id = f.friend_id and u.reels_opt_in
  join reels_topics r on r.user_id = u.id and r.topic = p_topic
  where f.user_id = p_user
$$;

-- one-tap reset. truncates everything; the seed script re-inserts.
create or replace function reset_all()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate table
    plan_private_limits, plan_members, plans, muses,
    muse_trace, muse_cache, app_settings,
    messages, threads, events, posts,
    reels_topics, friendships, users
  restart identity cascade;
end;
$$;

-- ---------- realtime ----------
alter publication supabase_realtime add table plans, plan_members, messages, events, muse_trace, app_settings;

-- ---------- rls: anon may read everything except private limits. no anon writes. ----------
alter table users enable row level security;
alter table friendships enable row level security;
alter table reels_topics enable row level security;
alter table muses enable row level security;
alter table plans enable row level security;
alter table plan_members enable row level security;
alter table plan_private_limits enable row level security;
alter table muse_trace enable row level security;
alter table muse_cache enable row level security;
alter table app_settings enable row level security;
alter table posts enable row level security;
alter table threads enable row level security;
alter table messages enable row level security;
alter table events enable row level security;

create policy "read users" on users for select to anon, authenticated using (true);
create policy "read friendships" on friendships for select to anon, authenticated using (true);
create policy "read reels_topics" on reels_topics for select to anon, authenticated using (true);
create policy "read muses" on muses for select to anon, authenticated using (true);
create policy "read plans" on plans for select to anon, authenticated using (true);
create policy "read plan_members" on plan_members for select to anon, authenticated using (true);
create policy "read muse_trace" on muse_trace for select to anon, authenticated using (true);
create policy "read app_settings" on app_settings for select to anon, authenticated using (true);
create policy "read posts" on posts for select to anon, authenticated using (true);
create policy "read threads" on threads for select to anon, authenticated using (true);
create policy "read messages" on messages for select to anon, authenticated using (true);
create policy "read events" on events for select to anon, authenticated using (true);
-- plan_private_limits and muse_cache: no anon policy on purpose.

revoke execute on function reset_all() from public, anon, authenticated;
