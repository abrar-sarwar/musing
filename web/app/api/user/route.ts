import { NextResponse } from "next/server";
import { serverDb } from "@/lib/db/server";
import { USER_COOKIE } from "@/lib/constants";

// user switcher. POST { id } sets the acting-user cookie. no auth, prototype only.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { id?: unknown };
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

  const { data, error } = await serverDb().from("users").select("id").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "unknown user" }, { status: 404 });

  const res = NextResponse.json({ ok: true, id });
  res.cookies.set(USER_COOKIE, id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
