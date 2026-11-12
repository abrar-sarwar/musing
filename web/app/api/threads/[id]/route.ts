import { getThread } from "@/lib/chat";
import { json, requireUser } from "@/lib/http";

// one chat: its members, messages and any plan change being voted on. members only.
export function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return json(async () => getThread((await params).id, (await requireUser()).id));
}
