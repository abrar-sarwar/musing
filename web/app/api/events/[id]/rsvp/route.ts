import { setRsvp } from "@/lib/hangouts";
import { json, requireUser } from "@/lib/http";

export function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return json(async () => {
    const body = (await req.json().catch(() => ({}))) as { status?: unknown };
    return setRsvp((await requireUser()).id, (await params).id, body.status ?? null);
  });
}
