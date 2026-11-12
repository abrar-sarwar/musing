import type { ImageSource } from "expo-image";
import { COVER, DATING, FEED, MARKET, STORY } from "./media";

// mock content for the facebook shell. everything here is invented. the people are
// the seeded users (by id) plus a few fictional extras for dating.

// ---------- stories ----------
export const STORY_MEDIA: Record<string, ImageSource> = {
  maya: STORY.latte, alex: STORY.vinyl, jo: STORY.tiles, sam: STORY.ramen, priya: STORY.beach, dev: STORY.trail,
  noor: STORY.books, theo: STORY.concert, mina: STORY.harbor, kai: STORY.track, ravi: STORY.night, lena: STORY.pottery,
};

// ---------- feed ----------
// media + facebook-style context for the seeded posts, keyed by author id
export const POST_EXTRAS: Record<string, { image?: ImageSource; ratio?: number; context?: string; follow?: boolean }> = {
  jo: { image: FEED.tote, ratio: 1, context: "is with Alex Rivera" },
  dev: { image: FEED.climbing, ratio: 4 / 3 },
  mina: { image: FEED.lake, ratio: 4 / 3, context: "is at the reservoir" },
  priya: { image: FEED.rooftop, ratio: 4 / 3, context: "is with Maya Okafor and 5 others" },
  ravi: { image: FEED.boardgame, ratio: 1 },
  theo: {},
};

// a few more posts so the feed reads as populated. authors are seeded users.
export const EXTRA_POSTS: Array<{ id: string; author_id: string; body: string; hoursAgo: number; image?: ImageSource; ratio?: number; context?: string }> = [
  { id: "x-sam", author_id: "sam", body: "Found the ramen spot. Broth so good I forgot to take the before photo.", hoursAgo: 3, image: FEED.ramen, ratio: 1 },
  { id: "x-alex", author_id: "alex", body: "The rack outside the shop on 5th is unreal today. Someone stop me.", hoursAgo: 7, image: FEED.thrift, ratio: 4 / 5 },
  { id: "x-ollie", author_id: "ollie", body: "Market haul. Cooking for eight, as usual. Four of you are invited.", hoursAgo: 11, image: FEED.market, ratio: 4 / 3 },
  { id: "x-noor", author_id: "noor", body: "Rainy day, museum day. Dry day, vintage day. Today was both.", hoursAgo: 22 },
  { id: "x-kai", author_id: "kai", body: "Run club was 7am and I was, technically, present.", hoursAgo: 29 },
];

// ---------- profile ----------
export const PROFILE: Record<string, { city: string; school: string; birthday: string; cover: ImageSource }> = {
  maya: { city: "Atlanta, Georgia", school: "Peachtree State University", birthday: "March 10, 2004", cover: COVER.mountains },
  alex: { city: "Decatur, Georgia", school: "Peachtree State University", birthday: "July 2, 2003", cover: COVER.city },
  jo: { city: "Atlanta, Georgia", school: "Eastside College of Design", birthday: "November 19, 2003", cover: COVER.hills },
  sam: { city: "Marietta, Georgia", school: "Peachtree State University", birthday: "January 27, 2004", cover: COVER.city },
};
export const DEFAULT_PROFILE = { city: "Atlanta, Georgia", school: "Peachtree State University", birthday: "May 5, 2003", cover: COVER.hills };
export const PROFILE_PHOTOS: ImageSource[] = [FEED.camera, FEED.thrift, STORY.latte, FEED.lake, FEED.denim, FEED.market, STORY.vinyl, FEED.ramen, FEED.rooftop];

// ---------- marketplace ----------
export type Listing = { id: string; title: string; price: number; was?: number; image: ImageSource; nearby?: boolean; category: "Vehicles" | "Electronics" | "Clothing" | "Furniture" | "Home" | "Hobbies"; seller: string; place: string; about: string; kind?: "Local" | "Jobs" | "Services" };
export const LISTINGS: Listing[] = [
  { id: "car", title: "1967 roadster, runs great", price: 6500, was: 7800, image: MARKET.car, category: "Vehicles", seller: "dev", place: "Decatur, GA", about: "Garage kept. New tires last spring. Clean title, cash only." },
  { id: "pc", title: "*NEW BUILD* RGB gaming PC", price: 560, image: MARKET.pc, nearby: true, category: "Electronics", seller: "ravi", place: "Atlanta, GA", about: "Built two months ago, barely used. Comes with the box for the case." },
  { id: "denim", title: "90s denim jacket, size M", price: 25, image: MARKET.denim, category: "Clothing", seller: "alex", place: "Decatur, GA", about: "Worn in, no rips. Fits a little boxy." },
  { id: "vase", title: "Vintage art glass vase", price: 40, was: 50, image: MARKET.vase, category: "Home", seller: "noor", place: "Atlanta, GA", about: "About 8 inches tall. No chips." },
  { id: "mirror", title: "Chrome wall mirror", price: 85, image: MARKET.mirror, category: "Home", seller: "lena", place: "Atlanta, GA", about: "Heavy. Bring a friend and a blanket." },
  { id: "car2", title: "Silver coupe, low miles", price: 18900, image: MARKET.car2, category: "Vehicles", seller: "kai", place: "Marietta, GA", about: "One owner. Serviced on schedule." },
  { id: "armchair", title: "Velvet armchair, mustard", price: 120, image: MARKET.armchair, nearby: true, category: "Furniture", seller: "priya", place: "Atlanta, GA", about: "Moving, it has to go. Very comfortable, slightly dramatic." },
  { id: "dunks", title: "High tops, size 10", price: 70, was: 95, image: MARKET.dunks, category: "Clothing", seller: "theo", place: "Atlanta, GA", about: "Worn a handful of times. Comes with extra laces." },
  { id: "sofa", title: "Tufted antique sofa", price: 300, was: 450, image: MARKET.sofa, category: "Furniture", seller: "ollie", place: "Roswell, GA", about: "Reupholstered in 2022. Pickup only." },
  { id: "guitar", title: "Acoustic guitar + strap", price: 150, image: MARKET.guitar, category: "Hobbies", seller: "theo", place: "Atlanta, GA", about: "Holds a tune. I do not." },
  { id: "turntable", title: "Turntable, new needle", price: 95, image: MARKET.turntable, nearby: true, category: "Electronics", seller: "alex", place: "Decatur, GA", about: "Belt drive, plays 33 and 45. Dust cover included." },
  { id: "bike", title: "City bike, 54cm", price: 180, image: MARKET.bike, category: "Hobbies", seller: "mina", place: "Atlanta, GA", about: "Tuned up this month. Lock not included." },
  { id: "chore", title: "Indigo chore coat", price: 40, image: MARKET.chore, category: "Clothing", seller: "jo", place: "Atlanta, GA", about: "Thrifted, then tailored. Sleeves taken up an inch." },
  { id: "laptop", title: "Gaming laptop, 16GB", price: 650, was: 800, image: MARKET.laptop, category: "Electronics", seller: "ravi", place: "Atlanta, GA", about: "Charger included. Battery is fine, fan is loud." },
  { id: "lamps", title: "Pair of bedside lamps", price: 30, image: MARKET.lamps, category: "Home", seller: "lena", place: "Atlanta, GA", about: "Warm bulbs included." },
  { id: "records", title: "Lot of 45s, 12 records", price: 12, image: MARKET.records, nearby: true, category: "Hobbies", seller: "alex", place: "Decatur, GA", about: "Mixed bag. A few gems." },
  { id: "runners", title: "Retro runners, size 9", price: 35, image: MARKET.runners, category: "Clothing", seller: "kai", place: "Atlanta, GA", about: "Clean soles." },
  { id: "pc2", title: "Tower + keyboard combo", price: 420, image: MARKET.pc2, category: "Electronics", seller: "dev", place: "Atlanta, GA", about: "Good starter setup." },
  { id: "chair", title: "Red seat side chair", price: 45, image: MARKET.chair, category: "Furniture", seller: "noor", place: "Atlanta, GA", about: "Solid wood. One small scuff." },
  { id: "vase2", title: "Red blown glass vase", price: 28, image: MARKET.vase2, category: "Home", seller: "mina", place: "Atlanta, GA", about: "Catches the light." },
];
export const MARKET_TABS = ["Sell", "Explore", "Local", "Jobs", "Services", "More"] as const;
export const JOBS = [
  { id: "j1", title: "Weekend barista", who: "Corner Cup Coffee", pay: "$16/hr + tips" },
  { id: "j2", title: "Thrift store sorter", who: "Second Spin Vintage", pay: "$15/hr" },
  { id: "j3", title: "Campus tour guide", who: "Peachtree State University", pay: "$14/hr" },
];
export const SERVICES = [
  { id: "s1", title: "Tailoring and alterations", who: "jo", pay: "From $12" },
  { id: "s2", title: "Bike tune ups", who: "mina", pay: "$35 flat" },
  { id: "s3", title: "Film photo sessions", who: "maya", pay: "$60 per roll" },
];

// ---------- dating (fictional profiles, local interactions only) ----------
export type DatingProfile = { id: string; name: string; age: number; line: string; image: ImageSource; tags: Array<"Liked you" | "Friendship" | "Matches" | "Explore"> };
export const DATING_PROFILES: DatingProfile[] = [
  { id: "riley", name: "Riley", age: 22, line: "Will trade a playlist for your best taco spot.", image: DATING.riley, tags: ["Explore", "Liked you"] },
  { id: "jordan", name: "Jordan", age: 23, line: "Looking for someone to be bad at bowling with.", image: DATING.jordan, tags: ["Explore", "Matches"] },
  { id: "casey", name: "Casey", age: 21, line: "Film camera, long walks, longer coffee orders.", image: DATING.casey, tags: ["Explore", "Friendship"] },
  { id: "avery", name: "Avery", age: 24, line: "I will absolutely judge your bookshelf. Kindly.", image: DATING.avery, tags: ["Explore", "Liked you"] },
  { id: "quinn", name: "Quinn", age: 22, line: "New in town. Show me the good thrift stores?", image: DATING.quinn, tags: ["Explore", "Friendship"] },
  { id: "skye", name: "Skye", age: 23, line: "Sunday farmers market regular. Bring a tote.", image: DATING.skye, tags: ["Explore", "Matches"] },
];
export const DATING_TABS = ["Liked you", "Friendship", "Matches", "Explore"] as const;
export const DATING_QUESTIONS = [
  { emoji: "😍", q: "What's a good first message?", a: "Ask about something specific in their profile. One real question beats three compliments." },
  { emoji: "🎂", q: "Low-key first date ideas?", a: "Coffee and a walk, a flea market, or a bookstore where you each pick one for the other." },
  { emoji: "🧭", q: "How do I keep a chat going?", a: "Answer, then hand something back. End messages with something they can pick up." },
  { emoji: "🫶", q: "When should I suggest meeting?", a: "Once the chat feels easy. A short, specific plan is easier to say yes to." },
];

// ---------- notifications (static mock rows; musing. rows come live from the api) ----------
export type MockNotification = { id: string; from: string | "facebook"; kind: "love" | "post" | "comment" | "market" | "dating" | "security" | "friend"; text: Array<{ t: string; b?: boolean }>; age: string; unread: boolean; to: "/" | "/marketplace" | "/dating" | "/profile" | "/messages"; thumb?: ImageSource };
export const NOTIFICATIONS: MockNotification[] = [
  { id: "n1", from: "alex", kind: "love", text: [{ t: "Alex Rivera", b: true }, { t: " and 3 others love your story. See it and view more stories." }], age: "1h", unread: true, to: "/" },
  { id: "n2", from: "jo", kind: "comment", text: [{ t: "Jo Lindqvist", b: true }, { t: ' commented on your photo: "okay this jacket though"' }], age: "2h", unread: true, to: "/profile" },
  { id: "n3", from: "mina", kind: "post", text: [{ t: "Mina Park", b: true }, { t: " posted a photo you haven't seen." }], age: "9h", unread: true, to: "/", thumb: FEED.lake },
  { id: "n4", from: "ravi", kind: "market", text: [{ t: "Ravi Pillai", b: true }, { t: " listed " }, { t: "*NEW BUILD* RGB gaming PC", b: true }, { t: " near you for $560." }], age: "1d", unread: false, to: "/marketplace", thumb: MARKET.pc },
  { id: "n5", from: "facebook", kind: "security", text: [{ t: "This is a prototype. No real logins, accounts or Facebook data are used here." }], age: "1d", unread: false, to: "/" },
  { id: "n6", from: "priya", kind: "friend", text: [{ t: "Priya Natarajan", b: true }, { t: " invited you to " }, { t: "Rooftop Birthday Hang", b: true }, { t: "." }], age: "2d", unread: false, to: "/" },
  { id: "n7", from: "riley", kind: "dating", text: [{ t: "Riley", b: true }, { t: " liked you in Dating. Try sending a message and seeing where it goes." }], age: "4d", unread: false, to: "/dating" },
  { id: "n8", from: "theo", kind: "post", text: [{ t: "Theo Baptiste", b: true }, { t: ' made a post: "Karaoke Tuesday is back. Who\'s singing?"' }], age: "6d", unread: false, to: "/" },
];
