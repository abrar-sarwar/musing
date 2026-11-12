import { listThreads } from "@/lib/chat";
import { json, requireUser } from "@/lib/http";

// the chats this person is in, newest first. GET /api/threads
export function GET() {
  return json(async () => ({ threads: await listThreads((await requireUser()).id) }));
}
