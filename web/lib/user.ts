import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { DEFAULT_USER, USER_COOKIE, USER_HEADER } from "./constants";

const TOKEN_HEADER = "x-musing-token";

/** "<userId>.<signature>". issued by POST /api/session to someone who knows the demo passcode. */
export function signUser(userId: string): string {
  const secret = process.env.DEMO_SECRET;
  if (!secret) throw new Error("missing DEMO_SECRET");
  return `${userId}.${createHmac("sha256", secret).update(userId).digest("hex")}`;
}

function userFromToken(token: string | null): string | null {
  if (!token || !process.env.DEMO_SECRET) return null;
  const userId = token.split(".")[0] ?? "";
  const expected = Buffer.from(signUser(userId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given) ? userId : null;
}

// who the request is acting as. there is no real login in this prototype.
// local dev: the app's x-musing-user header (or the web shell's cookie) is taken at its word.
// deployed: that header is not proof of anything, so a signed token is required instead.
export async function getActingUserId(): Promise<string> {
  const h = await headers();
  if (process.env.NODE_ENV === "production") {
    const fromToken = userFromToken(h.get(TOKEN_HEADER));
    if (!fromToken) throw Object.assign(new Error("sign in to the demo first"), { status: 401 });
    return fromToken;
  }
  const fromHeader = h.get(USER_HEADER);
  if (fromHeader) return fromHeader;
  const jar = await cookies();
  return jar.get(USER_COOKIE)?.value ?? DEFAULT_USER;
}
