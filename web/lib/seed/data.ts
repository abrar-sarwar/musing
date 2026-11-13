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
    reels: [["thrifting", 9], ["film photography", 6], ["coffee", 4], ["vintage popups", 5]],
  },
  {
    id: "alex",
    name: "Alex Rivera",
    bio: "vintage denim collector. will drive for a good flea.",
    interests: ["thrifting", "vintage denim", "record stores", "coffee"],
    free_windows: [sat("12:00", "18:00"), sun("10:00", "14:00")],
    reels_opt_in: true,
    reels: [["thrifting", 8], ["vinyl", 5], ["coffee", 3], ["vintage popups", 6]],
  },
  {
    id: "jo",
    name: "Jo Lindqvist",
    bio: "sewing machine owner. turns $4 finds into fits.",
    interests: ["thrifting", "upcycling", "sewing", "bakeries"],
    free_windows: [sat("10:00", "16:00"), sun("13:00", "18:00")],
    reels_opt_in: true,
    reels: [["thrifting", 7], ["sewing", 6], ["baking", 2], ["vintage popups", 7]],
  },
  {
    id: "sam",
    name: "Sam Achebe",
    bio: "flea markets, bad movies, good ramen",
    interests: ["thrifting", "flea markets", "film", "ramen"],
    free_windows: [sat("12:00", "19:00")],
    reels_opt_in: true,
    reels: [["thrifting", 6], ["film", 5], ["ramen", 3], ["starting a band", 4]],
  },
  {
    id: "priya",
    name: "Priya Natarajan",
    bio: "brunch is a personality",
    interests: ["thrifting", "brunch", "rooftop parties", "yoga"],
    free_windows: [sun("11:00", "15:00")],
    reels_opt_in: true,
    reels: [["thrifting", 4], ["brunch", 6], ["yoga", 3], ["cafe photoshoots", 6]],
  },
  {
    id: "dev",
    name: "Dev Malhotra",
    bio: "climbing, hiking, coffee, repeat",
    interests: ["climbing", "hiking", "coffee", "gadgets"],
    free_windows: [sat("08:00", "12:00"), sun("08:00", "12:00")],
    reels_opt_in: true,
    reels: [["climbing", 8], ["hiking", 5], ["gadgets", 4], ["starting a band", 6]],
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
    reels: [["karaoke", 7], ["concerts", 6], ["starting a band", 8]],
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
    reels: [["running", 7], ["pickleball", 6], ["cafe photoshoots", 4]],
  },
  {
    id: "ravi",
    name: "Ravi Pillai",
    bio: "board game cafe regular. will explain the rules twice.",
    interests: ["board games", "dim sum", "anime", "puzzles"],
    free_windows: [sat("14:00", "22:00"), sun("14:00", "20:00")],
    reels_opt_in: true,
    reels: [["board games", 8], ["anime", 5], ["starting a band", 5]],
  },
  {
    id: "mina",
    name: "Mina Park",
    bio: "golden hour chaser",
    interests: ["photography", "hiking", "picnics", "plants"],
    free_windows: [sat("15:00", "19:00"), sun("09:00", "13:00")],
    reels_opt_in: true,
    reels: [["photography", 8], ["hiking", 4], ["plants", 3], ["cafe photoshoots", 8], ["vintage popups", 4]],
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

// ---------- discovery catalog (all fictional) ----------
// tags are topic keys from lib/discover.ts. events recur weekly on a day + time.

export const GROUPS = [
  { id: "atlanta-vintage-finds", name: "atlanta vintage finds", description: "Where the good racks are this week. Finds, tips and the occasional brag.", tags: ["thrifting"], area: "Atlanta", cover: "feed/thrift.jpg", member_count: 2140, activity: ["New rack out front of the shop on 5th today.", "Saturday pop-up has a whole denim wall this week."] },
  { id: "weekend-thrift-club", name: "weekend thrift club", description: "A small crew that hits two or three secondhand spots most Saturdays.", tags: ["thrifting"], area: "Decatur", cover: "feed/denim.jpg", member_count: 318, activity: ["Route for Saturday: pop-up first, then the swap.", "Found a $6 chore coat. It can be done."] },
  { id: "campus-photography-walks", name: "campus photography walks", description: "Slow walks with cameras. Film and digital, beginners welcome.", tags: ["photography"], area: "Midtown", cover: "feed/camera.jpg", member_count: 542, activity: ["Sunday walk starts at the reservoir gate.", "Bring one roll and finish it, that is the rule."] },
  { id: "local-board-game-nights", name: "local board game nights", description: "Heavy games, light games, and someone who explains the rules twice.", tags: ["games"], area: "Atlanta", cover: "feed/boardgame.jpg", member_count: 876, activity: ["Friday table is open at the cafe on 5th.", "Looking for a fourth for a co-op campaign."] },
  { id: "secondhand-furniture-swaps", name: "secondhand furniture swaps", description: "Give a chair, get a lamp. Room makeovers on almost no money.", tags: ["home"], area: "Atlanta", cover: "market/armchair.jpg", member_count: 1290, activity: ["Before and after: a $40 bedroom.", "Curb alert: bookshelf on the east side."] },
  { id: "atlanta-running-crew", name: "atlanta running crew", description: "Easy miles, three mornings a week. Nobody gets dropped.", tags: ["running"], area: "Atlanta", cover: "story/track.jpg", member_count: 1675, activity: ["Saturday long run, 8am, coffee after.", "New route through the park is open."] },
];

export const GROUP_MEMBERS: Array<[group: string, user: string]> = [
  ["atlanta-vintage-finds", "alex"], ["atlanta-vintage-finds", "jo"], ["weekend-thrift-club", "sam"], ["weekend-thrift-club", "alex"],
  ["campus-photography-walks", "mina"], ["local-board-game-nights", "ravi"], ["secondhand-furniture-swaps", "noor"], ["atlanta-running-crew", "kai"],
];

export const PUBLIC_EVENTS = [
  { id: "vintage-popup", title: "Saturday Vintage Pop-up", description: "Twenty sellers, racks of denim and jackets, and a dollar bin worth digging through.", when_day: "sat", when_time: "13:00", when_text: "saturday at 1", area: "Old Fourth Ward", tags: ["thrifting"], organizer: "Atlanta Vintage Finds", capacity: null, group_id: "atlanta-vintage-finds", cover: "feed/thrift.jpg" },
  { id: "clothing-swap", title: "Student Clothing Swap", description: "Bring five pieces, leave with five. Whatever is left goes to a shelter.", when_day: "sun", when_time: "13:00", when_text: "sunday at 1", area: "Peachtree State campus", tags: ["thrifting"], organizer: "Weekend Thrift Club", capacity: 60, group_id: "weekend-thrift-club", cover: "feed/denim.jpg" },
  { id: "record-fair", title: "Weekend Record Fair", description: "Crates from a dozen collectors. Mostly soul, jazz and 45s.", when_day: "sat", when_time: "12:00", when_text: "saturday at noon", area: "Little Five Points", tags: ["music", "thrifting"], organizer: "Spin Cycle Collective", capacity: null, group_id: null, cover: "story/vinyl.jpg" },
  { id: "photo-walk", title: "Reservoir Photography Walk", description: "An easy loop with plenty of stops. Any camera works, phones included.", when_day: "sun", when_time: "14:00", when_text: "sunday at 2", area: "the reservoir", tags: ["photography", "outdoors"], organizer: "Campus Photography Walks", capacity: 25, group_id: "campus-photography-walks", cover: "feed/lake.jpg" },
  { id: "board-game-cafe-night", title: "Board Game Cafe Night", description: "Open tables, 200 games, and staff who will teach you anything on the shelf.", when_day: "sat", when_time: "16:00", when_text: "saturday at 4", area: "5th Street", tags: ["games"], organizer: "Local Board Game Nights", capacity: 40, group_id: "local-board-game-nights", cover: "feed/boardgame.jpg" },
  { id: "makers-market", title: "Local Makers Market", description: "Ceramics, prints, plants and food stalls. Good for wandering with no plan.", when_day: "sat", when_time: "11:00", when_text: "saturday at 11", area: "the old rail yard", tags: ["weekend", "home", "food"], organizer: "Rail Yard Markets", capacity: null, group_id: null, cover: "feed/market.jpg" },
];

// same ids as the app's marketplace photos (ios/Musing/MockData.swift)
export const LISTINGS = [
  { id: "car", title: "1967 roadster, runs great", price: 6500, category: "Vehicles", place: "Decatur, GA", tags: [], seller_id: "dev" },
  { id: "pc", title: "*NEW BUILD* RGB gaming PC", price: 560, category: "Electronics", place: "Atlanta, GA", tags: [], seller_id: "ravi" },
  { id: "denim", title: "90s denim jacket, size M", price: 25, category: "Clothing", place: "Decatur, GA", tags: ["thrifting"], seller_id: "alex" },
  { id: "vase", title: "Vintage art glass vase", price: 40, category: "Home", place: "Atlanta, GA", tags: ["home", "thrifting"], seller_id: "noor" },
  { id: "mirror", title: "Chrome wall mirror", price: 85, category: "Home", place: "Atlanta, GA", tags: ["home"], seller_id: "lena" },
  { id: "car2", title: "Silver coupe, low miles", price: 18900, category: "Vehicles", place: "Marietta, GA", tags: [], seller_id: "kai" },
  { id: "armchair", title: "Velvet armchair, mustard", price: 120, category: "Furniture", place: "Atlanta, GA", tags: ["home"], seller_id: "priya" },
  { id: "dunks", title: "High tops, size 10", price: 70, category: "Clothing", place: "Atlanta, GA", tags: ["thrifting"], seller_id: "theo" },
  { id: "sofa", title: "Tufted antique sofa", price: 300, category: "Furniture", place: "Roswell, GA", tags: ["home"], seller_id: "ollie" },
  { id: "guitar", title: "Acoustic guitar + strap", price: 150, category: "Hobbies", place: "Atlanta, GA", tags: ["music"], seller_id: "theo" },
  { id: "turntable", title: "Turntable, new needle", price: 95, category: "Electronics", place: "Decatur, GA", tags: ["music"], seller_id: "alex" },
  { id: "bike", title: "City bike, 54cm", price: 180, category: "Hobbies", place: "Atlanta, GA", tags: ["outdoors"], seller_id: "mina" },
  { id: "chore", title: "Indigo chore coat", price: 40, category: "Clothing", place: "Atlanta, GA", tags: ["thrifting"], seller_id: "jo" },
  { id: "laptop", title: "Gaming laptop, 16GB", price: 650, category: "Electronics", place: "Atlanta, GA", tags: [], seller_id: "ravi" },
  { id: "lamps", title: "Pair of bedside lamps", price: 30, category: "Home", place: "Atlanta, GA", tags: ["home"], seller_id: "lena" },
  { id: "records", title: "Lot of 45s, 12 records", price: 12, category: "Hobbies", place: "Decatur, GA", tags: ["music"], seller_id: "alex" },
  { id: "runners", title: "Retro runners, size 9", price: 35, category: "Clothing", place: "Atlanta, GA", tags: ["running", "thrifting"], seller_id: "kai" },
  { id: "pc2", title: "Tower + keyboard combo", price: 420, category: "Electronics", place: "Atlanta, GA", tags: [], seller_id: "dev" },
  { id: "chair", title: "Red seat side chair", price: 45, category: "Furniture", place: "Atlanta, GA", tags: ["home"], seller_id: "noor" },
  { id: "vase2", title: "Red blown glass vase", price: 28, category: "Home", place: "Atlanta, GA", tags: ["home"], seller_id: "mina" },
  { id: "camera", title: "35mm film camera, tested", price: 110, category: "Electronics", place: "Atlanta, GA", tags: ["photography"], seller_id: "mina" },
  { id: "boardgames", title: "Stack of 6 board games", price: 45, category: "Hobbies", place: "Atlanta, GA", tags: ["games"], seller_id: "ravi" },
];
