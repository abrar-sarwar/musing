import { deletePhoto } from "@/lib/hangouts";
import { json, requireUser } from "@/lib/http";

type Ctx = { params: Promise<{ id: string; photoId: string }> };

export function DELETE(_req: Request, { params }: Ctx) {
  return json(async () => {
    const { id, photoId } = await params;
    return deletePhoto((await requireUser()).id, id, photoId);
  });
}
