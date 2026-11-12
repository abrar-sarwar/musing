import { serverDb } from "@/lib/db/server";
import { PlanError } from "@/lib/plans";
import type { User } from "@/lib/types";
import { getActingUserId } from "@/lib/user";

// the acting user, checked against the seed. no auth, prototype only.
export async function requireUser(): Promise<User> {
  const id = await getActingUserId();
  const { data, error } = await serverDb().from("users").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new PlanError("unknown user", 404);
  return data as User;
}

export function fail(e: unknown): Response {
  const status = e instanceof PlanError ? e.status : 500;
  const message = e instanceof Error ? e.message : String(e);
  if (status >= 500) console.error(e);
  return Response.json({ ok: false, error: message }, { status });
}

// wraps a json route handler: PlanError -> its status, anything else -> 500
export async function json(fn: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await fn());
  } catch (e) {
    return fail(e);
  }
}

export function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t.length > 0 ? t : null;
}

// reset and the demo switches change state for everyone, and muse calls cost money.
// on a deployed server they need the admin token; a local dev server stays open.
export function requireAdmin(req: Request): void {
  if (process.env.NODE_ENV !== "production") return;
  const token = process.env.ADMIN_TOKEN;
  if (!token || req.headers.get("x-admin-token") !== token) throw new PlanError("not allowed", 403);
}
