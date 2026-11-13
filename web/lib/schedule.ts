import type { FreeWindow, ScheduleRule } from "@/lib/types";
import { DAYS, isDay, isTime, type Day } from "@/lib/when";

// a person's schedule as a few rules ("usually free tuesdays 6 to 10", "away nov 27-29"),
// and how those become the weekly free windows every planner already reads. no database,
// no muse: everything here is decided from the rules and today's date.

export const MAX_RULES = 24;
const KINDS = ["free", "ask", "busy"] as const;
const ALL_DAY: [string, string] = ["00:00", "23:59"];

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

/** "2026-11-21" for a date, read on the server's own clock like the rest of lib/when */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// rules as they arrive from the app or from muse. returns the cleaned rules, or a sentence saying what is wrong.
export function parseRules(input: unknown): ScheduleRule[] | string {
  if (!Array.isArray(input)) return "send a list of rules";
  if (input.length > MAX_RULES) return `keep it to ${MAX_RULES} rules`;
  const out: ScheduleRule[] = [];
  for (const [i, raw] of input.entries()) {
    const r = (raw ?? {}) as Record<string, unknown>;
    if (!(KINDS as readonly unknown[]).includes(r.kind)) return "each rule is free, ask or busy";
    const days = Array.isArray(r.days) ? [...new Set(r.days)] : [];
    if (!days.every(isDay)) return "a rule's days are mon to sun";
    const start = r.start ?? null;
    const end = r.end ?? null;
    if ((start === null) !== (end === null)) return "a rule has both a start and an end time, or neither";
    if (start !== null && (!isTime(start) || !isTime(end) || start >= end)) return "a rule's start time comes before its end time";
    const from = r.from ?? null;
    const until = r.until ?? null;
    if ((from !== null && !isDate(from)) || (until !== null && !isDate(until))) return "a rule's dates look like 2026-11-21";
    if (from !== null && until !== null && from > until) return "a rule starts before it ends";
    if (days.length === 0 && from === null && until === null) return "a rule needs a day of the week or a date";
    const note = typeof r.note === "string" && r.note.trim() ? r.note.trim().slice(0, 140) : null;
    const id = typeof r.id === "string" && /^[\w-]{1,40}$/.test(r.id) && !out.some((x) => x.id === r.id) ? r.id : `r${i + 1}-${Math.random().toString(36).slice(2, 8)}`;
    out.push({ id, kind: r.kind as ScheduleRule["kind"], days: sortDays(days as Day[]), start: start as string | null, end: end as string | null, from: from as string | null, until: until as string | null, note });
  }
  return out;
}

// monday first, the way the app lists them
const WEEK: Day[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const sortDays = (days: Day[]) => [...days].sort((a, b) => WEEK.indexOf(a) - WEEK.indexOf(b));

// someone who has never described their schedule still has free windows (the seed's, or ones
// saved earlier). shown as rules: one per set of hours, with the days that share them.
export function rulesFromWindows(windows: FreeWindow[]): ScheduleRule[] {
  const byHours = new Map<string, Day[]>();
  for (const w of windows) byHours.set(`${w.start}-${w.end}`, [...(byHours.get(`${w.start}-${w.end}`) ?? []), w.day]);
  return [...byHours.entries()]
    .map(([hours, days]) => {
      const [start, end] = hours.split("-") as [string, string];
      return { id: `w-${start.replace(":", "")}-${end.replace(":", "")}`, kind: "free" as const, days: sortDays([...new Set(days)]), start, end, from: null, until: null, note: null };
    })
    .sort((a, b) => WEEK.indexOf(a.days[0]!) - WEEK.indexOf(b.days[0]!) || a.start.localeCompare(b.start));
}

function holdsOn(r: ScheduleRule, day: Day, date: string): boolean {
  if (r.days.length > 0 && !r.days.includes(day)) return false;
  return (r.from === null || r.from <= date) && (r.until === null || date <= r.until);
}

type Span = [string, string];

function minus(spans: Span[], cut: Span): Span[] {
  return spans.flatMap(([s, e]): Span[] => {
    if (cut[1] <= s || e <= cut[0]) return [[s, e]];
    const left: Span[] = s < cut[0] ? [[s, cut[0]]] : [];
    const right: Span[] = cut[1] < e ? [[cut[1], e]] : [];
    return [...left, ...right];
  });
}

function merged(spans: Span[]): Span[] {
  const out: Span[] = [];
  for (const [s, e] of [...spans].sort((a, b) => a[0].localeCompare(b[0]))) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = e > last[1] ? e : last[1];
    else out.push([s, e]);
  }
  return out;
}

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

function freeOn(rules: ScheduleRule[], day: Day, date: string): Span[] {
  let spans = merged(rules.filter((r) => r.kind === "free" && holdsOn(r, day, date)).map((r): Span => (r.start && r.end ? [r.start, r.end] : ALL_DAY)));
  for (const r of rules) if (r.kind === "busy" && holdsOn(r, day, date)) spans = minus(spans, r.start && r.end ? [r.start, r.end] : ["00:00", "24:00"]);
  // a sliver left between two busy stretches is not time anyone can plan in
  return spans.filter(([s, e]) => minutes(e) - minutes(s) >= 30);
}

// the weekly free windows these rules come to, for the next time each weekday comes around.
// plans are made for "the next saturday", so a rule that starts or ends on a date is read
// against that saturday's date. "ask" rules never count as free: muse does not assume a maybe.
export function effectiveWindows(rules: ScheduleRule[], now = new Date()): FreeWindow[] {
  const out: FreeWindow[] = [];
  const clock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  for (const day of WEEK) {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + ((DAYS.indexOf(day) - now.getDay() + 7) % 7));
    let spans = freeOn(rules, day, ymd(date));
    // what is left of today counts. once today's windows are over, it is next week's that matter.
    if (ymd(date) === ymd(now)) {
      spans = spans.filter(([, e]) => e > clock);
      if (spans.length === 0) {
        date.setDate(date.getDate() + 7);
        spans = freeOn(rules, day, ymd(date));
      }
    }
    for (const [start, end] of spans) out.push({ day, start, end });
  }
  return out;
}

export const sameWindows = (a: FreeWindow[], b: FreeWindow[]) => JSON.stringify(a) === JSON.stringify(b);
