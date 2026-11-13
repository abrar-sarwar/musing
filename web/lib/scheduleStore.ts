import { serverDb } from "@/lib/db/server";
import { effectiveWindows, rulesFromWindows, sameWindows } from "@/lib/schedule";
import type { FreeWindow, ScheduleRule, User } from "@/lib/types";

// where a person's schedule rules are kept. the rules are what they see and edit; the weekly
// free windows those rules come to are stored beside them, because that is what planners read.

export type ScheduleView = { rules: ScheduleRule[]; windows: FreeWindow[] };

export function scheduleOf(user: User): ScheduleView {
  return { rules: user.schedule_rules ?? rulesFromWindows(user.free_windows ?? []), windows: user.free_windows ?? [] };
}

export async function saveRules(userId: string, rules: ScheduleRule[]): Promise<ScheduleView> {
  const windows = effectiveWindows(rules);
  const { error } = await serverDb().from("users").update({ schedule_rules: rules, free_windows: windows }).eq("id", userId);
  if (error) throw new Error(`availability: ${error.message}`);
  return { rules, windows };
}

// rules can start or end on a date, so the windows they come to drift as days pass. whenever
// the person acts, theirs are worked out again and the stored copy is brought up to date.
export async function refreshWindows(user: User): Promise<User> {
  if (!user.schedule_rules) return user;
  const windows = effectiveWindows(user.schedule_rules);
  if (sameWindows(windows, user.free_windows ?? [])) return user;
  const { error } = await serverDb().from("users").update({ free_windows: windows }).eq("id", user.id);
  if (error) console.error("free windows refresh failed:", error.message);
  return { ...user, free_windows: windows };
}
