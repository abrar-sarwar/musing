import { memoriesFor } from "@/lib/hangouts";
import { json, requireUser } from "@/lib/http";

export function GET() {
  return json(async () => memoriesFor((await requireUser()).id));
}
