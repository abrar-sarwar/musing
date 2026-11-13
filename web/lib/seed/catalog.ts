// the bigger discovery catalog: 55 public events, 45 groups, 80 marketplace listings and
// 20 reels, on top of the original rows in data.ts. every record is invented for this
// prototype. none of it is a real event, community, seller, listing or creator, and
// nothing here comes from facebook.
//
// tags are topic keys from lib/discover.ts (plus a few plain nouns that help a search,
// like "hiking" or "monitor"). events recur weekly on a day + time in atlanta's timezone,
// so they are always upcoming. ids are stable, and reset upserts by id.

const DAY_NAME: Record<string, string> = { sun: "sunday", mon: "monday", tue: "tuesday", wed: "wednesday", thu: "thursday", fri: "friday", sat: "saturday" };

// "13:00" -> "saturday at 1", "19:30" -> "friday at 7:30", "09:00" -> "sunday at 9am"
export function whenText(day: string, time: string): string {
  const [h = 12, m = 0] = time.split(":").map(Number);
  if (h === 12 && m === 0) return `${DAY_NAME[day]} at noon`;
  const hour = h % 12 || 12;
  return `${DAY_NAME[day]} at ${hour}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 11 ? "am" : ""}`;
}

// bundled photos that fit a topic. a record with no fitting photo has a null cover and
// the app draws a placeholder for it, so nothing ever shows a broken or misleading image.
const P = {
  thrift: "feed/thrift.jpg", denim: "feed/denim.jpg", tote: "feed/tote.jpg", camera: "feed/camera.jpg", lake: "feed/lake.jpg", board: "feed/boardgame.jpg",
  market: "feed/market.jpg", ramen: "feed/ramen.jpg", rooftop: "feed/rooftop.jpg", karaoke: "feed/karaoke.jpg", climb: "feed/climbing.jpg",
  concert: "story/concert.jpg", vinyl: "story/vinyl.jpg", latte: "story/latte.jpg", track: "story/track.jpg", trail: "story/trail.jpg", books: "story/books.jpg",
  pottery: "story/pottery.jpg", night: "story/night.jpg", harbor: "story/harbor.jpg", tiles: "story/tiles.jpg",
  rBaking: "reel/baking.jpg", rBoard: "reel/boardgames.jpg", rBooks: "reel/bookstores.jpg", rBrunch: "reel/brunch.jpg", rClimb: "reel/climbing.jpg", rCoffee: "reel/coffee.jpg",
  rConcert: "reel/concerts.jpg", rCooking: "reel/cooking.jpg", rCycling: "reel/cycling.jpg", rDimsum: "reel/dimsum.jpg", rFilm: "reel/film.jpg", rGadgets: "reel/gadgets.jpg",
  rHiking: "reel/hiking.jpg", rMuseums: "reel/museums.jpg", rPhoto: "reel/photography.jpg", rPickle: "reel/pickleball.jpg", rPlants: "reel/plants.jpg", rPottery: "reel/pottery.jpg",
  rRunning: "reel/running.jpg", rSewing: "reel/sewing.jpg", rThrift: "reel/thrifting.jpg", rThrift2: "reel/thrifting2.jpg", rVinyl: "reel/vinyl.jpg",
  city: "cover/city.jpg", hills: "cover/hills.jpg", mountains: "cover/mountains.jpg",
} as const;

// ---------- 45 groups ----------

type G = [id: string, name: string, category: string, area: string, members: number, tags: string[], description: string, activity: [string, string], cover: string | null, visibility?: "private"];
const G_ROWS: G[] = [
  // fashion and thrifting
  ["atl-sneaker-streetwear", "atl sneaker + streetwear", "Fashion", "Castleberry Hill", 3410, ["fashion", "thrifting", "sneakers"], "Pickups, restorations, legit checks and the occasional swap meet. Resellers welcome, bots are not.", ["Swap meet Sunday: bring pairs to trade, not just to flex.", "Before and after on a pair of beat-up high tops. Sole swap took a weekend."], null],
  ["student-budget-finds", "student budget finds", "Fashion", "Peachtree State campus", 5120, ["thrifting", "fashion", "home", "study", "budget"], "Where to get it for less: clothes, dorm stuff, textbooks. If it is under $20 and good, post it.", ["Closet cleanout swap this Sunday. Free to come, bring what you do not wear.", "The $1 rack moved to the back wall, in case anyone else walked past it twice."], P.tote],
  ["upcycle-sewing-circle", "upcycle + sewing circle", "Crafts", "Cabbagetown", 640, ["crafts", "thrifting", "fashion", "sewing"], "We fix, crop, patch and remake thrifted clothes. Machines to share, beginners get a seat first.", ["Turned two pillowcases into a top. Pattern is in the files.", "Anyone have a spare denim needle? Snapped my last one on a hem."], P.rSewing],
  // sports and fitness
  ["campus-pickup-basketball", "campus pickup basketball", "Sports", "Old Fourth Ward", 1890, ["basketball", "sports"], "Open runs on Saturday mornings and Sunday afternoons. Call your own fouls, sub in on losses, all levels.", ["Saturday run is on. We had 14 last week so games to 11.", "Need two more for Sunday. Who is hooping?"], null],
  ["atl-pickleball-socials", "atl pickleball socials", "Sports", "Grant Park", 2260, ["pickleball", "sports", "social"], "Paddles to borrow, round robins every weekend, and a rule that everyone plays with everyone.", ["Beginner social Saturday at noon. We teach the kitchen rule so you do not have to ask.", "Looking for a doubles partner who also cannot serve."], P.rPickle],
  ["weekend-soccer-pickup", "weekend soccer pickup", "Sports", "Kirkwood", 1420, ["soccer", "sports"], "Coed small-sided games on Sundays. Bring a light and a dark shirt and something to drink.", ["Sunday at 4, we have cones and two balls.", "Keeper gloves left at the field last week. I have them."], null],
  ["atl-volleyball-meetups", "atl volleyball meetups", "Sports", "Piedmont Park", 1730, ["volleyball", "sports", "social"], "Sand and grass doubles, sixes when enough people show. Rotating teams so nobody gets stuck.", ["Sand court is ours Saturday from 3. Bring sunscreen.", "Net is fixed. Thank you to whoever had zip ties."], null],
  ["beginner-runners-collective", "beginner runners collective", "Fitness", "Grant Park", 2980, ["running", "fitness"], "For people who say they are not runners. Walk breaks are part of the plan, not a failure.", ["Week 3: we ran for five whole minutes without stopping.", "What shoes is everyone using? Mine are from 2019 and it shows."], P.rRunning],
  ["sunday-yoga-flow", "sunday yoga in the park", "Fitness", "Piedmont Park", 3350, ["fitness", "outdoors", "yoga"], "A free hour of slow flow on the grass every Sunday morning. Bring a mat or a towel.", ["Meeting by the big oak again this week. It is supposed to be clear.", "Two spare mats in my trunk if anyone needs one."], null],
  ["atl-climbing-partners", "atl climbing partners", "Fitness", "Westside", 1560, ["climbing", "fitness", "sports"], "Find a belay partner, a bouldering crew or someone to split a day pass with.", ["Intro night Friday. Rental shoes are included.", "Finally sent the pink V4 in the corner. Skin is gone."], P.climb],
  ["o4w-skate-crew", "o4w skate crew", "Sports", "Old Fourth Ward", 870, ["skate", "sports", "outdoors"], "Beginners on Sunday afternoons, everyone else whenever the park is dry. Pads are not embarrassing.", ["Learn to skate is back Sunday at 1. We have four loaner boards.", "Landed my first ollie on flat. Took three months. Worth it."], null],
  ["atl-slow-roll", "atl slow roll", "Outdoors", "BeltLine Eastside Trail", 2040, ["cycling", "outdoors", "fitness"], "Casual group rides at talking pace. No spandex required, no one left behind.", ["Sunday loop is 9 miles with a snack stop.", "Free tire pump and patch help at the start, come early."], P.rCycling],
  // music, film, dance
  ["indie-music-lovers", "indie music lovers atl", "Music", "East Atlanta Village", 4480, ["music", "concert", "indie"], "Small rooms, local bands, and who is going to what this week. Spare tickets get posted here first.", ["Three local bands Friday for twelve bucks. Who is in?", "Listening party Sunday: we play a whole record, front to back, phones down."], P.concert],
  ["local-musicians-circle", "local musicians circle", "Music", "Decatur", 1970, ["music", "guitar", "jam", "social"], "Players at every level looking for people to play with. Jams, open mics and gear questions.", ["Beginner guitar jam Sunday. Three chords, loaner guitars, zero judgment.", "Bassist looking for a drummer who shows up on time."], P.rConcert],
  ["film-club-atl", "film club atl", "Film", "Midtown", 2150, ["film", "cozy", "movie"], "A double feature every Sunday and an outdoor movie when the weather lets us. We talk after, briefly.", ["This Sunday: two films under 90 minutes each. A gift.", "Outdoor movie Saturday. Bring a blanket and a strong opinion."], P.rFilm],
  ["salsa-bachata-social", "salsa + bachata social", "Dance", "Midtown", 2630, ["dance", "social", "salsa"], "A beginner lesson and then two hours of social dancing. You do not need a partner or rhythm yet.", ["Friday: basics at 7:30, social after. Wear shoes that slide.", "First time last week and nobody laughed. Coming back."], null],
  ["open-dance-sessions", "open dance sessions", "Dance", "Castleberry Hill", 1180, ["dance", "fitness", "hip hop"], "Open-level choreo and freestyle sessions. Film it or do not, your call.", ["New combo posted, eight counts of four.", "Mirror studio is free Thursday if anyone wants to drill."], null],
  // tech and gaming
  ["atl-ai-builders", "atl ai builders", "Technology", "Midtown", 6240, ["tech", "ai", "career"], "People building things with AI, from weekend projects to startups. Demos over slides.", ["Demo night Friday: five minutes each, working software only.", "Mini hackathon Saturday. Teams form at 11, first-timers get matched."], P.rGadgets],
  ["women-in-tech-atl", "women in tech atl", "Technology", "Midtown", 3890, ["tech", "career", "social"], "Mentorship, study groups and honest answers about internships, interviews and first jobs.", ["Mock interview pairs for this week are posted.", "Got the offer. Thank you to everyone who reviewed my portfolio."], null],
  ["campus-cyber-club", "campus cyber club", "Technology", "Peachtree State campus", 940, ["security", "tech", "study", "ctf"], "Capture the flag practice, lock picking and how not to get phished. No experience needed.", ["Beginner CTF workshop Saturday. Bring a laptop, we bring the challenges.", "Write-up from last week's web challenge is in the files."], null],
  ["code-newbies-atl", "code newbies atl", "Technology", "Online", 4310, ["tech", "study", "coding"], "Learning to code from zero, together. Weekly online session and a channel for stuck questions.", ["Learn to Code Sunday: this week is loops. Yes, again.", "Finished my first project, it is a tip calculator and I am proud."], null],
  ["gaming-night-squad", "gaming night squad", "Gaming", "Decatur", 3720, ["gaming", "social", "games"], "Couch co-op, brackets and people to queue with. Bring a controller if you have one.", ["Mario Kart night Saturday. Four setups, winner stays.", "Smash bracket Friday, 48 slots, casual pool for new players."], null],
  // food and coffee
  ["atl-foodies-cafe-hunters", "atl foodies + cafe hunters", "Food", "Atlanta", 8150, ["food", "coffee", "brunch"], "New spots, cheap eats and where the line is actually worth it. No sponsored posts.", ["Food Truck Friday lineup is posted. The birria truck is back.", "Big table brunch Sunday, sixteen seats, separate checks."], P.rBrunch],
  ["beginner-cooking-club", "beginner cooking club", "Food", "Decatur", 2470, ["cooking", "food"], "We cook one thing together each week and nobody is good at it yet. Knife skills welcome, not required.", ["Dumpling folding class Sunday. Ugly dumplings taste the same.", "Made the sheet pan chicken. Did not burn it. Growth."], P.rCooking],
  ["atl-coffee-crawl", "atl coffee crawl", "Food", "Inman Park", 2890, ["coffee", "cozy", "food"], "Three cafes in an afternoon, a beginner cupping now and then, and strong feelings about oat milk.", ["Cupping for beginners Saturday at 11. Twelve seats.", "Rate the new place on the corner: pour-over 9, chairs 3."], P.rCoffee],
  // creative
  ["atl-film-shooters", "atl film shooters", "Photography", "Downtown", 1640, ["photography", "film camera", "35mm"], "35mm and medium format people. Where to develop, what to shoot and cameras for sale that actually work.", ["Street photography basics Sunday, any camera.", "Got my first roll back. Eleven of 36 are in focus."], P.rPhoto],
  ["clay-club-atl", "clay club atl", "Crafts", "Westside", 1210, ["crafts", "art", "pottery", "cozy"], "Wheel throwing, hand building and many lopsided mugs. Studio time shares and intro classes.", ["Wheel intro Saturday, ten spots. Wear something you can ruin.", "It was supposed to be a bowl. It is a plate now."], P.pottery],
  ["sketchbook-club", "sketchbook club", "Art", "Old Fourth Ward", 1530, ["art", "cozy", "drawing"], "Draw together, quietly. Painting nights, sketch walks and a monthly table of shared supplies.", ["Painting night Friday. Canvases and paint are covered.", "Prompt of the week: your desk, exactly as it is."], P.rMuseums],
  ["makers-diy-collective", "makers + diy collective", "Crafts", "Little Five Points", 2380, ["crafts", "home", "diy", "art"], "Jewelry, candles, room decor, shelves that are almost level. Workshops and a tool library.", ["DIY jewelry workshop Sunday, all materials included.", "Peel-and-stick tiles on a rental kitchen: before and after."], P.tiles],
  ["young-creators-network", "young creators network", "Creators", "Midtown", 5560, ["creators", "photography", "career", "social"], "People who make videos, photos and posts, trading tips on editing, gear and getting paid.", ["Creator meetup Saturday. Bring a phone and one thing you are stuck on.", "What mic is everyone using for voiceovers under $50?"], null],
  ["writers-room-atl", "the writers room atl", "Books", "Inman Park", 760, ["books", "art", "cozy", "writing"], "Forty quiet minutes of writing, then anyone who wants to reads a page. Fiction, poems, whatever.", ["Meetup Sunday at 3. Bring a notebook or a laptop.", "Finished a first draft of a short story. It is bad and it exists."], P.rBooks],
  // community and learning
  ["volunteer-together-atl", "volunteer together atl", "Community", "Atlanta", 4920, ["volunteering", "outdoors", "social"], "One-off volunteer shifts you can do with friends. Cleanups, food pantries, shelter help.", ["BeltLine cleanup Saturday at 11. Gloves and bags provided.", "Pantry needs six people Tuesday evening to sort produce."], null],
  ["atl-dog-people", "atl dog people", "Pets", "West End", 6680, ["pets", "volunteering", "outdoors", "dog"], "Dog park meetups, shelter walking shifts and questions about why he eats socks.", ["Shelter dog walking Sunday at noon, twelve walkers needed.", "Small dog hour at the park moved to Saturday mornings."], null],
  ["book-lovers-collective", "book lovers collective", "Books", "Decatur", 3240, ["books", "cozy", "reading"], "A book club that picks short novels so people actually finish them. Swap shelf at every meeting.", ["This month is 180 pages. You can do 180 pages.", "Bringing a bag of paperbacks for the swap shelf Sunday."], P.books],
  ["language-exchange-club", "language exchange club", "Culture", "Midtown", 2710, ["travel", "social", "language", "culture"], "Half an hour in English, half an hour in the language you are learning. Spanish, Korean, French and more.", ["Saturday cafe meetup. Tables are labeled by language.", "Looking for a Portuguese partner, I can trade Spanish."], null],
  ["career-internship-network", "career + internship network", "Career", "Peachtree State campus", 7430, ["career", "study", "social", "networking"], "Internship leads, resume swaps and mixers where people actually talk to each other.", ["Student mixer Friday at 6. Name tags say what you are looking for.", "Three paid summer roles posted in the thread, all remote friendly."], P.city],
  ["campus-study-groups", "campus study groups", "Study", "Peachtree State campus", 3960, ["study", "cozy", "college"], "Find a study buddy by class or just someone to sit near so you stay off your phone.", ["Sunday study hall, quiet floor, 1 to 5. Snacks at the door.", "Anyone in stats 2 want to split the practice exam?"], P.rBooks],
  ["anime-manga-hangouts", "anime + manga hangouts", "Anime", "Decatur", 4170, ["anime", "film", "social", "cosplay"], "Watch parties, cosplay picnics and a manga swap box. Subs, dubs, we do not fight about it. Much.", ["Watch party Saturday at 6, first three episodes of the season.", "Cosplay picnic Saturday afternoon. Low effort costumes encouraged."], null],
  ["weekend-adventure-crew", "weekend adventure crew", "Outdoors", "Atlanta", 5830, ["outdoors", "hiking", "camping", "fitness"], "Day hikes, easy camping trips and stargazing drives. Carpools from the city, beginners first.", ["Waterfall hike Sunday. Three miles, flat, carpool leaves at 12:30.", "Camping 101 Saturday in the park: we set up a tent so you know how."], P.rHiking],
  ["plant-parents-atl", "plant parents atl", "Home", "Grant Park", 3080, ["plants", "home", "cozy"], "Cuttings to trade, diagnosis for sad leaves, and people who will water yours when you travel.", ["Free pothos cuttings on my porch until Sunday.", "Is this root rot or am I dramatic? Photos inside."], P.rPlants],
  ["museum-gallery-hoppers", "museum + gallery hoppers", "Art", "Midtown", 1880, ["art", "cozy", "museum"], "Free days, openings and a slow walk through one exhibit at a time. Talking optional.", ["Free admission this Sunday, meeting at the front steps at 1.", "The print show downtown closes this week. Go."], P.rMuseums],
  ["new-in-atl-socials", "new in atl socials", "Social", "Old Fourth Ward", 9240, ["social", "weekend", "food"], "For people who moved here and know four people. Small, easy hangs where showing up alone is normal.", ["Kickback Saturday at 4. Come by yourself, that is the point.", "Sixteen of us did the dessert crawl last week. Nobody was weird."], P.rooftop],
  ["dorm-room-refresh", "dorm room refresh", "Home", "Peachtree State campus", 2190, ["home", "study", "diy", "budget"], "Small rooms, small budgets. Setups, storage tricks and furniture that moves out when you do.", ["Under $60 desk setup, links in the comments.", "Selling a mini fridge and a futon before I move, both listed."], null],
  // private groups: only ever shown to a person who is a member
  ["peachtree-housing-board", "peachtree state housing board", "Study", "Peachtree State campus", 410, ["home", "study"], "Sublets, roommates and lease takeovers for current students. Members are approved by an admin.", ["Summer sublet near campus, one room, furnished.", "Looking for a roommate for August, quiet building."], null, "private"],
  ["atl-concert-ticket-swap", "atl concert ticket swap", "Music", "Atlanta", 1320, ["music", "concert"], "Face-value ticket trades between members. No markups, no strangers, admins check every post.", ["Two for Friday, cannot go. Face value.", "Looking for one ticket to the Saturday show."], null, "private"],
];

export const NEW_GROUPS = G_ROWS.map(([id, name, category, area, member_count, tags, description, activity, cover, visibility], i) => ({
  id, name, description, tags, area, cover, member_count, activity, category, visibility: visibility ?? "public", sort: 100 + i,
}));

// existing personas in the groups that match interests they already list. membership is
// private: the app never reads this table, and muse is never told who is in what.
export const NEW_GROUP_MEMBERS: Array<[group: string, user: string]> = [
  ["atl-sneaker-streetwear", "theo"], ["student-budget-finds", "jo"], ["upcycle-sewing-circle", "jo"], ["campus-pickup-basketball", "dev"], ["campus-pickup-basketball", "kai"],
  ["atl-pickleball-socials", "kai"], ["atl-pickleball-socials", "cyrus"], ["beginner-runners-collective", "finn"], ["sunday-yoga-flow", "priya"], ["sunday-yoga-flow", "ines"],
  ["atl-climbing-partners", "dev"], ["atl-climbing-partners", "luca"], ["atl-slow-roll", "ollie"], ["indie-music-lovers", "theo"], ["indie-music-lovers", "tomas"],
  ["local-musicians-circle", "theo"], ["film-club-atl", "sam"], ["film-club-atl", "hana"], ["salsa-bachata-social", "priya"], ["atl-ai-builders", "dev"],
  ["code-newbies-atl", "ravi"], ["gaming-night-squad", "ravi"], ["gaming-night-squad", "dara"], ["atl-foodies-cafe-hunters", "sam"], ["atl-foodies-cafe-hunters", "priya"],
  ["beginner-cooking-club", "ollie"], ["beginner-cooking-club", "eli"], ["atl-coffee-crawl", "maya"], ["atl-coffee-crawl", "luca"], ["atl-film-shooters", "maya"],
  ["atl-film-shooters", "mina"], ["atl-film-shooters", "aiko"], ["clay-club-atl", "lena"], ["clay-club-atl", "bea"], ["book-lovers-collective", "lena"],
  ["book-lovers-collective", "freya"], ["anime-manga-hangouts", "ravi"], ["anime-manga-hangouts", "hana"], ["weekend-adventure-crew", "dev"], ["weekend-adventure-crew", "mina"],
  ["plant-parents-atl", "mina"], ["plant-parents-atl", "aiko"], ["museum-gallery-hoppers", "noor"], ["museum-gallery-hoppers", "freya"], ["volunteer-together-atl", "lena"],
  ["peachtree-housing-board", "noor"], ["atl-concert-ticket-swap", "theo"],
];

// ---------- 55 public events ----------

type E = [id: string, title: string, day: string, time: string, end: string | null, area: string, price: number, capacity: number | null, group: string | null, organizer: string, category: string, tags: string[], description: string, cover: string | null, flag?: "online" | "cancelled"];
const E_ROWS: E[] = [
  // fashion and thrifting
  ["eav-thrift-crawl", "East Atlanta Thrift Crawl", "sat", "12:00", "15:00", "East Atlanta Village", 0, 30, "weekend-thrift-club", "Weekend Thrift Club", "Fashion", ["thrifting", "fashion", "weekend"], "Four secondhand shops in six blocks, on foot. We end at the taco window. Bring a tote and a budget you plan to ignore.", P.rThrift],
  ["streetwear-swap-meet", "Streetwear Swap Meet", "sun", "13:00", "16:00", "Castleberry Hill", 5, 80, "atl-sneaker-streetwear", "ATL Sneaker + Streetwear", "Fashion", ["fashion", "thrifting", "sneakers"], "Tables of sneakers, tees and jackets to trade or buy. Five dollars at the door, free if you bring three things to swap.", P.denim],
  ["sneaker-custom-workshop", "Sneaker Customization Workshop", "sat", "14:00", "16:30", "Westside", 35, 16, "atl-sneaker-streetwear", "ATL Sneaker + Streetwear", "Fashion", ["fashion", "crafts", "sneakers"], "Bring a pair you are bored of. Paint, prep and sealer are included, and someone who has ruined enough pairs to teach you.", null],
  ["closet-cleanout-swap", "Closet Cleanout Swap Party", "sun", "14:00", "16:00", "Inman Park", 0, 40, "student-budget-finds", "Student Budget Finds", "Fashion", ["thrifting", "fashion", "social", "budget", "weekend"], "Bring what you never wear and leave with what someone else never wore. Free, and leftovers get donated.", P.tote],
  // sports and fitness
  ["saturday-pickup-hoops", "Saturday Pickup Basketball", "sat", "11:00", "13:00", "Old Fourth Ward", 0, 20, "campus-pickup-basketball", "Campus Pickup Basketball", "Sports", ["basketball", "sports", "weekend"], "Open run on the outdoor courts. Games to 11, winners stay, everyone gets on. Bring water and a dark and a light shirt.", null],
  ["beginner-pickleball", "Beginner Pickleball Social", "sat", "12:00", "14:00", "Grant Park", 5, 24, "atl-pickleball-socials", "ATL Pickleball Socials", "Sports", ["pickleball", "sports", "social", "weekend"], "Never played? Good. Ten minutes of rules, then round robin doubles. Paddles and balls are provided.", P.rPickle],
  ["sunday-soccer", "Sunday Coed Pickup Soccer", "sun", "16:00", "18:00", "Kirkwood", 0, 22, "weekend-soccer-pickup", "Weekend Soccer Pickup", "Sports", ["soccer", "sports"], "Small-sided games on grass. Teams get mixed every twenty minutes so it stays friendly.", null],
  ["sand-volleyball", "Sand Volleyball Meetup", "sat", "15:00", "17:00", "Piedmont Park", 0, 24, "atl-volleyball-meetups", "ATL Volleyball Meetups", "Sports", ["volleyball", "sports", "social", "weekend"], "Rotating doubles and fours on the sand court. All levels, and nobody keeps score past the second game.", null],
  ["beltline-5k-social", "BeltLine 5K Social Run", "sat", "09:00", "10:00", "BeltLine Eastside Trail", 0, null, "atlanta-running-crew", "Atlanta Running Crew", "Fitness", ["running", "fitness", "outdoors"], "An easy three miles at talking pace, three pace groups, coffee after. Nobody gets dropped.", P.track],
  ["yoga-in-the-park", "Yoga in the Park", "sun", "10:00", "11:00", "Piedmont Park", 0, 50, "sunday-yoga-flow", "Sunday Yoga in the Park", "Fitness", ["fitness", "outdoors", "yoga", "cozy"], "A slow hour on the grass by the big oak. Free. Bring a mat or a towel and something warm for the end.", null],
  ["beginner-tennis", "Beginner Tennis Clinic", "sat", "13:00", "14:30", "Grant Park", 10, 12, null, "Court Time ATL", "Sports", ["tennis", "sports"], "Grips, forehands and a rally by the end. Loaner rackets if you ask ahead. Twelve people, two courts.", null],
  ["intro-bouldering", "Intro to Bouldering Night", "fri", "19:00", "21:00", "Westside", 18, 15, "atl-climbing-partners", "ATL Climbing Partners", "Fitness", ["climbing", "fitness", "sports"], "Shoes, chalk and a short lesson on falling well. Then two hours on the easy wall with people who remember being new.", P.climb],
  ["learn-to-skate", "Learn to Skate Sunday", "sun", "13:00", "15:00", "Old Fourth Ward", 0, 20, "o4w-skate-crew", "O4W Skate Crew", "Sports", ["skate", "sports", "outdoors"], "Pushing, turning and stopping on flat ground. Four loaner boards and spare pads. Falling is on the schedule.", null],
  ["slow-roll-ride", "Sunday Slow Roll", "sun", "15:00", "17:00", "BeltLine Eastside Trail", 0, 40, "atl-slow-roll", "ATL Slow Roll", "Outdoors", ["cycling", "outdoors", "fitness", "bike", "weekend"], "Nine flat miles at talking pace with a snack stop. Any bike works. Free pump and patch help at the start.", P.rCycling],
  // music, film, dance
  ["indie-night", "Indie Night: Three Local Bands", "fri", "20:00", "23:00", "East Atlanta Village", 12, 150, "indie-music-lovers", "Indie Music Lovers ATL", "Music", ["music", "concert", "weekend"], "Three local bands in a small room, twelve dollars at the door. First set at 8:30. Earplugs at the bar.", P.concert],
  ["open-mic", "Open Mic Night", "sat", "19:30", "22:00", "Little Five Points", 0, 60, "local-musicians-circle", "Local Musicians Circle", "Music", ["music", "open mic", "weekend"], "Sign up at the door for two songs or five minutes. Songs, poems, one very brave stand-up set per night.", P.rConcert],
  ["karaoke-night", "Throwback Karaoke Night", "sat", "20:00", null, "Edgewood", 0, null, null, "The Side Room", "Music", ["music", "karaoke", "social", "weekend"], "Two thousand songs, a patient host and a crowd that sings the chorus with you. Free to sing.", P.karaoke],
  ["listening-party", "Album Listening Party", "sun", "16:00", "18:00", "Little Five Points", 0, 35, "indie-music-lovers", "Indie Music Lovers ATL", "Music", ["music", "cozy", "vinyl", "weekend"], "One record, start to finish, phones away. Then we argue gently about track seven.", P.vinyl],
  ["beginner-guitar-jam", "Beginner Guitar Jam", "sun", "14:00", "16:00", "Decatur", 0, 20, "local-musicians-circle", "Local Musicians Circle", "Music", ["music", "guitar", "jam", "beginner"], "Three chords, one song, everybody plays. Loaner guitars for the first six people. No reading music required.", null],
  ["jazz-night", "Live Jazz on the Patio", "fri", "19:00", "21:30", "Inman Park", 8, 70, null, "Corner Quartet", "Music", ["music", "jazz", "cozy"], "A quartet, string lights and tables for four. Eight dollar cover, two sets, home by ten.", P.night],
  ["outdoor-movie-night", "Outdoor Movie Night", "sat", "19:30", null, "Old Fourth Ward", 0, null, "film-club-atl", "Film Club ATL", "Film", ["film", "weekend", "movie", "cozy"], "A big screen in the park and a movie everyone has half seen. Free. Bring a blanket and snacks to share.", P.rFilm],
  ["film-club-screening", "Film Club: Double Feature", "sun", "15:00", "18:30", "Midtown", 6, 45, "film-club-atl", "Film Club ATL", "Film", ["film", "cozy", "movie", "weekend"], "Two short films back to back, with a ten minute break and a short talk after. Six dollars covers the room.", P.rFilm],
  ["salsa-basics", "Salsa Basics + Social", "fri", "19:30", "22:00", "Midtown", 10, 60, "salsa-bachata-social", "Salsa + Bachata Social", "Dance", ["dance", "social", "salsa"], "A forty minute beginner lesson, then social dancing. Partners rotate, so come alone or with friends.", null],
  // technology and gaming
  ["weekend-hackathon", "Build Weekend Mini Hackathon", "sat", "11:00", "19:00", "Peachtree State campus", 0, 80, "atl-ai-builders", "ATL AI Builders", "Technology", ["tech", "ai", "career", "hackathon", "coding"], "Eight hours, teams of three, one working demo. First-timers get matched with a team at the door. Lunch is covered.", P.rGadgets],
  ["ai-builders-demo", "AI Builders Demo Night", "fri", "18:30", "20:30", "Midtown", 0, 100, "atl-ai-builders", "ATL AI Builders", "Technology", ["tech", "ai", "career", "social"], "Five minutes per demo and it has to run live. Good place to see what people are actually building.", P.city],
  ["ctf-workshop", "Beginner CTF Workshop", "sat", "13:00", "16:00", "Peachtree State campus", 0, 40, "campus-cyber-club", "Campus Cyber Club", "Technology", ["security", "tech", "ctf", "cybersecurity"], "Capture the flag for people who have never done one. Six starter challenges, hints on request, laptops required.", null],
  ["learn-to-code-sunday", "Learn to Code Sunday", "sun", "13:00", "15:00", "Online", 0, 100, "code-newbies-atl", "Code Newbies ATL", "Technology", ["tech", "study", "coding", "beginner"], "A live two hour session for total beginners, on video. This week: loops, and a tiny game by the end.", null, "online"],
  ["smash-bracket", "Smash Bracket Night", "fri", "19:00", "23:00", "Edgewood", 5, 48, "gaming-night-squad", "Gaming Night Squad", "Gaming", ["gaming", "tournament", "games"], "Forty-eight slots, double elimination, and a casual pool for people who just want to play. Bring a controller.", null],
  ["mario-kart-night", "Mario Kart Night", "sat", "18:00", "21:00", "Decatur", 0, 32, "gaming-night-squad", "Gaming Night Squad", "Gaming", ["gaming", "games", "social", "weekend"], "Four setups, winner stays, snacks on the table. Blue shells are legal and so is complaining.", null],
  ["board-game-sunday", "Sunday Board Game Meetup", "sun", "14:00", "18:00", "5th Street", 0, 40, "local-board-game-nights", "Local Board Game Nights", "Gaming", ["games", "cozy", "social", "weekend"], "Open tables all afternoon. Sit down at any game with an empty chair and someone will teach you.", P.rBoard],
  // food and coffee
  ["food-truck-friday", "Food Truck Friday", "fri", "18:00", "21:00", "Old Fourth Ward", 0, null, "atl-foodies-cafe-hunters", "ATL Foodies + Cafe Hunters", "Food", ["food", "weekend", "social"], "Twelve trucks, picnic tables and a playlist. Free to walk in, most plates are under twelve dollars.", P.ramen],
  ["dumpling-class", "Dumpling Folding Class", "sun", "13:00", "15:00", "Decatur", 28, 14, "beginner-cooking-club", "Beginner Cooking Club", "Food", ["cooking", "food", "class"], "Fold forty dumplings, eat most of them, take the rest home. Filling and wrappers are included.", P.rDimsum],
  ["coffee-cupping", "Coffee Cupping for Beginners", "sat", "11:00", "12:00", "Inman Park", 8, 12, "atl-coffee-crawl", "ATL Coffee Crawl", "Food", ["coffee", "cozy", "food"], "Taste five coffees side by side and learn what fruity actually means. Twelve seats at one long table.", P.latte],
  ["big-table-brunch", "Big Table Brunch Meetup", "sun", "12:00", "14:00", "Virginia-Highland", 20, 16, "atl-foodies-cafe-hunters", "ATL Foodies + Cafe Hunters", "Food", ["food", "brunch", "social", "weekend"], "One long table, sixteen seats, separate checks. About twenty dollars a person. Good for showing up alone.", P.rBrunch],
  ["dessert-crawl", "Decatur Dessert Crawl", "sat", "15:00", "17:00", "Decatur", 12, 20, "new-in-atl-socials", "New in ATL Socials", "Food", ["food", "dessert", "social", "weekend"], "Four stops on foot: a cookie, a scoop, a pastry and something fried. Roughly twelve dollars if you share.", P.rBaking],
  ["growers-market", "Saturday Growers Market", "sat", "11:00", "14:00", "Grant Park", 0, null, null, "Grant Park Growers", "Food", ["food", "cooking", "weekend", "outdoors", "market"], "Forty stalls of produce, bread, flowers and hot food. Free to wander. The peach stand sells out by one.", P.market],
  // creative
  ["golden-hour-photo-walk", "Golden Hour Photo Walk", "sat", "16:00", "18:00", "BeltLine Eastside Trail", 0, 25, "campus-photography-walks", "Campus Photography Walks", "Photography", ["photography", "outdoors", "weekend"], "A slow mile at the best light of the day. Phones, film and digital all welcome. We trade cameras at the halfway bench.", P.rPhoto],
  ["street-photo-basics", "Street Photography Basics", "sun", "13:00", "15:00", "Downtown", 10, 15, "atl-film-shooters", "ATL Film Shooters", "Photography", ["photography", "class", "beginner"], "How to see a frame, set exposure fast and take a picture of a stranger politely. Any camera, including your phone.", P.camera],
  ["pottery-wheel-intro", "Pottery Wheel Intro", "sat", "13:00", "15:00", "Westside", 40, 10, "clay-club-atl", "Clay Club ATL", "Crafts", ["crafts", "art", "pottery", "cozy"], "Two hours at the wheel with an instructor for every five people. You keep one piece, glazed and fired.", P.pottery],
  ["painting-night", "Painting Night", "fri", "19:00", "21:00", "Old Fourth Ward", 22, 20, "sketchbook-club", "Sketchbook Club", "Art", ["art", "cozy", "painting", "creative"], "A canvas, paint and a loose prompt. No step by step, nobody matches. Supplies are included.", P.rMuseums],
  ["diy-jewelry-workshop", "DIY Jewelry Workshop", "sun", "14:00", "16:00", "Little Five Points", 25, 12, "makers-diy-collective", "Makers + DIY Collective", "Crafts", ["crafts", "fashion", "jewelry", "diy"], "Make two pieces with wire, beads and proper pliers. Everything is provided and you leave wearing it.", null],
  ["creator-meetup", "Content Creator Meetup", "sat", "14:00", "16:00", "Midtown", 0, 50, "young-creators-network", "Young Creators Network", "Creators", ["creators", "photography", "career", "social"], "Short talks on editing and lighting, then an hour of filming each other's ideas. Bring a phone and a charger.", null],
  // community, learning and social
  ["beltline-cleanup", "BeltLine Volunteer Cleanup", "sat", "11:00", "13:00", "BeltLine Westside Trail", 0, 40, "volunteer-together-atl", "Volunteer Together ATL", "Community", ["volunteering", "outdoors", "social"], "Two hours, one mile of trail, gloves and bags provided. Come with friends or get put on a team.", P.trail],
  ["shelter-dog-walking", "Shelter Dog Walking Shift", "sun", "12:00", "14:00", "West End", 0, 12, "atl-dog-people", "ATL Dog People", "Pets", ["pets", "volunteering", "outdoors", "dog", "weekend"], "Walk a shelter dog for an hour with a short orientation first. Twelve walkers, closed-toe shoes, lots of fur.", null],
  ["book-club-short-novels", "Book Club: The Short Novel Edition", "sun", "16:00", "17:30", "Decatur", 0, 18, "book-lovers-collective", "Book Lovers Collective", "Books", ["books", "cozy", "reading", "weekend"], "This month is 180 pages. Come even if you did not finish. There is a swap shelf and tea.", P.books],
  ["language-exchange-cafe", "Language Exchange Cafe", "sat", "14:00", "16:00", "Midtown", 0, 40, "language-exchange-club", "Language Exchange Club", "Culture", ["travel", "social", "language", "culture"], "Tables by language. Thirty minutes in English, thirty in the one you are learning. Beginners sit anywhere.", P.rCoffee],
  ["student-mixer", "Student Networking Mixer", "fri", "18:00", "20:00", "Peachtree State campus", 0, 120, "career-internship-network", "Career + Internship Network", "Career", ["career", "social", "study", "networking"], "Name tags that say what you are looking for. Recruiters from six local companies, and free pizza.", P.city],
  ["sunday-study-hall", "Sunday Study Hall", "sun", "13:00", "17:00", "Peachtree State campus", 0, 30, "campus-study-groups", "Campus Study Groups", "Study", ["study", "cozy", "college"], "A quiet room, long tables and snacks at the door. Fifty minutes on, ten off, all afternoon.", P.rBooks],
  ["cosplay-picnic", "Cosplay Picnic + Photos", "sat", "13:00", "16:00", "Piedmont Park", 0, 60, "anime-manga-hangouts", "Anime + Manga Hangouts", "Anime", ["anime", "photography", "social", "cosplay"], "Come in costume or do not. Picnic blankets, a photo corner and a low-effort costume prize.", null],
  ["anime-watch-party", "Anime Watch Party", "sat", "18:00", "21:00", "Decatur", 0, 30, "anime-manga-hangouts", "Anime + Manga Hangouts", "Anime", ["anime", "film", "cozy", "weekend"], "First three episodes of a new season on a projector, voted on at the door. Snacks to share.", null],
  ["stargazing-night", "Stargazing Night", "sat", "20:00", "22:30", "Stone Mountain area, about 30 minutes east", 0, 40, "weekend-adventure-crew", "Weekend Adventure Crew", "Outdoors", ["outdoors", "cozy", "stargazing", "weekend"], "Two telescopes, a dark field and someone who can name what you are looking at. Carpools leave the city at 7:15.", P.mountains],
  ["waterfall-hike", "Beginner Waterfall Hike", "sun", "12:30", "16:00", "Sweetwater Creek, about 40 minutes west", 0, 20, "weekend-adventure-crew", "Weekend Adventure Crew", "Outdoors", ["outdoors", "hiking", "hike", "fitness", "weekend"], "Three flat miles to a waterfall and back, with a long snack stop. Carpool from the city. Regular sneakers are fine.", P.rHiking],
  ["camping-101", "Camping 101 + Gear Demo", "sat", "11:00", "13:00", "Piedmont Park", 0, 30, "weekend-adventure-crew", "Weekend Adventure Crew", "Outdoors", ["outdoors", "camping", "beginner"], "We pitch a tent, light a stove and pack a bag in the park so your first trip is not your first try. Free.", P.hills],
  ["new-in-town-kickback", "New in Town Kickback", "sat", "16:00", "18:00", "Old Fourth Ward", 0, 40, "new-in-atl-socials", "New in ATL Socials", "Social", ["social", "weekend", "food"], "A small, easy hang for people who moved here recently. Come alone, that is the point. Snacks and lawn games.", P.rooftop],
  // cancelled: stays in the table, never shown or recommended
  ["rooftop-sunset-yoga", "Rooftop Sunset Yoga", "sat", "18:00", "19:00", "Midtown", 15, 25, "sunday-yoga-flow", "Sunday Yoga in the Park", "Fitness", ["fitness", "yoga", "cozy"], "An hour of slow flow on a rooftop at sunset. This series is paused while the roof is repaired.", P.rooftop, "cancelled"],
];

export const NEW_PUBLIC_EVENTS = E_ROWS.map(([id, title, when_day, when_time, end_time, area, price, capacity, group_id, organizer, category, tags, description, cover, flag], i) => ({
  id, title, description, when_day, when_time, when_text: whenText(when_day, when_time), area, tags, organizer, capacity, group_id, cover,
  category, end_time, timezone: "America/New_York", price, online: flag === "online", status: flag === "cancelled" ? "cancelled" : "scheduled", sort: 100 + i,
}));

// ---------- 80 marketplace listings ----------

type L = [id: string, title: string, price: number, category: string, condition: "new" | "like new" | "good" | "fair", place: string, seller: string, tags: string[], description: string, status?: "sold" | "pending"];
const ATL = "Atlanta, GA";
const DEC = "Decatur, GA";
const L_ROWS: L[] = [
  // fashion
  ["vintage-leather-jacket", "Vintage leather jacket, size M", 65, "Clothing", "good", ATL, "alex", ["thrifting", "fashion", "jacket"], "Real leather, lined, a little cracked at the elbows in the good way. Zipper works."],
  ["straight-leg-jeans", "Vintage straight-leg jeans, 30x32", 22, "Clothing", "good", ATL, "jo", ["thrifting", "fashion", "jeans", "denim"], "High rise, no stretch. Hemmed once, so the length is true."],
  ["denim-bundle", "Denim bundle: 4 pairs, sizes 28 to 30", 30, "Clothing", "good", DEC, "jo", ["thrifting", "fashion", "denim", "jeans", "bundle"], "Two light wash, two dark. Good for cutting into shorts or patching. Selling together."],
  ["thrift-tee-bundle", "Thrift bundle: 8 tees + 2 flannels", 20, "Clothing", "good", ATL, "zara", ["thrifting", "fashion", "bundle", "budget"], "Mostly M and L. Washed and folded. Take the whole bag."],
  ["band-tee-lot", "Vintage band tees, lot of 3", 27, "Clothing", "fair", "Little Five Points, GA", "theo", ["thrifting", "fashion", "music", "tee"], "Soft, faded and a little cracked on the print. Sizes run small."],
  ["platform-boots", "Black platform boots, size 8", 45, "Clothing", "good", ATL, "priya", ["fashion", "shoes", "concert"], "Two inch platform, side zip. Scuffed toes that polish out."],
  ["white-low-tops", "White leather low-tops, size 9.5", 40, "Clothing", "like new", ATL, "theo", ["fashion", "sneakers", "shoes", "streetwear"], "Worn three times. No creasing, box included."],
  ["retro-high-top-sneakers", "Retro high-top basketball sneakers, size 11", 85, "Clothing", "good", "Castleberry Hill, GA", "dev", ["fashion", "sneakers", "basketball", "streetwear", "shoes"], "Red and white. Soles have plenty of life. Great on court or off."],
  ["patchwork-tote", "Hand-sewn patchwork tote", 15, "Clothing", "new", ATL, "jo", ["fashion", "thrifting", "accessories", "crafts", "tote"], "Made from denim scraps. Fits a laptop. Each one is a little different."],
  ["concert-fit-set", "Concert fit: mesh top + cargo skirt, S", 28, "Clothing", "like new", ATL, "priya", ["fashion", "concert", "outfit", "music"], "Wore it to one show. Comes as a set, pockets are real."],
  // gaming and electronics
  ["handheld-console-dock", "Handheld console + dock, 2 controllers", 190, "Electronics", "good", ATL, "ravi", ["gaming", "console", "games"], "Works docked and handheld. Light scratches on the back. Reset and ready."],
  ["last-gen-console", "Last-gen console, 500GB, 1 controller", 120, "Electronics", "good", DEC, "dara", ["gaming", "console", "games"], "Quiet fan, all cables included. Two games thrown in."],
  ["wireless-controller", "Wireless controller, barely used", 30, "Electronics", "like new", ATL, "ravi", ["gaming", "controller", "games"], "No stick drift. Charging cable included."],
  ["mechanical-keyboard", "Mechanical keyboard, brown switches", 45, "Electronics", "good", ATL, "dev", ["gaming", "tech", "keyboard", "coding", "study"], "75 percent layout, white backlight. Keycaps cleaned."],
  ["monitor-24", "24 inch 1080p monitor, 75Hz", 55, "Electronics", "good", ATL, "ravi", ["gaming", "tech", "monitor", "study", "home", "budget"], "No dead pixels. HDMI cable and stand included. Good second screen."],
  ["monitor-27-gaming", "27 inch 1440p 144Hz gaming monitor", 160, "Electronics", "like new", ATL, "dara", ["gaming", "tech", "monitor"], "Six months old. Height-adjustable stand, original box."],
  ["gaming-headset", "Gaming headset with mic", 25, "Electronics", "good", DEC, "hana", ["gaming", "headphones", "headset"], "Comfortable for long sessions. Mic flips up to mute."],
  ["studio-headphones", "Over-ear studio headphones", 60, "Electronics", "good", ATL, "theo", ["music", "tech", "headphones", "audio"], "Closed back, flat sound. New ear pads last month."],
  ["gaming-chair", "Gaming chair, black and red", 75, "Furniture", "good", ATL, "ravi", ["gaming", "home", "chair", "dorm"], "Reclines, armrests adjust. One small scuff on the base."],
  ["student-laptop", "Student laptop, 8GB RAM, new battery", 210, "Electronics", "good", ATL, "dev", ["tech", "study", "laptop", "coding", "budget"], "Fresh install. Fine for classes and learning to code. Battery replaced in spring."],
  // music
  ["beginner-acoustic-guitar", "Beginner acoustic guitar + gig bag", 60, "Hobbies", "good", DEC, "theo", ["music", "guitar", "beginner", "instrument", "budget"], "Full size, low action, easy on new fingers. New strings, tuner in the bag."],
  ["electric-guitar-sunburst", "Electric guitar, sunburst, new strings", 170, "Hobbies", "good", ATL, "tomas", ["music", "guitar", "instrument"], "Two pickups, stays in tune. A couple of dings on the back."],
  ["midi-keyboard-25", "25-key MIDI keyboard", 40, "Hobbies", "like new", ATL, "sam", ["music", "midi", "keyboard", "instrument"], "Eight pads, USB powered. Works with any music software."],
  ["keyboard-61-stand", "61-key keyboard + stand", 80, "Hobbies", "good", "Roswell, GA", "eli", ["music", "piano", "keyboard", "instrument", "beginner"], "Built-in speakers and a learn mode. Stand and sustain pedal included."],
  ["usb-microphone", "USB condenser microphone + boom arm", 45, "Electronics", "like new", ATL, "theo", ["music", "creators", "microphone", "audio"], "For vocals, podcasts and voiceovers. Pop filter included."],
  ["soprano-ukulele", "Soprano ukulele + clip tuner", 30, "Hobbies", "good", ATL, "lena", ["music", "ukulele", "instrument", "beginner"], "Warm sound, easy to learn on. Comes with a soft case."],
  ["vinyl-crate-30", "Crate of 30 LPs: soul, funk, indie", 50, "Hobbies", "good", "Little Five Points, GA", "zara", ["music", "vinyl", "record", "thrifting"], "All play through. A few sleeves are worn. No picking, whole crate."],
  ["bluetooth-speaker", "Portable bluetooth speaker", 28, "Electronics", "good", ATL, "kai", ["music", "speaker", "audio", "outdoors"], "Loud for its size, about ten hours a charge. Splash proof."],
  // photography and creative
  ["point-and-shoot-film", "Point-and-shoot film camera, flash works", 45, "Electronics", "good", ATL, "aiko", ["photography", "camera", "film camera", "35mm", "budget", "beginner"], "Auto everything, fits in a pocket. Tested with a roll last month."],
  ["beginner-dslr-kit", "Beginner DSLR + 18-55 lens + bag", 220, "Electronics", "good", ATL, "mina", ["photography", "camera", "dslr", "beginner"], "Low shutter count. Two batteries, charger and a 32GB card."],
  ["mirrorless-body", "Mirrorless camera body + 2 batteries", 480, "Electronics", "like new", "Marietta, GA", "aiko", ["photography", "camera", "creators"], "Body only. Great in low light, flip screen for video."],
  ["instant-camera", "Instant camera + 1 pack of film", 35, "Electronics", "like new", ATL, "priya", ["photography", "camera", "instant", "budget"], "Pastel blue. Ten shots included, good for parties and picnics."],
  ["manual-slr-film", "Manual SLR film camera + 50mm lens", 60, "Electronics", "good", ATL, "mina", ["photography", "camera", "film camera", "35mm"], "Fully manual, meter works. Sold last week.", "sold"],
  ["aluminum-tripod", "Aluminum tripod, 60 inch", 18, "Electronics", "good", ATL, "mina", ["photography", "tripod", "creators"], "Quick release plate, carry bag. Legs lock tight."],
  ["ring-light-18", "18 inch ring light + phone mount", 22, "Electronics", "good", ATL, "ines", ["photography", "creators", "lighting", "ring light"], "Three color temperatures, stand goes to six feet."],
  ["film-rolls-35mm", "5 rolls of 35mm color film, fresh", 32, "Hobbies", "new", ATL, "maya", ["photography", "35mm", "film camera", "film rolls"], "ISO 400, kept in the fridge. Bought too many."],
  ["drawing-tablet", "Drawing tablet with pen, medium", 38, "Electronics", "good", ATL, "bea", ["art", "tech", "drawing", "tablet"], "Battery-free pen, eight shortcut keys. Extra nibs included."],
  ["acrylic-paint-set", "Acrylic set: 24 tubes, brushes, 3 canvases", 16, "Hobbies", "new", ATL, "lena", ["art", "crafts", "paint", "supplies", "budget"], "Opened, never used. Enough to start tonight."],
  ["pottery-tool-kit", "Pottery tool kit + apron", 14, "Hobbies", "good", ATL, "bea", ["crafts", "art", "pottery", "tools"], "Eight wood and wire tools, a sponge and a canvas apron."],
  ["sewing-machine", "Sewing machine, just serviced", 70, "Hobbies", "good", ATL, "jo", ["crafts", "thrifting", "sewing", "fashion"], "Straight and zigzag, handles denim. Pedal, bobbins and manual included."],
  // sports and outdoors
  ["indoor-outdoor-basketball", "Indoor/outdoor basketball, size 7", 12, "Sports", "good", ATL, "dev", ["basketball", "sports", "ball"], "Good grip left, holds air. Used on outdoor courts one summer."],
  ["tennis-racket-balls", "Tennis racket + can of 3 balls", 20, "Sports", "good", ATL, "cyrus", ["tennis", "sports", "racket"], "Midsize head, fresh overgrip. Fine for a first season."],
  ["pickleball-paddle-set", "Pickleball paddle set: 2 paddles + 4 balls", 25, "Sports", "like new", ATL, "kai", ["pickleball", "sports", "paddle"], "Composite paddles, mesh bag. Played with them twice."],
  ["road-bike-56", "Road bike, 56cm, just tuned", 240, "Sports", "good", ATL, "ollie", ["cycling", "outdoors", "bike", "fitness"], "Aluminum frame, 18 speeds. New brake pads and bar tape."],
  ["single-speed-bike", "Single-speed city bike, 52cm", 130, "Sports", "good", DEC, "luca", ["cycling", "outdoors", "bike"], "Simple and light. Someone is coming to see it Saturday.", "pending"],
  ["helmet-u-lock", "Bike helmet + U-lock", 20, "Sports", "good", ATL, "luca", ["cycling", "outdoors", "bike", "helmet"], "Helmet is a medium, never crashed. Two keys for the lock."],
  ["two-person-tent", "Two-person tent, easy setup", 45, "Sports", "good", ATL, "dev", ["outdoors", "camping", "tent", "hiking"], "Used four nights. All stakes and the rain fly are there."],
  ["sleeping-bag-30", "Sleeping bag, rated to 30 degrees", 25, "Sports", "good", ATL, "finn", ["outdoors", "camping", "sleeping bag"], "Washed, packs into its sack. Fits up to six feet."],
  ["camp-stove-cook-set", "Camp stove + nesting cook set", 30, "Sports", "good", ATL, "dev", ["outdoors", "camping", "cooking", "stove"], "Single burner, boils fast. Pot, pan and two cups. Fuel not included."],
  ["complete-skateboard", "Complete skateboard, 8.0 deck", 40, "Sports", "good", "Old Fourth Ward, GA", "sam", ["skate", "sports", "skateboard", "outdoors"], "New grip tape, wheels roll smooth. Good first board."],
  ["hiking-daypack", "Hiking daypack, 24L + water bottle", 22, "Sports", "like new", ATL, "mina", ["outdoors", "hiking", "backpack", "camping"], "Chest strap, side pockets, rain cover in the bottom."],
  ["yoga-mat-set", "Yoga mat + 2 blocks + strap", 15, "Sports", "like new", ATL, "priya", ["fitness", "yoga", "mat", "budget"], "Thick mat, no slipping. Used for a month of classes."],
  ["outdoor-volleyball", "Outdoor volleyball, soft touch", 9, "Sports", "good", ATL, "kai", ["volleyball", "sports", "ball"], "Good for sand or grass. Does not sting your arms."],
  ["climbing-shoes-chalk", "Climbing shoes, size 9, + chalk bag", 35, "Sports", "good", ATL, "luca", ["climbing", "sports", "fitness", "shoes"], "Beginner-friendly flat fit. Some rubber left on the toe."],
  // home and lifestyle
  ["led-desk-lamp", "LED desk lamp, dimmable", 10, "Home", "like new", ATL, "lena", ["home", "study", "lamp", "desk", "dorm", "budget"], "Three color modes and a USB port in the base."],
  ["bookshelf-5-tier", "5-tier bookshelf, white", 35, "Furniture", "good", ATL, "freya", ["home", "books", "bookshelf", "dorm", "furniture"], "Sturdy, already assembled. Fits in a hatchback with the seats down."],
  ["pour-over-set", "Pour-over set: dripper, kettle, filters", 28, "Home", "good", ATL, "luca", ["coffee", "home", "pour over", "kitchen"], "Gooseneck kettle, glass dripper, half a pack of filters."],
  ["entry-espresso-machine", "Entry espresso machine + tamper", 110, "Home", "good", "Inman Park, GA", "luca", ["coffee", "home", "espresso", "kitchen"], "Pulls a real shot once you dial it in. Descaled last week."],
  ["writing-desk-40", "Writing desk, 40 inch, walnut finish", 50, "Furniture", "good", DEC, "noor", ["home", "study", "desk", "dorm", "furniture"], "One drawer, no wobble. Small ring mark on the left corner."],
  ["air-fryer-4qt", "Air fryer, 4 quart", 25, "Home", "good", ATL, "ollie", ["cooking", "home", "kitchen", "dorm"], "Works perfectly. Upgraded to a bigger one."],
  ["starter-cookware-set", "Starter cookware set, 8 pieces", 30, "Home", "like new", ATL, "eli", ["cooking", "home", "kitchen", "cookware", "beginner", "budget"], "Two pots, two pans, lids and two utensils. First-apartment kit."],
  ["strategy-board-games", "3 strategy board games, complete", 28, "Hobbies", "good", ATL, "ravi", ["games", "board game", "boardgame"], "A trading game, a tile game and a train game. All pieces counted."],
  ["woven-rug-5x7", "5x7 woven rug, cream and rust", 40, "Home", "good", ATL, "noor", ["home", "rug", "decor", "dorm"], "Flat weave, vacuumed and aired. Makes a room look finished."],
  ["potted-plant-pair", "Pothos + snake plant, potted", 14, "Home", "good", "Grant Park, GA", "aiko", ["plants", "home", "decor"], "Both hard to kill. Ceramic pots included."],
  ["room-decor-bundle", "Room decor bundle: string lights, prints, mirror", 18, "Home", "good", ATL, "priya", ["home", "decor", "dorm", "diy", "budget"], "Warm string lights, six art prints and a small round mirror."],
  // student and budget essentials
  ["calculus-textbook", "Calculus textbook, 9th edition", 25, "Books", "good", "Peachtree State campus, GA", "freya", ["study", "books", "textbook", "college"], "Some highlighting in the first four chapters. Access code not included."],
  ["programming-books", "Intro to programming + algorithms books", 30, "Books", "good", "Peachtree State campus, GA", "dev", ["study", "tech", "coding", "books", "textbook"], "Two books. The first one is what got me through intro CS."],
  ["security-study-guide", "Cybersecurity cert study guide + flashcards", 15, "Books", "good", "Peachtree State campus, GA", "dev", ["security", "study", "tech", "books", "cybersecurity"], "Current edition. Flashcards are handwritten and thorough."],
  ["graphing-calculator", "Graphing calculator + case", 40, "Electronics", "good", "Peachtree State campus, GA", "bea", ["study", "calculator", "college"], "Fresh batteries. Allowed on every exam I took."],
  ["laptop-backpack", "Laptop backpack, water resistant", 18, "Clothing", "good", ATL, "kai", ["study", "backpack", "college", "travel"], "Padded sleeve fits 15 inches. Lots of pockets."],
  ["mini-fridge", "Mini fridge, 3.2 cu ft", 55, "Home", "good", "Peachtree State campus, GA", "hana", ["home", "dorm", "study", "fridge"], "Cold, quiet, small freezer shelf. Moving out, has to go."],
  ["folding-futon", "Futon, folds flat, gray", 65, "Furniture", "good", "Peachtree State campus, GA", "hana", ["home", "dorm", "furniture", "futon"], "Couch by day, guest bed by night. Cover unzips to wash."],
  ["notebook-pen-haul", "Notebook + pen haul, unopened", 8, "Books", "new", ATL, "lena", ["study", "school supplies", "supplies", "budget", "books"], "Five dotted notebooks and a box of gel pens. Overbought."],
  ["paperback-bag", "Bag of 12 paperbacks: literary + fantasy", 10, "Books", "good", DEC, "freya", ["books", "reading", "novel", "budget"], "Good mix. A few with pencil notes in the margins."],
  ["manga-vol-1-10", "Manga volumes 1 to 10, one series", 35, "Books", "good", DEC, "hana", ["anime", "books", "manga"], "Read once, spines are clean. Selling as a set."],
  ["cosplay-wig-prop", "Cosplay wig + foam prop sword", 30, "Hobbies", "good", ATL, "ravi", ["anime", "cosplay", "crafts"], "Silver wig, heat safe. Sword is con-safe foam, four feet."],
  // pets and travel
  ["dog-crate-bowls", "Dog crate, medium + 2 bowls", 30, "Home", "good", "West End, GA", "finn", ["pets", "dog", "crate"], "Folds flat. He outgrew it in four months."],
  ["carry-on-suitcase", "Carry-on suitcase, hard shell", 35, "Home", "good", ATL, "ines", ["travel", "suitcase", "luggage"], "Four wheels, built-in lock. Fits overhead on every flight I took."],
  ["spanish-flashcards", "Spanish phrasebook + 500 flashcards", 6, "Books", "good", ATL, "ines", ["travel", "language", "study", "books", "budget"], "Beginner level. Got me through two weeks abroad."],
  // one more sold item: stays in the table, never shown or recommended
  ["handheld-console-lite", "Handheld console, lite model, yellow", 90, "Electronics", "good", ATL, "dara", ["gaming", "console"], "Sold, pending pickup was completed.", "sold"],
];

export const NEW_LISTINGS = L_ROWS.map(([id, title, price, category, condition, place, seller_id, tags, description, status], i) => ({
  id, title, price, category, place, tags, seller_id, description, condition, status: status ?? "available", cover: null as string | null, sort: 100 + i,
}));

// ---------- 20 reels ----------
// creator handles are invented. a reel only ever starts a thought when the person taps it.

type R = [id: string, topic: string, creator: string, title: string, caption: string, pitch: string, tags: string[], poster: string | null];
const R_ROWS: R[] = [
  ["outfit-transformation", "vintage outfit transformations", "second.act.fits", "Three thrifted pieces, five outfits", "the blazer was four dollars. the confidence was free.", "this could be us: a thrift day, then everyone styles one find", ["thrifting", "fashion"], P.rThrift2],
  ["thrift-haul", "thrift store finds", "rack.raccoon", "Everything I found for under $30", "the bins were kind today", "this could be us: digging through the bins with a $30 limit", ["thrifting", "fashion"], P.rThrift],
  ["hoops-highlights", "pickup basketball", "o4w.runs", "Saturday run, game point", "call your own fouls. he did not.", "this could be us: pickup basketball saturday morning", ["basketball", "sports"], null],
  ["guitar-three-chords", "beginner guitar chords", "three.chord.theo", "Three chords, forty songs", "g, c, d. that is the whole secret.", "this could be us: learning three chords and playing one song together", ["music"], P.rVinyl],
  ["coffee-crawl", "coffee shop hopping", "oat.milk.ollie", "Rating four cafes in one afternoon", "pour-over 9, chairs 3", "this could be us: a coffee crawl, three cafes, honest ratings", ["coffee", "food"], P.rCoffee],
  ["con-cosplay", "anime convention outfits", "foam.and.glue", "Con day: best costumes on the floor", "that armor is a yoga mat. respect.", "this could be us: a cosplay picnic, low effort costumes allowed", ["anime", "crafts"], null],
  ["dorm-setup", "affordable dorm setups", "tiny.room.big.plans", "My whole desk setup cost $58", "the lamp is doing most of the work", "this could be us: a secondhand hunt to redo a room on almost nothing", ["home", "study"], P.rGadgets],
  ["photo-tutorial", "photography tutorials", "f2.and.friends", "One setting that fixed my photos", "it was the light. it is always the light.", "this could be us: a photo walk at golden hour, any camera", ["photography"], P.rPhoto],
  ["hike-inspo", "weekend hiking", "trail.before.noon", "Three miles to a waterfall", "flat the whole way. i checked.", "this could be us: an easy waterfall hike this weekend", ["outdoors", "fitness"], P.rHiking],
  ["cooking-challenge", "ten dollar cooking challenge", "broke.and.braising", "Dinner for four on $10", "the onion did the heavy lifting", "this could be us: a ten dollar dinner cook-off", ["cooking", "food"], P.rCooking],
  ["setup-tour", "gaming setup tours", "couch.co.op", "Budget setup tour: all secondhand", "the monitor was fifty five dollars and i will not shut up about it", "this could be us: a game night, four controllers, winner stays", ["gaming", "tech"], null],
  ["pottery-class", "pottery class", "lopsided.mugs", "First time on the wheel", "it was a bowl. now it is a plate.", "this could be us: a pottery wheel class, lopsided mugs for all", ["crafts", "art"], P.rPottery],
  ["local-show", "local concerts", "small.rooms.atl", "Three bands, twelve dollars", "the opener was the best one. again.", "this could be us: a local show friday night", ["music"], P.rConcert],
  ["fitness-challenge", "group fitness challenge", "sore.together", "We ran every Saturday for a month", "week one was a walk. that counts.", "this could be us: an easy saturday run, coffee after", ["running", "fitness"], P.rRunning],
  ["street-photo", "street photography", "corner.light", "Downtown in 36 frames", "eleven are in focus. progress.", "this could be us: one roll each, downtown, compare after", ["photography", "art"], P.rFilm],
  ["volunteer-day", "volunteering", "two.hours.atl", "Two hours, one mile of trail", "fourteen bags. we counted.", "this could be us: a saturday cleanup shift, then lunch", ["volunteering", "outdoors"], null],
  ["book-recs", "book recommendations", "under.200.pages", "Five short novels you will actually finish", "all under 200 pages. you are welcome.", "this could be us: a tiny book club, one short novel", ["books", "cozy"], P.rBooks],
  ["dance-challenge", "dance challenge", "eight.counts", "Learn this combo in 30 seconds", "back row is always available", "this could be us: a beginner dance class, back row together", ["dance", "fitness"], null],
  ["diy-room", "diy room decor", "peel.and.stick", "Rental-friendly room refresh", "nothing here needs a drill", "this could be us: a diy afternoon, one room, no drills", ["home", "crafts"], P.rPlants],
  ["game-night", "board game night", "rules.explained.twice", "The game that ended a friendship", "we are fine now. mostly.", "this could be us: a board game night, snacks, no grudges", ["games", "social"], P.rBoard],
];

export const NEW_REELS = R_ROWS.map(([id, topic, creator, title, caption, pitch, tags, poster], i) => ({ id, topic, title, caption, creator, pitch, tags, poster, sort: 100 + i }));
