import { aggregateAffinity, affinityScore, rankIntentFirst, rankPassive, starWeight } from "../lib/feedback";
import { topOverlap } from "../lib/recommend";
import { matchesFriend } from "../lib/friends";

let bad = 0;
const check = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) { bad++; console.log("MISMATCH", name, "->", got, "wanted", want); }
};

check("one star", starWeight(1), -2);
check("two stars", starWeight(2), -1);
check("three stars neutral", starWeight(3), 0);
check("four stars", starWeight(4), 1);
check("five stars", starWeight(5), 2);

const affinity = aggregateAffinity([
  { rating: 5, tags: ["great_activity", "do_again", "great_crew", "great_place", "good_timing", "good_value"], recommendation_topics: ["thrifting"], recommendation_facets: { area: "midtown", daypart: "afternoon", price: "low" } },
  // note is deliberately not part of the ranking input
  { rating: 1, tags: ["not_my_vibe", "not_again", "wrong_crew", "too_far", "wrong_timing", "too_expensive"], recommendation_topics: ["golf"], recommendation_facets: { area: "candler park", daypart: "evening", price: "medium" } },
]);
check("stars plus activity and repeat tags", affinity.topics.thrifting, 4);
check("low stars plus negative activity and repeat tags", affinity.topics.golf, -4);
check("place facet only", affinity.areas.midtown, 1);
check("timing facet only", affinity.dayparts.evening, -1);
check("price facet only", affinity.prices.medium, -1);
check("crew tags never create a person score", Object.keys(affinity).some((k) => k.includes("crew")), false);

const neutral = aggregateAffinity([{ rating: 3, tags: [], recommendation_topics: ["coffee"], recommendation_facets: {} }]);
check("neutral stays neutral", neutral.topics.coffee ?? 0, 0);

const candidates = [{ id: "golf", tags: ["golf"] }, { id: "thrift", tags: ["thrifting"] }, { id: "other", tags: ["coffee"] }];
const passive = rankPassive(candidates, (row) => affinityScore(affinity, row.tags));
check("passive surfaces use personal score first", passive.map((x) => x.id), ["thrift", "other", "golf"]);
check("negative ratings down-rank without removal", passive.length, candidates.length);

const explicit = rankIntentFirst(candidates, (row) => row.id === "golf" ? 10 : row.id === "thrift" ? 2 : 0, (row) => affinityScore(affinity, row.tags));
check("explicit Muse intent stays first", explicit.map((x) => x.id), ["golf", "thrift", "other"]);

const tie = rankIntentFirst(candidates, () => 1, (row) => affinityScore(affinity, row.tags));
check("feedback breaks only relevance ties", tie.map((x) => x.id), ["thrift", "other", "golf"]);

check("friend overlap privacy floor unchanged", topOverlap([{ user_id: "a", topic: "golf", score: 9 }, { user_id: "b", topic: "golf", score: 9 }]), null);
check("friend matching unchanged", matchesFriend({ name: "Alex Kim", interests: ["golf"] }, "golf"), true);

console.log(`${18 - bad}/18 feedback and recommendation rules as expected`);
if (bad) process.exit(1);
