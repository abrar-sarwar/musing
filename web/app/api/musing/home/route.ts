import { json, requireUser } from "@/lib/http";
import { getHome } from "@/lib/plans";

// everything the musing. tab needs for the acting user, already privacy-shaped.
export function GET() {
  return json(async () => getHome((await requireUser()).id));
}
