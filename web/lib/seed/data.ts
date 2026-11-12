// seed data. invented people only, no real names or photos.
// maya is the starter. alex, jo and sam are the friends muse should plausibly pick.

import type { FreeWindow } from "@/lib/types";

type SeedUser = {
  id: string;
  name: string;
  bio: string;
  interests: string[];
  free_windows: FreeWindow[];
  reels_opt_in: boolean;
  reels: Array<[topic: string, score: number]>;
};

const sat = (start: string, end: string): FreeWindow => ({ day: "sat", start, end });
const sun = (start: string, end: string): FreeWindow => ({ day: "sun", start, end });
const fri = (start: string, end: string): FreeWindow => ({ day: "fri", start, end });

export const USERS: SeedUser[] = [
  // ---- maya + her 12 friends ----
  {
    id: "maya",
    name: "Maya Okafor",
    bio: "film photos, thrift racks, iced coffee in november",
    interests: ["thrifting", "vintage", "coffee", "film photography", "farmers markets"],
    free_windows: [sat("11:00", "17:00"), sun("12:00", "18:00")],
    reels_opt_in: true,
    reels: [["thrifting", 9], ["film photography", 6], ["coffee", 4]],
  },
  {
    id: "alex",
    name: "Alex Rivera",
    bio: "vintage denim collector. will drive for a good flea.",
    interests: ["thrifting", "vintage denim", "record stores", "coffee"],
    free_windows: [sat("12:00", "18:00"), sun("10:00", "14:00")],
    reels_opt_in: true,
    reels: [["thrifting", 8], ["vinyl", 5], ["coffee", 3]],
  },
  {
    id: "jo",
    name: "Jo Lindqvist",
    bio: "sewing machine owner. turns $4 finds into fits.",
    interests: ["thrifting", "upcycling", "sewing", "bakeries"],
    free_windows: [sat("10:00", "16:00"), sun("13:00", "18:00")],
    reels_opt_in: true,
    reels: [["thrifting", 7], ["sewing", 6], ["baking", 2]],
  },
  {
    id: "sam",
    name: "Sam Achebe",
    bio: "flea markets, bad movies, good ramen",
    interests: ["thrifting", "flea markets", "film", "ramen"],
    free_windows: [sat("12:00", "19:00")],
    reels_opt_in: true,
    reels: [["thrifting", 6], ["film", 5], ["ramen", 3]],
  },
  {
    id: "priya",
    name: "Priya Natarajan",
    bio: "brunch is a personality",
    interests: ["thrifting", "brunch", "rooftop parties", "yoga"],
    free_windows: [sun("11:00", "15:00")],
    reels_opt_in: true,
    reels: [["thrifting", 4], ["brunch", 6], ["yoga", 3]],
  },
  {
    id: "dev",
    name: "Dev Malhotra",
    bio: "climbing, hiking, coffee, repeat",
    interests: ["climbing", "hiking", "coffee", "gadgets"],
    free_windows: [sat("08:00", "12:00"), sun("08:00", "12:00")],
    reels_opt_in: true,
    reels: [["climbing", 8], ["hiking", 5], ["gadgets", 4]],
  },
  {
    id: "noor",
    name: "Noor Haddad",
    bio: "museums on rainy days, vintage shops on dry ones",
    interests: ["vintage", "thrifting", "museums", "tea"],
    free_windows: [sat("13:00", "17:00")],
    reels_opt_in: false,
    reels: [["thrifting", 5], ["museums", 4]],
  },
  {
    id: "theo",
    name: "Theo Baptiste",
    bio: "karaoke tuesday is a lifestyle",
    interests: ["live music", "karaoke", "bars", "trivia"],
    free_windows: [fri("19:00", "23:00"), sat("19:00", "23:00")],
    reels_opt_in: true,
    reels: [["karaoke", 7], ["concerts", 6]],
  },
  {
    id: "lena",
    name: "Lena Moreau",
    bio: "pottery wheel, bookstore, tea. in that order.",
    interests: ["pottery", "bookstores", "tea", "journaling"],
    free_windows: [sun("10:00", "16:00")],
    reels_opt_in: false,
    reels: [["pottery", 6], ["bookstores", 4]],
  },
  {
    id: "kai",
    name: "Kai Tanaka",
    bio: "run club, pickleball, smoothie bowls",
    interests: ["running", "pickleball", "smoothies", "beach"],
    free_windows: [sat("07:00", "11:00"), sun("07:00", "11:00")],
    reels_opt_in: true,
    reels: [["running", 7], ["pickleball", 6]],
  },
  {
    id: "ravi",
    name: "Ravi Pillai",
    bio: "board game cafe regular. will explain the rules twice.",
    interests: ["board games", "dim sum", "anime", "puzzles"],
    free_windows: [sat("14:00", "22:00"), sun("14:00", "20:00")],
    reels_opt_in: true,
    reels: [["board games", 8], ["anime", 5]],
  },
  {
    id: "mina",
    name: "Mina Park",
    bio: "golden hour chaser",
    interests: ["photography", "hiking", "picnics", "plants"],
    free_windows: [sat("15:00", "19:00"), sun("09:00", "13:00")],
    reels_opt_in: true,
    reels: [["photography", 8], ["hiking", 4], ["plants", 3]],
  },
  {
    id: "ollie",
    name: "Ollie Brennan",
    bio: "cooks for eight, invites four",
    interests: ["cooking", "farmers markets", "wine", "cycling"],
    free_windows: [sun("09:00", "14:00")],
    reels_opt_in: false,
    reels: [["cooking", 7], ["cycling", 3]],
  },

  // ---- the rest of the network (not maya's friends) ----
  {
    id: "zara",
    name: "Zara Okonkwo",
    bio: "vinyl and vintage",
    interests: ["vinyl", "vintage", "coffee"],
    free_windows: [sat("12:00", "17:00")],
    reels_opt_in: true,
    reels: [["vinyl", 7], ["thrifting", 3]],
  },
  {
    id: "finn",
    name: "Finn Gallagher",
    bio: "sourdough and trail runs",
    interests: ["baking", "running", "hiking"],
    free_windows: [sun("08:00", "12:00")],
    reels_opt_in: true,
    reels: [["baking", 6], ["running", 4]],
  },
  {
    id: "hana",
    name: "Hana Sato",
    bio: "movie marathons",
    interests: ["film", "ramen", "anime"],
    free_windows: [sat("18:00", "23:00")],
    reels_opt_in: true,
    reels: [["film", 8], ["anime", 4]],
  },
  {
    id: "luca",
    name: "Luca Ferrari",
    bio: "espresso purist",
    interests: ["coffee", "climbing", "cycling"],
    free_windows: [sat("09:00", "13:00")],
    reels_opt_in: false,
    reels: [["coffee", 6], ["climbing", 5]],
  },
  {
    id: "ines",
    name: "Inés Castillo",
    bio: "brunch and yoga, sundays only",
    interests: ["brunch", "yoga", "beach"],
    free_windows: [sun("10:00", "14:00")],
    reels_opt_in: true,
    reels: [["yoga", 7], ["brunch", 5]],
  },
  {
    id: "tomas",
    name: "Tomás Herrera",
    bio: "trivia night champion, allegedly",
    interests: ["trivia", "bars", "live music"],
    free_windows: [fri("19:00", "23:00")],
    reels_opt_in: true,
    reels: [["concerts", 6], ["trivia", 5]],
  },
  {
    id: "aiko",
    name: "Aiko Nakamura",
    bio: "plants and film cameras",
    interests: ["plants", "film photography", "picnics"],
    free_windows: [sun("11:00", "16:00")],
    reels_opt_in: true,
    reels: [["plants", 7], ["photography", 5]],
  },
  {
    id: "bea",
    name: "Bea Santos",
    bio: "ceramics and crossword",
    interests: ["pottery", "puzzles", "tea"],
    free_windows: [sat("10:00", "14:00")],
    reels_opt_in: false,
    reels: [["pottery", 6]],
  },
  {
    id: "cyrus",
    name: "Cyrus Farahani",
    bio: "pickleball evangelist",
    interests: ["pickleball", "running", "smoothies"],
    free_windows: [sat("07:00", "10:00")],
    reels_opt_in: true,
    reels: [["pickleball", 8]],
  },
  {
    id: "dara",
    name: "Dara Nwosu",
    bio: "catan, but make it competitive",
    interests: ["board games", "dim sum", "puzzles"],
    free_windows: [sat("15:00", "21:00")],
    reels_opt_in: true,
    reels: [["board games", 7], ["dim sum", 3]],
  },
  {
    id: "eli",
    name: "Eli Rosenberg",
    bio: "farmers market at 7am, nap at 10",
    interests: ["cooking", "farmers markets", "wine"],
    free_windows: [sun("07:00", "11:00")],
    reels_opt_in: false,
    reels: [["cooking", 6]],
  },
  {
    id: "freya",
    name: "Freya Lindgren",
    bio: "museum member, tea drinker",
    interests: ["museums", "tea", "bookstores"],
    free_windows: [sat("12:00", "16:00")],
    reels_opt_in: true,
    reels: [["museums", 6], ["bookstores", 4]],
  },
];

// undirected edges. expanded to both directions on insert.
export const FRIEND_EDGES: Array<[string, string]> = [
  // maya's 12
  ["maya", "alex"], ["maya", "jo"], ["maya", "sam"], ["maya", "priya"],
  ["maya", "dev"], ["maya", "noor"], ["maya", "theo"], ["maya", "lena"],
  ["maya", "kai"], ["maya", "ravi"], ["maya", "mina"], ["maya", "ollie"],
  // among her friends
  ["alex", "jo"], ["alex", "sam"], ["jo", "sam"], ["priya", "jo"],
  ["dev", "kai"], ["theo", "ravi"], ["mina", "lena"], ["noor", "lena"],
  // out to the wider network
  ["alex", "zara"], ["zara", "finn"], ["jo", "finn"], ["sam", "hana"],
  ["dev", "luca"], ["priya", "ines"], ["theo", "tomas"], ["mina", "aiko"],
  ["lena", "bea"], ["kai", "cyrus"], ["ravi", "dara"], ["ollie", "eli"],
  ["noor", "freya"], ["hana", "aiko"], ["luca", "cyrus"], ["ines", "freya"],
  ["tomas", "dara"], ["bea", "eli"], ["finn", "cyrus"], ["zara", "hana"],
];

// stable ids so the ui can deep-link to seeded rows
export const THREAD_WEEKEND_CREW = "11111111-1111-4111-8111-111111111111";
export const EVENT_PRIYA_ROOFTOP = "22222222-2222-4222-8222-222222222222";

const daysAgo = (n: number, hour = 12) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const hoursAgo = (n: number) => new Date(Date.now() - n * 3600_000).toISOString();

// saturday after next, 7pm local
export function nextNextSaturday19(): string {
  const d = new Date();
  const toSat = (6 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + toSat + 7);
  d.setHours(19, 0, 0, 0);
  return d.toISOString();
}

export const PAST_MUSES = [
  { user_id: "maya", raw_text: "kinda wanna go thrifting this weekend but idk who'd be into it", created_at: daysAgo(10) },
  { user_id: "maya", raw_text: "ramen night would be fun", created_at: daysAgo(21) },
  { user_id: "maya", raw_text: "miss the farmers market, haven't been in forever", created_at: daysAgo(35) },
];

export const POSTS = [
  { author_id: "jo", body: "Turned a $4 thrift find into a tote bag. Zero waste, maximum smug.", created_at: hoursAgo(2) },
  { author_id: "dev", body: "Finally sent the V5 at the gym. Legs are jelly.", created_at: hoursAgo(5) },
  { author_id: "mina", body: "Golden hour at the reservoir yesterday. No filter, I promise.", created_at: hoursAgo(9) },
  { author_id: "priya", body: "Rooftop birthday thing Saturday the 21st. Come hang 🎈", created_at: hoursAgo(14) },
  { author_id: "ravi", body: "New board game cafe opened on 5th. 200 games. I counted.", created_at: hoursAgo(26) },
  { author_id: "theo", body: "Karaoke Tuesday is back. Who's singing?", created_at: hoursAgo(31) },
];

export const THREADS = [
  { id: THREAD_WEEKEND_CREW, title: "weekend crew", member_ids: ["maya", "alex", "jo", "sam"] },
];

export const MESSAGES = [
  { thread_id: THREAD_WEEKEND_CREW, sender_id: "alex", body: "anyone alive this weekend", created_at: hoursAgo(20) },
  { thread_id: THREAD_WEEKEND_CREW, sender_id: "jo", body: "barely. deadline week", created_at: hoursAgo(19) },
  { thread_id: THREAD_WEEKEND_CREW, sender_id: "sam", body: "I'm around sat", created_at: hoursAgo(18) },
  { thread_id: THREAD_WEEKEND_CREW, sender_id: "maya", body: "same", created_at: hoursAgo(17) },
];

export const EVENTS = [
  {
    id: EVENT_PRIYA_ROOFTOP,
    host_id: "priya",
    title: "Rooftop Birthday Hang",
    description: "Snacks, a speaker, and a view. Bring a layer, it gets windy up there.",
    starts_at: nextNextSaturday19(),
    location: "Priya's building, 14th floor",
  },
];

export const APP_SETTINGS = [
  { key: "muse_on", value: true },
  { key: "muse_replay", value: false },
  { key: "posters_on", value: true },
];

// demo characters, for the user switcher order
export const DEMO_ORDER = ["maya", "alex", "jo", "sam"];
