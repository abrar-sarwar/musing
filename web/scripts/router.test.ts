import { routeAsk } from "@/lib/chatRouter";
const cases: Array<[string, string | null]> = [
  ["what time are we meeting?", "time"], ["when is it again", "time"], ["where are we going", "place"], ["who's coming", "people"], ["who is going", "people"],
  ["show us the marketplace finds", "listings"], ["show our finds", "finds"], ["what's the plan", "recap"], ["recap pls", "recap"], ["what event is it", "event"],
  ["can we move it to sunday?", null], ["find food nearby", null], ["what should i wear", null], ["any other events?", null], ["is there a cheaper listing", null], ["where can we eat after", null], ["you there?", null],
];
let bad = 0;
for (const [text, want] of cases) { const got = routeAsk(text); if (got !== want) { bad++; console.log("MISMATCH", text, "->", got, "wanted", want); } }
console.log(`${cases.length - bad}/${cases.length} routed as expected`);
