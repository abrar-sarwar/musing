import { serverDb } from "@/lib/db/server";
import { json, requireUser } from "@/lib/http";

// the muse plush pictures, for a build that does not have them bundled.
// GET /api/muse/pictures -> { pictures: { awake: url, asleep: url, ... } } with short-lived
// signed links. the pictures are supplied artwork, so the bucket is private: only someone
// signed in to the demo gets a link. the app saves the files once and keeps them.
const BUCKET = "muse-pictures";
const HOURS = 1;

export function GET() {
  return json(async () => {
    await requireUser();
    const storage = serverDb().storage.from(BUCKET);
    const { data: files, error } = await storage.list("", { limit: 50 });
    // no bucket (a local stack runs without storage): the app draws muse instead
    if (error || !files) return { pictures: {} };
    const names = files.map((f) => f.name).filter((n) => /^[a-z0-9-]+\.png$/.test(n));
    if (names.length === 0) return { pictures: {} };
    const { data: signed } = await storage.createSignedUrls(names, HOURS * 3600);
    const pictures: Record<string, string> = {};
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) pictures[s.path.replace(/\.png$/, "")] = s.signedUrl;
    }
    return { pictures };
  });
}
