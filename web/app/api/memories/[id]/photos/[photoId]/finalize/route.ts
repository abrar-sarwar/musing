import { finalizePhoto } from "@/lib/hangouts";
import { json, requireUser } from "@/lib/http";

export function POST(_req: Request, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  return json(async () => {
    const { id, photoId } = await params;
    return finalizePhoto((await requireUser()).id, id, photoId);
  });
}
