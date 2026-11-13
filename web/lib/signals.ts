// rules about a signal that need no database: who it is shown to, how many it waits
// for, when it runs out, and what a set of answers adds up to.

// close = the author's close friends only. muse = nobody but muse: no longer something a person
// picks, but still what an unrecognised value, an older app build and a retired signal get.
export type Audience = "close" | "friends" | "mutual" | "muse";
export type ExpiryChoice = "1d" | "3d" | "1w" | "2w";

const DAYS: Record<ExpiryChoice, number> = { "1d": 1, "3d": 3, "1w": 7, "2w": 14 };

/** anything unrecognised stays private: a signal is only shared when the app says so */
export function parseAudience(v: unknown): Audience {
  return v === "close" || v === "friends" || v === "mutual" ? v : "muse";
}

export function parseWaitFor(v: unknown): number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5 ? v : 2;
}

export function expiresAt(choice: unknown, now: Date): string {
  const days = typeof choice === "string" && choice in DAYS ? DAYS[choice as ExpiryChoice] : DAYS["1w"];
  return new Date(now.getTime() + days * 86_400_000).toISOString();
}

export function isExpired(expiresAt: string | null | undefined, now: Date): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  return Number.isFinite(t) && t < now.getTime();
}

/** wait-for can never ask for more people than were asked */
export function quorumFor(waitFor: number, picks: number): number {
  return Math.max(1, Math.min(waitFor, picks));
}

/** a maybe is neither a yes nor a no: it never makes the plan happen and never rules it out */
export function outcome(statuses: string[], quorum: number): "happening" | "faded" | "open" {
  const down = statuses.filter((s) => s === "down").length;
  const out = statuses.filter((s) => s === "out").length;
  if (down >= quorum) return "happening";
  if (statuses.length - out < quorum) return "faded";
  return "open";
}

/** "close" = a friend the author counts as close. they see everything a friend sees, plus close-only signals. */
export function canSeeSignal(audience: Audience, relation: "self" | "close" | "friend" | "mutual" | "none"): boolean {
  if (relation === "self") return true;
  if (relation === "close") return audience !== "muse";
  if (relation === "friend") return audience === "friends" || audience === "mutual";
  if (relation === "mutual") return audience === "mutual";
  return false;
}
