// puts the muse plush pictures where every build can reach them: a private storage bucket
// on the database the env file points at. the pictures are supplied artwork and are not in
// git, so without this only the mac that has the files shows the real plush.
//   cd web && node --env-file=.env.hosted.local --import tsx scripts/upload-muse.ts
// safe to run again: files are replaced, never duplicated.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { serverDb } from "@/lib/db/server";

const DIR = join(process.cwd(), "..", "ios", "Musing", "Resources", "mock", "muse");
const BUCKET = "muse-pictures";

async function main() {
  const storage = serverDb().storage;
  const { data: buckets, error } = await storage.listBuckets();
  if (error) throw new Error(`storage is not available here: ${error.message}`);
  if (!buckets.some((b) => b.name === BUCKET)) {
    const made = await storage.createBucket(BUCKET, { public: false, fileSizeLimit: "2MB", allowedMimeTypes: ["image/png"] });
    if (made.error) throw new Error(`create bucket: ${made.error.message}`);
    console.log(`made private bucket ${BUCKET}`);
  }
  const files = readdirSync(DIR).filter((f) => /^[a-z0-9-]+\.png$/.test(f));
  if (files.length === 0) throw new Error(`no pictures in ${DIR}`);
  for (const f of files) {
    const body = readFileSync(join(DIR, f));
    const up = await storage.from(BUCKET).upload(f, body, { contentType: "image/png", upsert: true });
    if (up.error) throw new Error(`upload ${f}: ${up.error.message}`);
    console.log(`uploaded ${f} (${Math.round(body.length / 1024)} KB)`);
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
