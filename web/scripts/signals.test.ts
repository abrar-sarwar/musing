import { parseAudience, parseWaitFor, expiresAt, isExpired, quorumFor, outcome, canSeeSignal } from "@/lib/signals";

const now = new Date("2026-11-12T00:00:00.000Z");
const cases: Array<[string, unknown, unknown]> = [
  ["parseWaitFor 3", parseWaitFor(3), 3],
  ["parseWaitFor '4'", parseWaitFor("4"), 2],
  ["parseWaitFor 0", parseWaitFor(0), 2],
  ["parseWaitFor 9", parseWaitFor(9), 2],
  ["parseWaitFor 2.5", parseWaitFor(2.5), 2],
  ["parseWaitFor undefined", parseWaitFor(undefined), 2],
  ["parseAudience mutual", parseAudience("mutual"), "mutual"],
  ["parseAudience muse", parseAudience("muse"), "muse"],
  ["parseAudience junk", parseAudience("everyone"), "friends"],
  ["parseAudience undefined", parseAudience(undefined), "friends"],
  ["expiresAt 1d", expiresAt("1d", now), "2026-11-13T00:00:00.000Z"],
  ["expiresAt 3d", expiresAt("3d", now), "2026-11-15T00:00:00.000Z"],
  ["expiresAt 1w", expiresAt("1w", now), "2026-11-19T00:00:00.000Z"],
  ["expiresAt 2w", expiresAt("2w", now), "2026-11-26T00:00:00.000Z"],
  ["expiresAt nope", expiresAt("nope", now), "2026-11-19T00:00:00.000Z"],
  ["isExpired null", isExpired(null, now), false],
  ["isExpired future", isExpired("2026-11-12T00:00:01.000Z", now), false],
  ["isExpired one second past", isExpired("2026-11-11T23:59:59.000Z", now), true],
  ["quorumFor 5,3", quorumFor(5, 3), 3],
  ["quorumFor 2,4", quorumFor(2, 4), 2],
  ["quorumFor 2,0", quorumFor(2, 0), 1],
  ["outcome down down pending", outcome(["down", "down", "pending"], 2), "happening"],
  ["outcome out out pending", outcome(["out", "out", "pending"], 2), "faded"],
  ["outcome maybe out pending", outcome(["maybe", "out", "pending"], 2), "open"],
  ["outcome maybe maybe", outcome(["maybe", "maybe"], 2), "open"],
  ["outcome down out out", outcome(["down", "out", "out"], 2), "faded"],
  ["see friends/friend", canSeeSignal("friends", "friend"), true],
  ["see friends/mutual", canSeeSignal("friends", "mutual"), false],
  ["see mutual/mutual", canSeeSignal("mutual", "mutual"), true],
  ["see mutual/friend", canSeeSignal("mutual", "friend"), true],
  ["see muse/friend", canSeeSignal("muse", "friend"), false],
  ["see muse/self", canSeeSignal("muse", "self"), true],
  ["see friends/none", canSeeSignal("friends", "none"), false],
  ["see mutual/none", canSeeSignal("mutual", "none"), false],
];
let bad = 0;
for (const [name, got, want] of cases) if (got !== want) { bad++; console.log("MISMATCH", name, "->", got, "wanted", want); }
console.log(`${cases.length - bad}/${cases.length} signal rules as expected`);
if (bad) process.exit(1);
