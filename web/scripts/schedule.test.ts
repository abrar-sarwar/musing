import { effectiveWindows, parseRules, rulesFromWindows } from "@/lib/schedule";
import type { ScheduleRule } from "@/lib/types";

const rule = (r: Partial<ScheduleRule>): ScheduleRule => ({ id: "x", kind: "free", days: [], start: null, end: null, from: null, until: null, note: null, ...r });
const on = (rules: ScheduleRule[], now: Date, day: string) => effectiveWindows(rules, now).filter((w) => w.day === day).map((w) => `${w.start}-${w.end}`).join(",");

// friday 13 november 2026, 10:00. the figma example: free tue/thu 6-10 after nov 20, some
// saturdays, work mon/wed 6am-6pm until dec 31, away nov 27-29.
const NOW = new Date(2026, 10, 13, 10, 0);
const figma = [
  rule({ id: "a", days: ["tue", "thu"], start: "18:00", end: "22:00", from: "2026-11-21" }),
  rule({ id: "b", kind: "ask", days: ["sat"] }),
  rule({ id: "c", kind: "busy", days: ["mon", "wed"], start: "06:00", end: "18:00", until: "2026-12-31" }),
  rule({ id: "d", kind: "busy", from: "2026-11-27", until: "2026-11-29" }),
];
const later = new Date(2026, 10, 22, 10, 0); // sunday the 22nd: the tue/thu rule has started
const weekend = [rule({ id: "e", days: ["fri", "sat", "sun"], start: "10:00", end: "20:00" })];
const lunch = [rule({ id: "f", days: ["sat"], start: "10:00", end: "20:00" }), rule({ id: "g", kind: "busy", days: ["sat"], start: "12:00", end: "14:00" })];
const grouped = rulesFromWindows([{ day: "sat", start: "12:00", end: "18:00" }, { day: "sun", start: "12:00", end: "18:00" }, { day: "fri", start: "18:00", end: "23:00" }]);

const cases: Array<[string, unknown, unknown]> = [
  ["a rule that hasn't started gives no window", on(figma, NOW, "tue"), ""],
  ["once it starts, it does", on(figma, later, "tue"), "18:00-22:00"],
  ["and thursday too", on(figma, later, "thu"), "18:00-22:00"],
  ["'ask each time' is never counted as free", on(figma, later, "sat"), ""],
  ["busy rules alone make nobody free", on(figma, later, "mon"), ""],
  ["away dates remove the days they cover", on([...weekend, figma[3]!], new Date(2026, 10, 23, 10, 0), "sat"), ""],
  ["away dates leave the days outside them", on([...weekend, figma[3]!], NOW, "sat"), "10:00-20:00"],
  ["a busy stretch splits a free one", on(lunch, NOW, "sat"), "10:00-12:00,14:00-20:00"],
  ["what's left of today counts", on(weekend, NOW, "fri"), "10:00-20:00"],
  ["today's window over: next week's is read (the 20th, before away)", on([...weekend, figma[3]!], new Date(2026, 10, 13, 21, 0), "fri"), "10:00-20:00"],
  ["all-day free", on([rule({ days: ["sun"] })], NOW, "sun"), "00:00-23:59"],
  ["an ended rule gives nothing", on([rule({ days: ["sun"], start: "10:00", end: "12:00", until: "2026-11-01" })], NOW, "sun"), ""],
  ["old windows become rules, days sharing hours together", grouped.map((r) => `${r.days.join("+")} ${r.start}-${r.end}`).join(" | "), "fri 18:00-23:00 | sat+sun 12:00-18:00"],
  ["rules from windows give the same windows back", JSON.stringify(effectiveWindows(grouped, NOW).map((w) => `${w.day} ${w.start}`)), JSON.stringify(["fri 18:00", "sat 12:00", "sun 12:00"])],
  ["parse: good rules pass", Array.isArray(parseRules(figma)), true],
  ["parse: days come back monday first", (parseRules([{ kind: "free", days: ["sun", "tue"], start: "10:00", end: "11:00" }]) as ScheduleRule[])[0]?.days.join(","), "tue,sun"],
  ["parse: end before start", typeof parseRules([{ kind: "free", days: ["sat"], start: "18:00", end: "10:00" }]), "string"],
  ["parse: half a time", typeof parseRules([{ kind: "free", days: ["sat"], start: "18:00", end: null }]), "string"],
  ["parse: no day and no date", typeof parseRules([{ kind: "busy", days: [] }]), "string"],
  ["parse: a date that isn't one", typeof parseRules([{ kind: "busy", days: [], from: "nov 27" }]), "string"],
  ["parse: unknown kind", typeof parseRules([{ kind: "maybe", days: ["sat"] }]), "string"],
  ["parse: not a list", typeof parseRules({}), "string"],
];
let bad = 0;
for (const [name, got, want] of cases) if (got !== want) { bad++; console.log("MISMATCH", name, "->", got, "wanted", want); }
console.log(`${cases.length - bad}/${cases.length} schedule rules as expected`);
if (bad) process.exit(1);
