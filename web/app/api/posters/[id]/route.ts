import { getPoster } from "@/lib/plans";
import { eventFor } from "@/lib/hangouts";
import { fail, requireUser } from "@/lib/http";

// the invite poster muse image made for an event. GET /api/posters/<eventId>
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    await eventFor((await requireUser()).id, id);
    const png = await getPoster(id);
    if (!png) return new Response("no poster", { status: 404 });
    return new Response(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": "private, max-age=300" } });
  } catch (error) { return fail(error); }
}
