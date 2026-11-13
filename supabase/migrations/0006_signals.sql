-- signals: who a thought is shown to, how many people it waits for, and when it runs out.
-- existing rows keep audience 'muse' (private), so nothing already floated becomes visible.
alter table muses add column if not exists audience text not null default 'muse';  -- friends | mutual | muse
alter table muses add column if not exists wait_for int not null default 2;
alter table muses add column if not exists expires_at timestamptz;
alter table plans add column if not exists expires_at timestamptz;
-- plan_members.status now also takes 'maybe': a private answer that is neither a yes nor a no.

-- a friend said "i'm into this" on a signal. applied to the plan as a yes once there is one.
create table if not exists signal_interest (
  muse_id uuid not null references muses(id) on delete cascade,
  user_id text not null references users(id),
  created_at timestamptz not null default now(),
  primary key (muse_id, user_id)
);
-- no anon policy on purpose: who is into what is only ever served as a count by the api.
alter table signal_interest enable row level security;

create or replace function reset_all()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate table
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
