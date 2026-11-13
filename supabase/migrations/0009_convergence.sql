-- convergence: muse noticing that separate friends' open signals fit together.
-- a signal folded into a convergence plan is spent, and each convergence is
-- recorded once so the same group is never proposed twice from the same signals.

alter table muses add column consumed_plan_id uuid references plans(id) on delete set null;

create table signal_matches (
  id uuid primary key default gen_random_uuid(),
  trigger_muse_id uuid not null references muses(id) on delete cascade,
  owner_id text not null references users(id),
  participant_ids text[] not null,            -- everyone in the plan, owner included, sorted
  dedupe_key text not null unique,            -- the sorted set of signal ids that converged
  plan_id uuid references plans(id) on delete set null,
  summary text,
  created_at timestamptz not null default now()
);

alter table signal_matches enable row level security;
-- no anon policies: only the server (service role) reads or writes this table.

-- keep the demo reset aware of convergence state (the signals-era reset_all,
-- plus signal_matches, so a reset cannot leave stale dedupe rows behind).
create or replace function reset_all()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate table
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
