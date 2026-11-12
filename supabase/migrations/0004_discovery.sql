-- opportunity discovery: a fictional catalog muse can search (public events, groups,
-- marketplace listings) and the links from a plan to the things it uses.
-- everything here is invented mock data. nothing comes from facebook.

-- public events people could go to. separate from `events`, which holds the private
-- event a plan creates when it reaches quorum.
create table public_events (
  id text primary key,                        -- 'vintage-popup'
  title text not null,
  description text not null,
  when_day text not null,                     -- sun..sat. recurs weekly so the demo never goes stale
  when_time text not null,                    -- "13:00"
  when_text text not null,                    -- "saturday at 1"
  area text not null,                         -- a general area, never an address
  tags text[] not null default '{}',          -- topic keys, see web/lib/discover.ts
  organizer text not null,
  capacity int,                               -- null = open
  group_id text,                              -- the group running it, if any
  cover text                                  -- bundled mock image path
);

create table groups (
  id text primary key,                        -- 'weekend-thrift-club'
  name text not null,
  description text not null,
  tags text[] not null default '{}',
  area text not null,
  cover text,
  member_count int not null default 0,        -- a mock headline number
  activity text[] not null default '{}'       -- a few public posts
);

-- who is in a group. never readable by the app directly: membership is private.
create table group_members (
  group_id text not null references groups(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  primary key (group_id, user_id)
);

-- marketplace listings, searchable by the backend. the app keeps its own copy of the
-- photos, keyed by the same ids.
create table listings (
  id text primary key,
  title text not null,
  price int not null,
  category text not null,
  place text not null,
  tags text[] not null default '{}',
  seller_id text not null
);

-- what a plan uses: at most one public event, one group and two listings.
create table plan_opportunities (
  plan_id uuid not null references plans(id) on delete cascade,
  kind text not null check (kind in ('event', 'group', 'listing')),
  ref_id text not null,
  reason text,
  primary key (plan_id, kind, ref_id)
);

-- things a person saved, and groups they joined, through mock interactions.
create table saved_items (
  user_id text not null references users(id) on delete cascade,
  kind text not null check (kind in ('event', 'group', 'listing', 'group_join')),
  ref_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, ref_id)
);

-- a plan built around a public event keeps that event's day, time and place.
alter table plans add column public_event_id text;

-- where a thought started (a listing, an event, a group, a reel topic), so the person
-- doesn't have to type it again.
alter table muses add column context jsonb;

alter table public_events enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table listings enable row level security;
alter table plan_opportunities enable row level security;
alter table saved_items enable row level security;

-- the catalog is public mock data. memberships, saves and plan links go through the api.
create policy "read public_events" on public_events for select to anon, authenticated using (true);
create policy "read groups" on groups for select to anon, authenticated using (true);
create policy "read listings" on listings for select to anon, authenticated using (true);
