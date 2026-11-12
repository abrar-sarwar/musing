import { NextResponse } from "next/server";
import { z } from "zod";
import { generateImage, runStructured } from "@/lib/muse/run";

// step 3 smoke test. GET /api/muse/smoke?part=text|image[&fresh=1][&raw=1]
// serves the cache unless fresh=1, so re-loading this costs nothing.
const Smoke = z.object({
  activity: z.string(),
  vibe: z.string(),
  summary: z.string(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const part = url.searchParams.get("part") ?? "text";
  const fresh = url.searchParams.get("fresh") === "1";
  const raw = url.searchParams.get("raw") === "1";

  try {
    if (part === "image") {
      const img = await generateImage({
        job: "smoke",
        prompt: "flat illustration, soft purple to pink gradient background, a small paper invite card reading 'thrift run' in lowercase, no people, no logos",
        size: "1024x1024",
        preferCache: !fresh,
      });
      if (raw) {
        return new Response(Buffer.from(img.b64, "base64"), { headers: { "content-type": "image/png" } });
      }
      return NextResponse.json({ ok: true, part, source: img.source, latencyMs: img.latencyMs, bytes: Math.round(img.b64.length * 0.75) });
    }

    const r = await runStructured({
      job: "smoke",
      schema: Smoke,
      schemaName: "smoke",
      system: "you are muse. reply in lowercase. extract the activity and vibe from the user's thought and write a one-line summary.",
      user: "kinda wanna go thrifting this weekend but idk who'd be into it",
      summarize: (o) => `activity=${o.activity}`,
      preferCache: !fresh,
    });
    return NextResponse.json({ ok: true, part, ...r });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, part, error: message }, { status: 502 });
  }
}
