import type { SupabaseClient } from "@supabase/supabase-js";
import {
  APP_SETTINGS,
  EVENTS,
  FRIEND_EDGES,
  MESSAGES,
  PAST_MUSES,
  POSTS,
  THREADS,
  USERS,
} from "./data";

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

  return { users: USERS.length, friendships: friendships.length };
}

async function insert(db: SupabaseClient, table: string, rows: object[]) {
  if (rows.length === 0) return;
  const { error } = await db.from(table).insert(rows);
  if (error) throw new Error(`insert ${table}: ${error.message}`);
}
