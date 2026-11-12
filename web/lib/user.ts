import { cookies, headers } from "next/headers";
import { DEFAULT_USER, USER_COOKIE, USER_HEADER } from "./constants";

// who the request is acting as. the expo app sends the x-musing-user header,
// the web shell uses the cookie set by the user switcher. no auth, prototype only.
export async function getActingUserId(): Promise<string> {
  const h = await headers();
  const fromHeader = h.get(USER_HEADER);
  if (fromHeader) return fromHeader;
  const jar = await cookies();
  return jar.get(USER_COOKIE)?.value ?? DEFAULT_USER;
}
