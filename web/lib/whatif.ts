import type { FreeWindow } from "@/lib/types";
import { DAYS, type Day } from "@/lib/when";

// ideas for the "what if..." box: two or three changes this person could ask for, built
// from the plan itself. no muse call. tapping one only fills the box; nothing is sent.

export type WhatIfInput = {
  planId: string;
  day: Day | null;
  time: string | null; // "13:00"
  where: string | null;
  /** built around a public event: its day, time and place do not move */
  fixed: boolean;
  /** the viewer's own free time, so the day offered is one they can make */
  viewerFree: FreeWindow[];
  /** neighbourhoods from the catalog, most common first (see usableAreas) */
  areas: string[];
};

const DAY_NAMES: Record<Day, string> = { sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday" };

// "13:00" -> "1", "18:30" -> "6:30". no am/pm, the way plans are written ("saturday at 1")
function clock(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const hour = ((h + 11) % 12) + 1;
  return m ? `${hour}:${String(m).padStart(2, "0")}` : String(hour);
}

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

const titled = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** catalog areas that work as "somewhere nearby": not the city itself, not online, not a drive away */
export function usableAreas(all: string[], city: string | null): string[] {
  const count = new Map<string, number>();
  for (const a of all) {
    const area = a.trim();
    if (!area || area.includes(",") || /online/i.test(area) || area.toLowerCase() === city?.toLowerCase()) continue;
    count.set(area, (count.get(area) ?? 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a);
}

export function suggestWhatIfs(i: WhatIfInput): string[] {
  const here = i.where?.trim() ?? "";
  if (i.fixed) {
    // the event's own day, time and place stand. these are the things that can still flex.
    return [
      "Meet up 30 minutes before and head over together?",
      here ? `Grab food around ${titled(here)} after?` : "Grab food nearby after?",
      "Just the first hour or so?",
    ];
  }

  const out: string[] = [];
  // another day: the nearest one after the plan's that this person is free, at a time inside that window
  const from = i.day ? DAYS.indexOf(i.day) : -1;
  const ahead = (d: Day) => (DAYS.indexOf(d) - from + 7) % 7 || 7;
  const other = i.viewerFree.filter((w) => w.day !== i.day).sort((a, b) => ahead(a.day) - ahead(b.day) || a.start.localeCompare(b.start))[0];
  if (other) {
    const at = i.time && other.start <= i.time && i.time < other.end ? i.time : other.start;
    out.push(`${DAY_NAMES[other.day]} around ${clock(at)} instead?`);
  } else if (i.day) {
    out.push(`${DAY_NAMES[DAYS[(from + 1) % 7]]} instead?`);
  } else {
    out.push("A different day?");
  }

  // same day, a little later
  if (i.time) {
    const [h, m] = i.time.split(":").map(Number);
    if (h + 1 < 23) out.push(`An hour later, around ${clock(`${h + 1}:${String(m).padStart(2, "0")}`)}?`);
  }

  // somewhere else in town: a real area from the catalog, never the plan's own
  const near = i.areas.filter((a) => !here || (!here.toLowerCase().includes(a.toLowerCase()) && !a.toLowerCase().includes(here.toLowerCase()))).slice(0, 3);
  out.push(near.length > 0 ? `Somewhere around ${near[hash(i.planId) % near.length]} instead?` : "Somewhere closer?");
  return out;
}
