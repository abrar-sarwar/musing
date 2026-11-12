import { serverDb } from "@/lib/db/server";
import { catalog } from "@/lib/discover";
import { json, requireUser } from "@/lib/http";
import { PlanError } from "@/lib/plans";

const KINDS = ["event", "group", "listing", "group_join"] as const;
type Kind = (typeof KINDS)[number];

// save a listing, an event or a group, or join a group. POST { kind, id, on }.
// mock interactions for the acting person only. nothing is bought, reserved or sent to anyone,
// and joining never happens on someone's behalf.
export function POST(req: Request) {
  return json(async () => {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { kind?: unknown; id?: unknown; on?: unknown };
    const kind = KINDS.find((k) => k === body.kind) as Kind | undefined;
    const id = typeof body.id === "string" ? body.id : "";
    if (!kind || typeof body.on !== "boolean") throw new PlanError("expected { kind, id, on: boolean }");
    const c = await catalog();
    const exists = kind === "event" ? c.events.some((x) => x.id === id) : kind === "listing" ? c.listings.some((x) => x.id === id) : c.groups.some((x) => x.id === id);
    if (!exists) throw new PlanError("not found", 404);
    const db = serverDb();
    const { error } = body.on
      ? await db.from("saved_items").upsert({ user_id: user.id, kind, ref_id: id })
      : await db.from("saved_items").delete().eq("user_id", user.id).eq("kind", kind).eq("ref_id", id);
    if (error) throw new Error(`saved_items: ${error.message}`);
    return { ok: true, key: `${kind}:${id}`, on: body.on };
  });
}
