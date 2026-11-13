import type { SupabaseClient } from "@supabase/supabase-js";
import {
  APP_SETTINGS,
  EVENTS,
  FRIEND_EDGES,
  FRIEND_SIGNALS,
  GROUP_MEMBERS,
  GROUPS,
  LISTINGS,
  MESSAGES,
  PAST_MUSES,
  POSTS,
  PUBLIC_EVENTS,
  THREADS,
  USERS,
} from "./data";
import { NEW_GROUP_MEMBERS, NEW_GROUPS, NEW_LISTINGS, NEW_PUBLIC_EVENTS, NEW_REELS } from "./catalog";

// wipes every table and re-inserts the seed. used by scripts/seed.ts and POST /api/reset.
export async function resetSeed(db: SupabaseClient): Promise<{ users: number; friendships: number }> {
  const { error: resetErr } = await db.rpc("reset_all");
  if (resetErr) throw new Error(`reset_all: ${resetErr.message}`);

  await insert(db, "users", USERS.map((u) => ({
    id: u.id,
    name: u.name,
    avatar_seed: u.name,
    bio: u.bio,
    interests: u.interests,
    free_windows: u.free_windows,
    reels_opt_in: u.reels_opt_in,
    settings: {},
  })));

  const friendships = FRIEND_EDGES.flatMap(([a, b]) => [
    { user_id: a, friend_id: b },
    { user_id: b, friend_id: a },
  ]);
  await insert(db, "friendships", friendships);

  await insert(db, "reels_topics", USERS.flatMap((u) =>
    u.reels.map(([topic, score]) => ({ user_id: u.id, topic, score })),
  ));

  await insert(db, "muses", PAST_MUSES);
  await insert(db, "posts", POSTS);
  await insert(db, "threads", THREADS);
  await insert(db, "messages", MESSAGES);
  await insert(db, "events", EVENTS);
  await insert(db, "app_settings", APP_SETTINGS);

  // signals a few friends already floated, and who said "i'm into this" on them
  const { data: signals, error: sigErr } = await db.from("muses").insert(FRIEND_SIGNALS.map((sig) => ({ user_id: sig.user_id, raw_text: sig.raw_text, audience: sig.audience, wait_for: sig.wait_for, created_at: sig.created_at, expires_at: sig.expires_at }))).select("id,user_id,raw_text");
  if (sigErr) throw new Error(`insert signals: ${sigErr.message}`);
  await insert(db, "signal_interest", FRIEND_SIGNALS.flatMap((sig) => {
    const id = signals?.find((m) => m.user_id === sig.user_id && m.raw_text === sig.raw_text)?.id as string | undefined;
    return id ? sig.interested.map((user_id) => ({ muse_id: id, user_id })) : [];
  }));

  // the discovery catalog has stable ids, so it is upserted rather than wiped: running
  // this twice never duplicates a record. the original rows come first in every list
  // (sort 0..), then the bigger catalog from ./catalog.ts (sort 100..).
  await upsert(db, "groups", GROUPS.map((g, i) => ({ ...g, sort: i })));
  await upsert(db, "groups", NEW_GROUPS);
  await upsert(db, "public_events", PUBLIC_EVENTS.map((e, i) => ({ ...e, sort: i })));
  await upsert(db, "public_events", NEW_PUBLIC_EVENTS);
  await upsert(db, "listings", LISTINGS.map((l, i) => ({ ...l, cover: `market/${l.id}.jpg`, sort: i })));
  await upsert(db, "listings", NEW_LISTINGS);
  await upsert(db, "reels", NEW_REELS);
  // memberships are cleared with users (cascade), so a plain insert never doubles them
  await insert(db, "group_members", [...GROUP_MEMBERS, ...NEW_GROUP_MEMBERS].map(([group_id, user_id]) => ({ group_id, user_id })));

  return { users: USERS.length, friendships: friendships.length };
}

async function insert(db: SupabaseClient, table: string, rows: object[]) {
  if (rows.length === 0) return;
  const { error } = await db.from(table).insert(rows);
  if (error) throw new Error(`insert ${table}: ${error.message}`);
}

async function upsert(db: SupabaseClient, table: string, rows: object[]) {
  const { error } = await db.from(table).upsert(rows);
  if (error) throw new Error(`upsert ${table}: ${error.message}`);
}
