// private-limit leak check cases. pnpm test:leak
import { findLeak } from "../lib/muse/leak";
const cases: Array<[string, string, string[], string, boolean]> = [
  ["restates the number", "sunday around 1, everything under $15", ["i can only spend about $15 right now, money is tight"], "saturday around 1 thrift spots downtown", true],
  ["hints with a limit word", "sunday at 1. keeping it easy since money is tight for some", ["i can only spend about $15 right now, money is tight"], "saturday around 1", true],
  ["clean re-solve", "thrift run sunday around 1 at a couple of thrift spots downtown.", ["i can only spend about $15 right now, money is tight"], "a thrift run saturday around 1 a couple of thrift spots downtown, coffee after what if sunday afternoon instead?", false],
  ["word variant", "ramen friday at 7. no drinks after.", ["i'm not drinking at the moment"], "ramen friday at 7 then a bar", true],
  ["public words are fine", "sunday around 2 downtown", ["i work saturday mornings downtown"], "saturday around 1 downtown", false],
  ["time number already public", "saturday around 1", ["i have to leave by 1"], "saturday around 1", false],
];
let bad = 0;
for (const [name, out, limits, allowed, expectLeak] of cases) {
  const got = findLeak(out, limits, allowed);
  const ok = Boolean(got) === expectLeak;
  if (!ok) bad++;
  console.log(`${ok ? "pass" : "FAIL"}  ${name}  ->  ${got ?? "clean"}`);
}
process.exit(bad ? 1 : 0);
