import { memoryFor } from "@/lib/hangouts";
import { json, requireUser } from "@/lib/http";

export function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return json(async () => memoryFor((await requireUser()).id, (await params).id));
}
