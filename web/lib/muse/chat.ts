import { z } from "zod";
import type { Group, Listing, PublicEvent } from "@/lib/discover";
import { DAYS, isTime } from "@/lib/when";
import { findLeak } from "./leak";
import { runStructured, type StructuredResult } from "./run";
import { VOICE } from "./voice";

// job 6, muse in the group chat. the plan is already real and the people in it are
// talking. muse answers when someone asks, from the shared plan and the catalog, and
// can put a change to the group. it never changes the plan itself.

export const ChatSchema = z.object({
  reply: z.string(),
  // catalog records to show under the reply as tappable cards. ids from the lists given.
  cards: z.array(z.object({ kind: z.enum(["event", "group", "listing"]), id: z.string() })),
  // a change for the group to vote on. "none" for almost every message.
  propose: z.enum(["none", "switch_event", "move_time"]),
  propose_event_id: z.string().nullable(),
  propose_day: z.enum(DAYS),
  propose_time: z.string(),
  propose_when_text: z.string(),
  propose_where_text: z.string(),
  propose_summary: z.string(),
});

export type ChatOut = z.infer<typeof ChatSchema>;

export type ChatInput = {
  planId: string;
  today: string;
  plan: { activity: string; when_day: string; when_time: string; when_text: string; where_text: string };
  /** the public event the plan is built on, if any. its day and time are its own. */
  fixedEvent: PublicEvent | null;
  goingFirstNames: string[];
  /** when every person going is free, per day. the only availability muse sees here. */
  sharedFree: string;
  /** what the plan already uses */
  uses: Array<{ kind: string; id: string; title: string; sub: string }>;
  /** what the backend found for this request. muse may only show or propose these. */
  found: { events: PublicEvent[]; groups: Group[]; listings: Listing[] };
  openProposal: string | null;
  recent: Array<{ who: string; text: string }>;
  asker: string;
  ask: string;
  /** checks whether a proposed day and time works for everyone going */
  worksForAll: (day: string, time: string) => boolean;
  /** private limits on this plan. never sent to the model. only used to reject a leak. */
  privateLimits: string[];
};

const SYSTEM = `you are muse, the quiet co-planner inside a small group chat. the plan is already happening and the friends in it are talking. someone just asked you something. answer that one thing, then get out of the way.

${VOICE}

how to answer:
- reply: one to three short sentences, under 260 characters. answer from the plan and the lists below. if you don't know, say so plainly.
- never invent an event, a group, a listing, a price, a time or a place. everything specific comes from what you were given.
- use first names only when it is natural, and only for people who are going.
- no real business names. for food or anything not in the lists, name a kind of place ("a noodle spot near the pop-up").
- cards: when they ask to see events, groups or listings, or you mention one, list those records (at most 4) so they show as cards. ids only from the lists. otherwise an empty list.
- "our finds", "the finds" or "what we found" means what the plan already uses: show exactly those. show other records only when they ask for more or for something else.

changing the plan:
- you never change the plan. the group does. you can put one change up for a vote.
- propose "none" unless someone clearly asks to change the day, the time or what the plan is built around.
- if the plan is built on a public event, that event's day and time cannot move. say so, then offer what is possible: keep it as is, switch to a different event from the list, or drop the event and do it as a normal outing at another time.
- propose "switch_event" only with an event id from the list. set propose_event_id. its day and time are its own.
- propose "move_time" for a different day or time without an event. set propose_day, propose_time ("HH:MM"), propose_when_text ("sunday around 2") and propose_where_text (a kind of place).
- only propose a time inside the shared free time below. if nothing in it fits the request, propose "none" and say that time does not work for everyone, without saying for whom.
- propose_summary: what the group votes on, under 90 characters ("switch to sunday's clothing swap at 1"). empty when propose is "none".
- if a vote is already open, propose "none" and point at it.
- when propose is "none", fill the other propose fields with the current plan's values.

what you never say:
- anything about anyone's budget, limits, reasons, or what someone told you privately.
- who was asked and didn't come, or who passed.
- one person's availability. "that works for everyone" or "that doesn't work for everyone" is all you say.`;

function userPrompt(i: ChatInput): string {
  const list = (rows: string[]) => (rows.length > 0 ? rows.join("\n") : "- none");
  return `today is ${i.today}.

the plan: ${i.plan.activity} | ${i.plan.when_text} (${i.plan.when_day} ${i.plan.when_time}) | ${i.plan.where_text}
${i.fixedEvent ? `built on a public event: ${i.fixedEvent.id} | ${i.fixedEvent.title} | ${i.fixedEvent.when_text} | ${i.fixedEvent.area}. its day and time are fixed.` : "not built on a public event. the group can move it."}
going: ${i.goingFirstNames.join(", ")}
shared free time (everyone going): ${i.sharedFree || "none listed"}
a vote that is already open: ${i.openProposal ?? "none"}

the plan uses:
${list(i.uses.map((u) => `- ${u.kind} ${u.id} | ${u.title} | ${u.sub}`))}

public events you may show or propose:
${list(i.found.events.map((e) => `- ${e.id} | ${e.title} | ${e.when_day} ${e.when_time} (${e.when_text}) | ${e.area} | ${e.description}`))}

groups you may show:
${list(i.found.groups.map((g) => `- ${g.id} | ${g.name} | ${g.area} | ${g.description}`))}

marketplace listings you may show:
${list(i.found.listings.map((l) => `- ${l.id} | ${l.title} | $${l.price} | ${l.place}${i.uses.some((u) => u.kind === "listing" && u.id === l.id) ? " | already in the plan" : ""}`))}

the chat so far:
${list(i.recent.map((m) => `${m.who}: ${m.text}`))}

${i.asker} just asked you: "${i.ask}"`;
}

export function chat(input: ChatInput, onText?: (delta: string) => void, onRestart?: () => void): Promise<StructuredResult<ChatOut>> {
  // everything already in the open: the plan, the lists and what people typed in the chat
  const publicBefore = userPrompt(input);
  return runStructured({
    job: "chat",
    schema: ChatSchema,
    schemaName: "chat_reply",
    system: SYSTEM,
    user: publicBefore,
    maxTokens: 1600,
    planId: input.planId,
    // a chat answer is about this exact moment. an old one must never stand in for it.
    noCache: true,
    check: (o) => {
      if (o.reply.trim().length === 0) return "empty reply";
      if (o.cards.length > 4) o.cards = o.cards.slice(0, 4);
      for (const c of o.cards) {
        const known = c.kind === "event" ? input.found.events.some((e) => e.id === c.id) : c.kind === "group" ? input.found.groups.some((g) => g.id === c.id) : input.found.listings.some((l) => l.id === c.id);
        if (!known) return `unknown ${c.kind} id "${c.id}"`;
      }
      if (o.propose !== "none" && input.openProposal) o.propose = "none";
      if (o.propose === "switch_event") {
        const ev = input.found.events.find((e) => e.id === o.propose_event_id);
        if (!ev) return `unknown event id "${o.propose_event_id}" in the proposal`;
        if (input.fixedEvent && ev.id === input.fixedEvent.id) return "the proposal is the event the plan already uses";
        if (!input.worksForAll(ev.when_day, ev.when_time)) return `"${ev.title}" is outside the shared free time. propose something inside it or propose none`;
      }
      if (o.propose === "move_time") {
        if (!isTime(o.propose_time)) return `bad propose_time "${o.propose_time}"`;
        if (!input.worksForAll(o.propose_day, o.propose_time)) return `${o.propose_day} ${o.propose_time} is outside the shared free time. propose a time inside it or propose none`;
        if (o.propose_day === input.plan.when_day && o.propose_time === input.plan.when_time && !input.fixedEvent) return "the proposal changes nothing";
      }
      if (o.propose !== "none" && o.propose_summary.trim().length === 0) return "a proposal needs a summary";
      // private limits were never in the prompt. this is the net in case one came through the chat context.
      const leak = findLeak([o.reply, o.propose_summary, o.propose_where_text].join(" "), input.privateLimits, publicBefore);
      if (leak) return `private limit leak ("${leak}")`;
      return null;
    },
    summarize: (o) => `asked "${input.ask.slice(0, 40)}" · ${o.cards.length} cards · proposal: ${o.propose}`,
    stream: onText ? { field: "reply", onText, onRestart } : undefined,
  });
}
