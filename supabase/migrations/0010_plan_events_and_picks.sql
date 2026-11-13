-- public events made from the composer, the starter's say over which of muse's picks are
-- asked, and one seeded golf event for the events feed.

-- an event a person makes straight from the composer ("create event") is public: anyone in
-- the app can see it. the event a plan makes at quorum stays private to the people going.
-- both are in-app mock events. nothing is published to facebook.
alter table events add column if not exists visibility text not null default 'public' check (visibility in ('public', 'private'));
update events set visibility = 'private' where plan_id is not null;

-- a pick muse made that the starter chose not to ask, kept with muse's reason and ask so
-- putting them back restores exactly what muse wrote. drafts only, never seen by the friend.
create table if not exists plan_skips (
  plan_id uuid not null references plans(id) on delete cascade,
  user_id text not null references users(id),
  reason text,
  personal_ask text,
  created_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);
-- no anon policy: who the starter left off is served only to the starter, by the api.
alter table plan_skips enable row level security;

-- the golf event, so a database that is already seeded has it without a reset. the seed
-- (web/lib/seed/data.ts) upserts the same row. fictional, like the rest of the catalog.
insert into public_events (id, title, description, when_day, when_time, when_text, area, tags, organizer, capacity, group_id, cover, sort)
values ('twilight-golf', 'Twilight Nine Holes', 'Nine holes at the public course after work. Clubs to borrow at the shop, no handicap needed, and nobody keeps score past the third hole.', 'thu', '17:30', 'thursday at 5:30', 'Candler Park', '{golf,sports,social}', 'Candler Park Golf Course', 16, null, null, 9)
on conflict (id) do nothing;

-- the demo reset also forgets skipped picks.
create or replace function reset_all()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate table
    plan_skips,
    signal_matches,
    signal_interest,
    plan_private_limits, plan_members, plans, muses,
    muse_trace, app_settings,
    messages, threads, events, posts,
    reels_topics, friendships, users
  restart identity cascade;
  delete from muse_cache where job like 'poster\_%' or job like 'suggest\_%';
end;
$$;
revoke execute on function reset_all() from public, anon, authenticated;
