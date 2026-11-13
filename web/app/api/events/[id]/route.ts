import { eventFor } from "@/lib/hangouts";
import { json, requireUser } from "@/lib/http";

export function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return json(async () => eventFor((await requireUser()).id, (await params).id));
}
