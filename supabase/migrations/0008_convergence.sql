-- convergence: muse noticing that separate friends' open signals fit together.
-- a signal folded into a convergence plan is spent, and each convergence is
-- recorded once so the same group is never proposed twice from the same signals.

alter table muses add column consumed_plan_id uuid references plans(id) on delete set null;

create table signal_matches (
  id uuid primary key default gen_random_uuid(),
  trigger_muse_id uuid not null references muses(id) on delete cascade,
  owner_id text not null references users(id),
  participant_ids text[] not null,            -- everyone in the plan, owner included, sorted
  dedupe_key text not null unique,            -- sorted participant ids + primary topic
  plan_id uuid references plans(id) on delete set null,
  summary text,
  created_at timestamptz not null default now()
);

alter table signal_matches enable row level security;
-- no anon policies: only the server (service role) reads or writes this table.
