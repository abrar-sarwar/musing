import { serverDb } from "@/lib/db/server";
import { json, requireUser } from "@/lib/http";
import { PlanError } from "@/lib/plans";
import type { FreeWindow } from "@/lib/types";
import { isDay, isTime } from "@/lib/when";

const MAX_WINDOWS = 21;

// a person's own weekly free time, the starting point muse plans from.
// GET -> { windows }. PUT { windows: [{ day, start, end }] } replaces them. only ever the acting person's own.
export function GET() {
  return json(async () => ({ windows: (await requireUser()).free_windows ?? [] }));
}

export function PUT(req: Request) {
  return json(async () => {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { windows?: unknown };
    if (!Array.isArray(body.windows) || body.windows.length > MAX_WINDOWS) throw new PlanError(`send up to ${MAX_WINDOWS} windows`);
    const windows: FreeWindow[] = [];
    for (const w of body.windows as Array<Record<string, unknown>>) {
      if (!w || !isDay(w.day) || !isTime(w.start) || !isTime(w.end) || w.start >= w.end) throw new PlanError("each window needs a day and a start time before its end time");
      // one window per day and start: a repeat replaces, it does not stack
      if (!windows.some((x) => x.day === w.day && x.start === w.start)) windows.push({ day: w.day, start: w.start, end: w.end });
    }
    const { error } = await serverDb().from("users").update({ free_windows: windows }).eq("id", user.id);
    if (error) throw new Error(`availability: ${error.message}`);
    return { windows };
  });
}
