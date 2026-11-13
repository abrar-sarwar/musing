-- Private post-hangout feedback, RSVP state, and the user's in-app Memories archive.
-- All application access is through viewer-shaped server routes using the service role.

create table event_rsvps (
  event_id uuid not null references events(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  status text not null check (status in ('interested', 'going')),
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_rsvps_user_status on event_rsvps (user_id, status, updated_at desc);

create table hangout_memories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  tags text[] not null default '{}',
  private_note text check (char_length(private_note) <= 500),
  recommendation_topics text[] not null default '{}',
  recommendation_facets jsonb not null default '{}',
  event_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id),
  constraint hangout_memory_tags_limit check (cardinality(tags) <= 4),
  constraint hangout_memory_tags_known check (tags <@ array[
    'great_activity','great_crew','great_place','good_timing','good_value','do_again',
    'not_my_vibe','wrong_crew','too_far','wrong_timing','too_expensive','not_again'
  ]::text[])
);
create index hangout_memories_owner_time on hangout_memories (user_id, updated_at desc);
create index hangout_memories_event_owner on hangout_memories (event_id, user_id);

create table memory_photos (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references hangout_memories(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  storage_path text not null unique,
  position smallint not null check (position between 0 and 4),
  state text not null default 'pending' check (state in ('pending', 'ready', 'failed')),
  mime_type text not null check (mime_type = 'image/jpeg'),
  byte_size integer not null check (byte_size between 1 and 6291456),
  width integer not null check (width between 1 and 2048),
  height integer not null check (height between 1 and 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (memory_id, position)
);
create index memory_photos_owner_memory on memory_photos (user_id, memory_id, position);

alter table event_rsvps enable row level security;
alter table hangout_memories enable row level security;
alter table memory_photos enable row level security;

-- `events` used to be directly readable by anon. Private plan events and all personal
-- RSVP/feedback fields are now served only by /api/events and /api/memories.
drop policy if exists "read events" on events;
revoke all on event_rsvps, hangout_memories, memory_photos from public, anon, authenticated;
revoke all on events from anon, authenticated;

-- Private bucket. The server reserves user-owned paths and issues time-limited signed
-- upload/download URLs; clients never receive a public object URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hangout-memories', 'hangout-memories', false, 6291456, array['image/jpeg']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- The demo clock advances completion without changing either phone's clock. The offset is
-- server-wide so two-user demos, API responses, database locks, and notifications agree.
create or replace function musing_now()
returns timestamptz
language sql stable
set search_path = public
as $$
  select now() + make_interval(secs => coalesce(
    (select (value #>> '{}')::integer from app_settings where key = 'demo_time_offset_seconds'),
    0
  ))
$$;
revoke execute on function musing_now() from public, anon, authenticated;
grant execute on function musing_now() to service_role;

-- A hangout is complete two hours after its scheduled start. Undated events never complete.
create or replace function event_is_complete(p_event_id uuid, p_at timestamptz default musing_now())
returns boolean
language sql stable
set search_path = public
as $$
  select coalesce(starts_at + interval '2 hours' <= p_at, false)
  from events where id = p_event_id
$$;
revoke execute on function event_is_complete(uuid, timestamptz) from public, anon, authenticated;
grant execute on function event_is_complete(uuid, timestamptz) to service_role;

create or replace function lock_completed_rsvp_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if event_is_complete(coalesce(new.event_id, old.event_id)) then
    raise exception 'this event is complete';
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.locked then
    raise exception 'this attendee is locked as going';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger event_rsvps_open_only
before insert or update or delete on event_rsvps
for each row execute function lock_completed_rsvp_changes();

-- Hosts and confirmed plan attendees are persisted as Going. Plan attendees are locked:
-- their RSVP is a consequence of an explicit plan response, not a second public control.
create or replace function seed_event_attendees()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into event_rsvps (event_id, user_id, status, locked)
  values (new.id, new.host_id, 'going', true)
  on conflict (event_id, user_id) do update set status = 'going', locked = true, updated_at = now();

  if new.plan_id is not null then
    insert into event_rsvps (event_id, user_id, status, locked)
    select new.id, pm.user_id, 'going', true
    from plan_members pm
    where pm.plan_id = new.plan_id and pm.status = 'down'
    on conflict (event_id, user_id) do update set status = 'going', locked = true, updated_at = now();
  end if;
  return new;
end;
$$;
create trigger events_seed_attendees
after insert on events
for each row execute function seed_event_attendees();

create or replace function sync_late_plan_attendee()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'down' then
    insert into event_rsvps (event_id, user_id, status, locked)
    select e.id, new.user_id, 'going', true
    from events e
    where e.plan_id = new.plan_id and not event_is_complete(e.id)
    on conflict (event_id, user_id) do update set status = 'going', locked = true, updated_at = now();
  end if;
  return new;
end;
$$;
create trigger plan_members_sync_rsvp
after insert or update of status on plan_members
for each row execute function sync_late_plan_attendee();

create or replace function freeze_completed_plan_response()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.status, new.counteroffer) is distinct from (old.status, old.counteroffer)
     and exists (select 1 from events e where e.plan_id = new.plan_id and event_is_complete(e.id)) then
    raise exception 'this plan is complete';
  end if;
  return new;
end;
$$;
create trigger plan_members_complete_lock
before update on plan_members
for each row execute function freeze_completed_plan_response();

create or replace function preserve_memory_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.event_id, new.user_id, new.event_snapshot, new.recommendation_topics, new.recommendation_facets)
     is distinct from
     (old.event_id, old.user_id, old.event_snapshot, old.recommendation_topics, old.recommendation_facets) then
    raise exception 'memory identity and event grounding are immutable';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger hangout_memories_preserve_identity
before update on hangout_memories
for each row execute function preserve_memory_identity();

-- Keep reset deterministic. Storage objects are removed by the server before this RPC.
create or replace function reset_all()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate table
    memory_photos, hangout_memories, event_rsvps,
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
grant execute on function reset_all() to service_role;
