import { NextResponse } from "next/server";
import { serverDb } from "@/lib/db/server";
import { resetSeed } from "@/lib/seed/reset";

// one-tap reset between demo runs. POST /api/reset
export async function POST() {
  const t0 = Date.now();
  try {
    const r = await resetSeed(serverDb());
    return NextResponse.json({ ok: true, ...r, ms: Date.now() - t0 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
