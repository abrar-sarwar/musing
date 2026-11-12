-- step 5+: plan fields the mix needs, and a tighter privacy posture.

-- structured time so the server can compute a real date without asking muse twice
alter table plans
  add column note text,                       -- muse's latest "here's the new shape" line
  add column when_day text,                   -- mon..sun
  add column when_time text,                  -- "13:00"
  add column thread_id uuid,                  -- set on quorum
  add column event_id uuid;                   -- set on quorum

-- plans.state is now: draft | proposing | happening | faded
-- draft  = only the starter has seen it. nothing has been sent to anyone.
-- faded  = quorum became impossible. it ends quietly; nobody sees who passed.
alter table plans alter column state set default 'draft';

-- who said yes, who passed and what anyone counter-offered are private until quorum.
-- the app reads plans through the api server, which shapes the view per person.
drop policy "read plan_members" on plan_members;
alter publication supabase_realtime drop table plan_members;

-- a raw thought is between the person and muse.
drop policy "read muses" on muses;

-- keep the last good muse responses across demo resets (the cache is the safety net).
create or replace function reset_all()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate table
    plan_private_limits, plan_members, plans, muses,
    muse_trace, app_settings,
    messages, threads, events, posts,
    reels_topics, friendships, users
  restart identity cascade;
  delete from muse_cache where job like 'poster\_%' or job like 'suggest\_%';
end;
$$;
revoke execute on function reset_all() from public, anon, authenticated;

-- friends overlap for the reels card. counts only opted-in friends, only for a person
-- who opted in themselves, and never returns who. the caller applies the 3+ floor.
create or replace function reels_overlap_top(p_user text)
returns table (topic text, friend_count int)
language sql stable
set search_path = public
as $$
  select r.topic, count(*)::int as friend_count
  from users me
  join friendships f on f.user_id = me.id
  join users u on u.id = f.friend_id and u.reels_opt_in
  join reels_topics r on r.user_id = u.id
  where me.id = p_user and me.reels_opt_in
  group by r.topic
  order by count(*) desc, sum(r.score) desc
  limit 1
$$;
revoke execute on function reels_overlap_top(text) from public, anon, authenticated;
grant execute on function reels_overlap_top(text) to service_role;
