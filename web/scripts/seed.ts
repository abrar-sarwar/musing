// run: pnpm seed   (loads .env.local via node --env-file)
import { serverDb } from "@/lib/db/server";
import { resetSeed } from "@/lib/seed/reset";

const t0 = Date.now();
resetSeed(serverDb())
  .then((r) => {
    console.log(`seeded ${r.users} users, ${r.friendships} friendship rows in ${Date.now() - t0}ms`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
