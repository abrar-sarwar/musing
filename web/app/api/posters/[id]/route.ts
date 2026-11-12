import { getPoster } from "@/lib/plans";

// the invite poster muse image made for an event. GET /api/posters/<eventId>
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const png = await getPoster((await params).id);
  if (!png) return new Response("no poster", { status: 404 });
  return new Response(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": "public, max-age=3600" } });
}
