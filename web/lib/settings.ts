import { serverDb } from "@/lib/db/server";
import type { Settings } from "@/lib/types";

const DEFAULTS: Settings = { muse_on: true, muse_replay: false, posters_on: true };

export async function getSettings(): Promise<Settings> {
  const { data, error } = await serverDb().from("app_settings").select("key,value");
  if (error) throw new Error(`getSettings: ${error.message}`);
  const out: Settings = { ...DEFAULTS };
  for (const row of data ?? []) {
    if (row.key in out && typeof row.value === "boolean") out[row.key as keyof Settings] = row.value;
  }
  return out;
}

export async function setSetting(key: keyof Settings, value: boolean): Promise<void> {
  const { error } = await serverDb().from("app_settings").upsert({ key, value });
  if (error) throw new Error(`setSetting: ${error.message}`);
}

export function isSettingKey(k: unknown): k is keyof Settings {
  return typeof k === "string" && k in DEFAULTS;
}
