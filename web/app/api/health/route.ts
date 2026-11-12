import { NextResponse } from "next/server";
import { getActingUserId } from "@/lib/user";

// the app pings this on launch to confirm it can reach the api server.
export async function GET() {
  return NextResponse.json({ ok: true, actingAs: await getActingUserId(), time: new Date().toISOString() });
}
