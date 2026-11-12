import { serverDb } from "./server";
import { DEMO_ORDER } from "@/lib/constants";
import type { Message, Post, Thread, User } from "@/lib/types";

const rank = (u: User) => {
  const i = DEMO_ORDER.indexOf(u.id);
  return i === -1 ? 99 : i;
};

export async function getUsers(): Promise<User[]> {
  const { data, error } = await serverDb().from("users").select("*");
  if (error) throw new Error(`getUsers: ${error.message}`);
  return (data as User[]).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

export async function getUser(id: string): Promise<User | null> {
  const { data, error } = await serverDb().from("users").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getUser: ${error.message}`);
  return (data as User | null) ?? null;
}

export async function getFriends(userId: string): Promise<User[]> {
  const db = serverDb();
  const { data: edges, error } = await db.from("friendships").select("friend_id").eq("user_id", userId);
  if (error) throw new Error(`getFriends: ${error.message}`);
  const ids = (edges ?? []).map((e) => e.friend_id as string);
  if (ids.length === 0) return [];
  const { data, error: err2 } = await db.from("users").select("*").in("id", ids);
  if (err2) throw new Error(`getFriends users: ${err2.message}`);
  return (data as User[]).sort((a, b) => a.name.localeCompare(b.name));
}

export type FeedPost = Post & { author: User };

export async function getFeedPosts(): Promise<FeedPost[]> {
  const db = serverDb();
  const [{ data: posts, error }, users] = await Promise.all([
    db.from("posts").select("*").order("created_at", { ascending: false }),
    getUsers(),
  ]);
  if (error) throw new Error(`getFeedPosts: ${error.message}`);
  const byId = new Map(users.map((u) => [u.id, u]));
  return (posts as Post[])
    .map((p) => ({ ...p, author: byId.get(p.author_id)! }))
    .filter((p) => p.author);
}

export type ThreadWithMessages = Thread & { messages: Message[] };

export async function getThreadsFor(userId: string): Promise<ThreadWithMessages[]> {
  const db = serverDb();
  const { data: threads, error } = await db.from("threads").select("*").contains("member_ids", [userId]);
  if (error) throw new Error(`getThreadsFor: ${error.message}`);
  const list = (threads ?? []) as Thread[];
  if (list.length === 0) return [];
  const { data: messages, error: err2 } = await db
    .from("messages")
    .select("*")
    .in("thread_id", list.map((t) => t.id))
    .order("created_at", { ascending: true });
  if (err2) throw new Error(`getThreadsFor messages: ${err2.message}`);
  const msgs = (messages ?? []) as Message[];
  return list.map((t) => ({ ...t, messages: msgs.filter((m) => m.thread_id === t.id) }));
}
