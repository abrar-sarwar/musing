import { NextResponse } from "next/server";
import { getActingUserId } from "@/lib/user";

// the app pings this on launch to confirm it can reach the api server.
export async function GET() {
  // reachability must not depend on being signed in: a deployed server has no acting user until
  // the app trades the demo passcode for a token, and the Developer screen tests without one.
  const actingAs = await getActingUserId().catch(() => null);
  return NextResponse.json({ ok: true, actingAs, time: new Date().toISOString() });
}
