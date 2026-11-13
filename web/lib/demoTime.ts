import { serverDb } from "@/lib/db/server";

const KEY = "demo_time_offset_seconds";

export type DemoClock = { offsetSeconds: number; now: string };

export async function getDemoClock(): Promise<DemoClock> {
  const { data, error } = await serverDb().from("app_settings").select("value").eq("key", KEY).maybeSingle();
  if (error) throw new Error(`demo clock: ${error.message}`);
  const offsetSeconds = typeof data?.value === "number" ? Math.trunc(data.value) : 0;
  return { offsetSeconds, now: new Date(Date.now() + offsetSeconds * 1000).toISOString() };
}

export async function setDemoOffset(offsetSeconds: number): Promise<DemoClock> {
  if (!Number.isInteger(offsetSeconds) || Math.abs(offsetSeconds) > 7 * 24 * 60 * 60) throw new Error("demo time offset must be within seven days");
  const { error } = await serverDb().from("app_settings").upsert({ key: KEY, value: offsetSeconds });
  if (error) throw new Error(`demo clock: ${error.message}`);
  return getDemoClock();
}
