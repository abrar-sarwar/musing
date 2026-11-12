import type { FreeWindow } from "@/lib/types";

export const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Day = FreeWindow["day"];

export function isDay(v: unknown): v is Day {
  return typeof v === "string" && (DAYS as readonly string[]).includes(v);
}

export function isTime(v: unknown): v is string {
  return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

// "thursday, november 12"
export function todayLine(now = new Date()): string {
  return now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toLowerCase();
}

// the next time this weekday + time comes around (today counts if it's still ahead)
export function nextOccurrence(day: Day, time: string, now = new Date()): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(now);
  d.setHours(h ?? 12, m ?? 0, 0, 0);
  const add = (DAYS.indexOf(day) - now.getDay() + 7) % 7;
  d.setDate(d.getDate() + add);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 7);
  return d;
}

// is this person free at day + time, going by their free windows?
export function isFreeAt(windows: FreeWindow[], day: Day, time: string): boolean {
  return windows.some((w) => w.day === day && w.start <= time && time < w.end);
}

export function windowsLine(windows: FreeWindow[]): string {
  if (windows.length === 0) return "no free time listed";
  return windows.map((w) => `${w.day} ${w.start}-${w.end}`).join(", ");
}
