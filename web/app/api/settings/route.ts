import { json, requireAdmin } from "@/lib/http";
import { PlanError } from "@/lib/plans";
import { getSettings, isSettingKey, setSetting } from "@/lib/settings";

export function GET() {
  return json(() => getSettings());
}

// POST { key, value }. demo controls: muse_on, muse_replay, posters_on.
export function POST(req: Request) {
  return json(async () => {
    requireAdmin(req);
    const body = (await req.json().catch(() => ({}))) as { key?: unknown; value?: unknown };
    if (!isSettingKey(body.key) || typeof body.value !== "boolean") throw new PlanError("expected { key, value: boolean }");
    await setSetting(body.key, body.value);
    return getSettings();
  });
}
