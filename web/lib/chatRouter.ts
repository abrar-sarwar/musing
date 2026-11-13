// the intent router for @muse in a group chat. questions about things the plan already
// knows (when, where, who, what it uses) are answered straight from the database: no model
// call, a few milliseconds. anything that needs reasoning, a search or a change goes to muse.

export type Route = "time" | "place" | "people" | "recap" | "finds" | "listings" | "event" | "group";

// asking for a change, a search, an opinion or anything about money is muse's job
const NEEDS_MUSE = /\b(can we|could we|should we|what if|how about|instead|move|change|switch|resched\w*|cancel|another|other|different|more|else|find|search|look for|suggest|recommend|idea|ideas|food|eat|drink|coffee|near|nearby|cheap\w*|budget|afford|cost|price|why|better|worth|bring|wear|weather)\b/;

export function routeAsk(text: string): Route | null {
  const t = text.toLowerCase().replace(/[’']/g, "'");
  if (NEEDS_MUSE.test(t)) return null;
  if (/\b(marketplace|listing|listings)\b/.test(t)) return "listings";
  if (/\b(finds|what (did )?(we|you) (find|found)|what we found|our stuff)\b/.test(t)) return "finds";
  if (/\bwho\b.*\b(going|coming|in|down|joining|there)\b|\bwho'?s\b|\bwho all\b/.test(t)) return "people";
  if (/\b(what time|when|what day|which day)\b/.test(t)) return "time";
  if (/\b(where|location|address|meeting spot|meet up spot)\b/.test(t)) return "place";
  if (/\b(recap|summary|summarize|remind me|what'?s the plan|what is the plan|plan again)\b/.test(t)) return "recap";
  if (/\b(event|pop-?up)\b/.test(t)) return "event";
  if (/\bgroup\b/.test(t)) return "group";
  return null;
}

type Use = { kind: string; id: string; title: string; sub: string };

const list = (names: string[]) => (names.length <= 1 ? (names[0] ?? "nobody yet") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

/** the answer and card for a routed question, built only from the confirmed plan */
export function answerRoute(route: Route, plan: { activity: string | null; when_text: string | null; where_text: string | null }, people: string[], uses: Use[]): { body: string; items: Use[] | null; planCard: boolean } {
  const event = uses.find((u) => u.kind === "event");
  const group = uses.find((u) => u.kind === "group");
  const listings = uses.filter((u) => u.kind === "listing");
  switch (route) {
    case "time":
      return { body: `${plan.when_text ?? "no time set yet"}, ${plan.where_text ?? "place to be decided"}.`, items: null, planCard: false };
    case "place":
      return { body: event ? `${plan.where_text}, at the ${event.title.toLowerCase()}.` : `${plan.where_text ?? "no place set yet"}.`, items: event ? [event] : null, planCard: false };
    case "people":
      return { body: `${list(people)} ${people.length === 1 ? "is" : "are"} in.`, items: null, planCard: false };
    case "recap":
      return { body: `${plan.activity}, ${plan.when_text}. ${plan.where_text}. ${list(people)} ${people.length === 1 ? "is" : "are"} in.`, items: null, planCard: true };
    case "finds":
      return uses.length > 0 ? { body: "here's what we found for this one.", items: uses, planCard: false } : { body: "nothing saved for this plan yet.", items: null, planCard: false };
    case "listings":
      return listings.length > 0 ? { body: listings.length === 1 ? "one marketplace find on this plan." : `${listings.length} marketplace finds on this plan.`, items: listings, planCard: false } : { body: "no marketplace finds on this plan yet.", items: null, planCard: false };
    case "event":
      return event ? { body: `it's built around the ${event.title.toLowerCase()}, ${event.sub.toLowerCase()}.`, items: [event], planCard: false } : { body: "this one isn't tied to a public event.", items: null, planCard: false };
    case "group":
      return group ? { body: `the group linked to this one is ${group.title}.`, items: [group], planCard: false } : { body: "no group linked to this plan.", items: null, planCard: false };
  }
}
