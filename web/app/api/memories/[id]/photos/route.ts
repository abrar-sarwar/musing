import { reservePhoto } from "@/lib/hangouts";
import { json, requireUser } from "@/lib/http";

export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return json(async () => {
    const body = (await req.json().catch(() => ({}))) as { mimeType?: unknown; byteSize?: unknown; width?: unknown; height?: unknown };
    return reservePhoto((await requireUser()).id, (await params).id, body);
  });
}
