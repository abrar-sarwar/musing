import { serverDb } from "@/lib/db/server";
import { json, requireUser } from "@/lib/http";

// the reel clips, for a build that does not have them bundled. GET /api/reels/videos
// -> { videos: { thriftflip: { video, poster }, ... } } with short-lived signed links.
// the clips are other creators' videos, so the bucket is private: only someone signed in
// to the demo gets a link, and a link stops working after a few hours.
const BUCKET = "reel-videos";
const HOURS = 6;

export function GET() {
  return json(async () => {
    await requireUser();
    const storage = serverDb().storage.from(BUCKET);
    const { data: files, error } = await storage.list("", { limit: 100 });
    // no bucket (a local stack runs without storage): the app falls back to its bundled files
    if (error || !files) return { videos: {} };
    const names = files.map((f) => f.name).filter((n) => /^[a-z0-9-]+\.(mp4|jpg)$/.test(n));
    if (names.length === 0) return { videos: {} };
    const { data: signed } = await storage.createSignedUrls(names, HOURS * 3600);
    const videos: Record<string, { video?: string; poster?: string }> = {};
    for (const s of signed ?? []) {
      if (!s.path || !s.signedUrl) continue;
      const [name, ext] = s.path.split(".") as [string, string];
      (videos[name] ??= {})[ext === "mp4" ? "video" : "poster"] = s.signedUrl;
    }
    return { videos };
  });
}
