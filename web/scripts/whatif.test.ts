import { suggestWhatIfs, usableAreas } from "@/lib/whatif";

const areas = ["Midtown", "Decatur", "Old Fourth Ward", "Grant Park"];
const base = { planId: "p1", day: "sat" as const, time: "13:00", where: "old fourth ward", fixed: false, viewerFree: [{ day: "sat" as const, start: "11:00", end: "16:00" }, { day: "sun" as const, start: "15:00", end: "20:00" }], areas };
const open = suggestWhatIfs(base);
const fixed = suggestWhatIfs({ ...base, fixed: true });
const bare = suggestWhatIfs({ planId: "p2", day: null, time: null, where: null, fixed: false, viewerFree: [], areas: [] });
const noWindows = suggestWhatIfs({ ...base, viewerFree: [] });
const late = suggestWhatIfs({ ...base, time: "22:30" });

const cases: Array<[string, unknown, unknown]> = [
  ["open: three ideas", open.length, 3],
  // the day offered is one this person is free, at a time inside that window
  ["open: a day they are free", open[0], "Sunday around 3 instead?"],
  ["open: an hour later", open[1], "An hour later, around 2?"],
  ["open: a nearby area, never the plan's own", /^Somewhere around (Midtown|Decatur|Grant Park) instead\?$/.test(open[2]), true],
  ["open: same plan, same ideas", JSON.stringify(suggestWhatIfs(base)), JSON.stringify(open)],
  // a public event keeps its day, time and place: nothing offered tries to move them
  ["fixed: three ideas", fixed.length, 3],
  ["fixed: no day or place change", fixed.some((s) => /instead/i.test(s)), false],
  ["fixed: names the plan's area", fixed.some((s) => s.includes("Old Fourth Ward")), true],
  ["no windows: the day after", noWindows[0], "Sunday instead?"],
  ["late: no 'hour later' past 11", late.some((s) => /hour later/i.test(s)), false],
  ["late: still at least two", late.length >= 2, true],
  ["bare: at least two, no crash", bare.length >= 2, true],
  ["bare: no undefined text", bare.some((s) => /undefined|null|NaN/.test(s)), false],
  ["half past", suggestWhatIfs({ ...base, time: "18:30" })[1], "An hour later, around 7:30?"],
  // the city itself, online and far-away spots are not "somewhere nearby"
  ["areas: drops city, online, far", JSON.stringify(usableAreas(["Midtown", "Atlanta", "Midtown", "Online", "Decatur", "Stone Mountain area, about 30 minutes east", "Midtown"], "Atlanta")), JSON.stringify(["Midtown", "Decatur"])],
];
let bad = 0;
for (const [name, got, want] of cases) if (got !== want) { bad++; console.log("MISMATCH", name, "->", got, "wanted", want); }
console.log(`${cases.length - bad}/${cases.length} what-if ideas as expected`);
if (bad) process.exit(1);
