-- a bigger fictional catalog: richer fields on the three discovery tables, and the reels
-- that inspire a thought. everything here is still invented mock data. nothing comes from
-- facebook, and nothing here records what a person watched, joined or bought.

-- public events. when_day + when_time stay the weekly slot, in the event's own timezone.
alter table public_events
  add column category text,
  add column end_time text,                                  -- "16:00", null = open ended
  add column timezone text not null default 'America/New_York',
  add column price int not null default 0,                   -- dollars a person, 0 = free
  add column online boolean not null default false,          -- true = virtual, area says so
  add column status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  add column sort int not null default 100;                  -- curated order, lower first

alter table groups
  add column category text,
  add column visibility text not null default 'public' check (visibility in ('public', 'private')),
  add column sort int not null default 100;

alter table listings
  add column description text,
  add column condition text,                                 -- new | like new | good | fair
  add column status text not null default 'available' check (status in ('available', 'pending', 'sold')),
  add column cover text,                                     -- bundled photo path, null = drawn placeholder
  add column sort int not null default 100;

-- reels as catalog content: a fictional creator's clip about a topic. separate from
-- reels_topics, which is a person's own (consent-gated) viewing signal. watching one of
-- these writes nothing anywhere.
create table reels (
  id text primary key,                        -- 'thrift-haul'
  topic text not null,                        -- "thrift store finds"
  title text not null,
  caption text not null,
  creator text not null,                      -- an invented handle
  pitch text not null,                        -- the thought "make a move" starts from
  tags text[] not null default '{}',          -- topic keys, see web/lib/discover.ts
  poster text,
  sort int not null default 100
);
alter table reels enable row level security;
create policy "read reels" on reels for select to anon, authenticated using (true);
