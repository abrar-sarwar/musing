import Foundation

// mock content for the facebook shell. everything here is invented. the people are
// the seeded users (by id) plus a few fictional extras for dating. images are bundled
// under mock/ (CC0 photos and illustrated avatars, see mock/CREDITS.md) and are
// referred to by path, e.g. "feed/lake.jpg".

// "Inés Castillo" -> "avatars/ines.png". seeded users are keyed by first name.
func avatarPath(_ name: String) -> String {
    let key = firstName(name).folding(options: .diacriticInsensitive, locale: nil).lowercased()
    return "avatars/\(key).png"
}

private let reelKeys = ["baking", "boardgames", "bookstores", "brunch", "climbing", "coffee", "concerts", "cooking", "cycling", "dimsum", "film", "gadgets", "hiking", "museums", "photography", "pickleball", "plants", "pottery", "ramen", "running", "sewing", "thrifting", "thrifting2", "vinyl"]
private let reelAlias = ["board games": "boardgames", "dim sum": "dimsum", "film photography": "film", "karaoke": "concerts", "yoga": "running", "smoothies": "plants", "anime": "film", "trivia": "boardgames", "beach": "photography", "wine": "cooking", "tea": "coffee", "journaling": "bookstores", "puzzles": "boardgames", "picnics": "photography"]

// a poster for a reel topic. every seeded topic resolves to some distinct-enough image.
func reelPoster(_ topic: String, variant: Int = 0) -> String {
    let k = reelAlias[topic] ?? topic.filter { !$0.isWhitespace }
    if k == "thrifting" && variant % 2 == 1 { return "reel/thrifting2.jpg" }
    if reelKeys.contains(k) { return "reel/\(k).jpg" }
    var h: UInt32 = 0
    for u in topic.utf16 { h = h &* 31 &+ UInt32(u) }
    return "reel/\(reelKeys[Int(h % UInt32(reelKeys.count))]).jpg"
}

enum Mock {
    // ---------- stories ----------
    static let storyMedia = ["maya": "latte", "alex": "vinyl", "jo": "tiles", "sam": "ramen", "priya": "beach", "dev": "trail", "noor": "books", "theo": "concert", "mina": "harbor", "kai": "track", "ravi": "night", "lena": "pottery"].mapValues { "story/\($0).jpg" }

    // ---------- feed ----------
    struct PostExtra { var image: String?; var ratio: CGFloat = 1; var context: String? }
    // media + facebook-style context for the seeded posts, keyed by author id
    static let postExtras: [String: PostExtra] = [
        "jo": PostExtra(image: "feed/tote.jpg", ratio: 1, context: "is with Alex Rivera"),
        "dev": PostExtra(image: "feed/climbing.jpg", ratio: 4 / 3),
        "mina": PostExtra(image: "feed/lake.jpg", ratio: 4 / 3, context: "is at the reservoir"),
        "priya": PostExtra(image: "feed/rooftop.jpg", ratio: 4 / 3, context: "is with Maya Okafor and 5 others"),
        "ravi": PostExtra(image: "feed/boardgame.jpg", ratio: 1),
    ]

    struct ExtraPost { let id: String; let authorId: String; let body: String; let hoursAgo: Double; var image: String?; var ratio: CGFloat = 1 }
    // a few more posts so the feed reads as populated. authors are seeded users.
    static let extraPosts = [
        ExtraPost(id: "x-sam", authorId: "sam", body: "Found the ramen spot. Broth so good I forgot to take the before photo.", hoursAgo: 3, image: "feed/ramen.jpg", ratio: 1),
        ExtraPost(id: "x-alex", authorId: "alex", body: "The rack outside the shop on 5th is unreal today. Someone stop me.", hoursAgo: 7, image: "feed/thrift.jpg", ratio: 4 / 5),
        ExtraPost(id: "x-ollie", authorId: "ollie", body: "Market haul. Cooking for eight, as usual. Four of you are invited.", hoursAgo: 11, image: "feed/market.jpg", ratio: 4 / 3),
        ExtraPost(id: "x-noor", authorId: "noor", body: "Rainy day, museum day. Dry day, vintage day. Today was both.", hoursAgo: 22),
        ExtraPost(id: "x-kai", authorId: "kai", body: "Run club was 7am and I was, technically, present.", hoursAgo: 29),
    ]

    // ---------- profile ----------
    struct Profile { let city: String; let school: String; let birthday: String; let cover: String }
    static let profiles = [
        "maya": Profile(city: "Atlanta, Georgia", school: "Peachtree State University", birthday: "March 10, 2004", cover: "cover/mountains.jpg"),
        "alex": Profile(city: "Decatur, Georgia", school: "Peachtree State University", birthday: "July 2, 2003", cover: "cover/city.jpg"),
        "jo": Profile(city: "Atlanta, Georgia", school: "Eastside College of Design", birthday: "November 19, 2003", cover: "cover/hills.jpg"),
        "sam": Profile(city: "Marietta, Georgia", school: "Peachtree State University", birthday: "January 27, 2004", cover: "cover/city.jpg"),
    ]
    static let defaultProfile = Profile(city: "Atlanta, Georgia", school: "Peachtree State University", birthday: "May 5, 2003", cover: "cover/hills.jpg")
    static let profilePhotos = ["feed/camera.jpg", "feed/thrift.jpg", "story/latte.jpg", "feed/lake.jpg", "feed/denim.jpg", "feed/market.jpg", "story/vinyl.jpg", "feed/ramen.jpg", "feed/rooftop.jpg"]

    // ---------- marketplace ----------
    struct Listing: Identifiable {
        let id: String; let title: String; let price: Int; var was: Int?; var nearby = false
        let category: String; let seller: String; let place: String; let about: String
        // set for a listing that came from the catalog rather than this file
        var condition: String? = nil
        var topic: String? = nil
        var fromCatalog = false
        var photo: String? = nil
        /// the bundled photo, if there is one. a catalog listing without one gets drawn art.
        var image: String? { fromCatalog ? photo : "market/\(id).jpg" }
    }
    static let listings = [
        Listing(id: "car", title: "1967 roadster, runs great", price: 6500, was: 7800, category: "Vehicles", seller: "dev", place: "Decatur, GA", about: "Garage kept. New tires last spring. Clean title, cash only."),
        Listing(id: "pc", title: "*NEW BUILD* RGB gaming PC", price: 560, nearby: true, category: "Electronics", seller: "ravi", place: "Atlanta, GA", about: "Built two months ago, barely used. Comes with the box for the case."),
        Listing(id: "denim", title: "90s denim jacket, size M", price: 25, category: "Clothing", seller: "alex", place: "Decatur, GA", about: "Worn in, no rips. Fits a little boxy."),
        Listing(id: "vase", title: "Vintage art glass vase", price: 40, was: 50, category: "Home", seller: "noor", place: "Atlanta, GA", about: "About 8 inches tall. No chips."),
        Listing(id: "mirror", title: "Chrome wall mirror", price: 85, category: "Home", seller: "lena", place: "Atlanta, GA", about: "Heavy. Bring a friend and a blanket."),
        Listing(id: "car2", title: "Silver coupe, low miles", price: 18900, category: "Vehicles", seller: "kai", place: "Marietta, GA", about: "One owner. Serviced on schedule."),
        Listing(id: "armchair", title: "Velvet armchair, mustard", price: 120, nearby: true, category: "Furniture", seller: "priya", place: "Atlanta, GA", about: "Moving, it has to go. Very comfortable, slightly dramatic."),
        Listing(id: "dunks", title: "High tops, size 10", price: 70, was: 95, category: "Clothing", seller: "theo", place: "Atlanta, GA", about: "Worn a handful of times. Comes with extra laces."),
        Listing(id: "sofa", title: "Tufted antique sofa", price: 300, was: 450, category: "Furniture", seller: "ollie", place: "Roswell, GA", about: "Reupholstered in 2022. Pickup only."),
        Listing(id: "guitar", title: "Acoustic guitar + strap", price: 150, category: "Hobbies", seller: "theo", place: "Atlanta, GA", about: "Holds a tune. I do not."),
        Listing(id: "turntable", title: "Turntable, new needle", price: 95, nearby: true, category: "Electronics", seller: "alex", place: "Decatur, GA", about: "Belt drive, plays 33 and 45. Dust cover included."),
        Listing(id: "bike", title: "City bike, 54cm", price: 180, category: "Hobbies", seller: "mina", place: "Atlanta, GA", about: "Tuned up this month. Lock not included."),
        Listing(id: "chore", title: "Indigo chore coat", price: 40, category: "Clothing", seller: "jo", place: "Atlanta, GA", about: "Thrifted, then tailored. Sleeves taken up an inch."),
        Listing(id: "laptop", title: "Gaming laptop, 16GB", price: 650, was: 800, category: "Electronics", seller: "ravi", place: "Atlanta, GA", about: "Charger included. Battery is fine, fan is loud."),
        Listing(id: "lamps", title: "Pair of bedside lamps", price: 30, category: "Home", seller: "lena", place: "Atlanta, GA", about: "Warm bulbs included."),
        Listing(id: "records", title: "Lot of 45s, 12 records", price: 12, nearby: true, category: "Hobbies", seller: "alex", place: "Decatur, GA", about: "Mixed bag. A few gems."),
        Listing(id: "runners", title: "Retro runners, size 9", price: 35, category: "Clothing", seller: "kai", place: "Atlanta, GA", about: "Clean soles."),
        Listing(id: "pc2", title: "Tower + keyboard combo", price: 420, category: "Electronics", seller: "dev", place: "Atlanta, GA", about: "Good starter setup."),
        Listing(id: "chair", title: "Red seat side chair", price: 45, category: "Furniture", seller: "noor", place: "Atlanta, GA", about: "Solid wood. One small scuff."),
        Listing(id: "vase2", title: "Red blown glass vase", price: 28, category: "Home", seller: "mina", place: "Atlanta, GA", about: "Catches the light."),
        Listing(id: "camera", title: "35mm film camera, tested", price: 110, category: "Electronics", seller: "mina", place: "Atlanta, GA", about: "Light meter works. Comes with a strap and one roll."),
        Listing(id: "boardgames", title: "Stack of 6 board games", price: 45, nearby: true, category: "Hobbies", seller: "ravi", place: "Atlanta, GA", about: "All pieces counted. Two are still in shrink wrap."),
    ]
    static let marketTabs = ["Sell", "Explore", "Local", "Jobs", "Services", "More"]
    struct Gig: Identifiable { let id: String; let title: String; let who: String; let pay: String }
    static let jobs = [
        Gig(id: "j1", title: "Weekend barista", who: "Corner Cup Coffee", pay: "$16/hr + tips"),
        Gig(id: "j2", title: "Thrift store sorter", who: "Second Spin Vintage", pay: "$15/hr"),
        Gig(id: "j3", title: "Campus tour guide", who: "Peachtree State University", pay: "$14/hr"),
    ]
    static let services = [
        Gig(id: "s1", title: "Tailoring and alterations", who: "jo", pay: "From $12"),
        Gig(id: "s2", title: "Bike tune ups", who: "mina", pay: "$35 flat"),
        Gig(id: "s3", title: "Film photo sessions", who: "maya", pay: "$60 per roll"),
    ]

    // ---------- dating (fictional profiles, local interactions only) ----------
    struct DatingProfile: Identifiable {
        let id: String; let name: String; let age: Int; let line: String; let tags: [String]
        var image: String { "dating/\(id).jpg" }
    }
    static let datingProfiles = [
        DatingProfile(id: "riley", name: "Riley", age: 22, line: "Will trade a playlist for your best taco spot.", tags: ["Explore", "Liked you"]),
        DatingProfile(id: "jordan", name: "Jordan", age: 23, line: "Looking for someone to be bad at bowling with.", tags: ["Explore", "Matches"]),
        DatingProfile(id: "casey", name: "Casey", age: 21, line: "Film camera, long walks, longer coffee orders.", tags: ["Explore", "Friendship"]),
        DatingProfile(id: "avery", name: "Avery", age: 24, line: "I will absolutely judge your bookshelf. Kindly.", tags: ["Explore", "Liked you"]),
        DatingProfile(id: "quinn", name: "Quinn", age: 22, line: "New in town. Show me the good thrift stores?", tags: ["Explore", "Friendship"]),
        DatingProfile(id: "skye", name: "Skye", age: 23, line: "Sunday farmers market regular. Bring a tote.", tags: ["Explore", "Matches"]),
    ]
    static let datingTabs = ["Liked you", "Friendship", "Matches", "Explore"]
    static let datingQuestions: [(emoji: String, q: String, a: String)] = [
        ("😍", "What's a good first message?", "Ask about something specific in their profile. One real question beats three compliments."),
        ("🎂", "Low-key first date ideas?", "Coffee and a walk, a flea market, or a bookstore where you each pick one for the other."),
        ("🧭", "How do I keep a chat going?", "Answer, then hand something back. End messages with something they can pick up."),
        ("🫶", "When should I suggest meeting?", "Once the chat feels easy. A short, specific plan is easier to say yes to."),
    ]

    // ---------- notifications (static mock rows; musing. rows come live from the api) ----------
    struct Part { let t: String; var b = false }
    struct Notification {
        let id: String; let from: String; let kind: String; let text: [Part]; let age: String; let unread: Bool
        let to: AppTab; var thumb: String?
    }
    static let notifications = [
        Notification(id: "n1", from: "alex", kind: "love", text: [Part(t: "Alex Rivera", b: true), Part(t: " and 3 others love your story. See it and view more stories.")], age: "1h", unread: true, to: .home),
        Notification(id: "n2", from: "jo", kind: "comment", text: [Part(t: "Jo Lindqvist", b: true), Part(t: " commented on your photo: \"okay this jacket though\"")], age: "2h", unread: true, to: .profile),
        Notification(id: "n3", from: "mina", kind: "post", text: [Part(t: "Mina Park", b: true), Part(t: " posted a photo you haven't seen.")], age: "9h", unread: true, to: .home, thumb: "feed/lake.jpg"),
        Notification(id: "n4", from: "ravi", kind: "market", text: [Part(t: "Ravi Pillai", b: true), Part(t: " listed "), Part(t: "*NEW BUILD* RGB gaming PC", b: true), Part(t: " near you for $560.")], age: "1d", unread: false, to: .marketplace, thumb: "market/pc.jpg"),
        Notification(id: "n5", from: "facebook", kind: "security", text: [Part(t: "This is a prototype. No real logins, accounts or Facebook data are used here.")], age: "1d", unread: false, to: .home),
        Notification(id: "n6", from: "priya", kind: "friend", text: [Part(t: "Priya Natarajan", b: true), Part(t: " invited you to "), Part(t: "Rooftop Birthday Hang", b: true), Part(t: ".")], age: "2d", unread: false, to: .home),
        Notification(id: "n7", from: "riley", kind: "dating", text: [Part(t: "Riley", b: true), Part(t: " liked you in Dating. Try sending a message and seeing where it goes.")], age: "4d", unread: false, to: .dating),
        Notification(id: "n8", from: "theo", kind: "post", text: [Part(t: "Theo Baptiste", b: true), Part(t: " made a post: \"Karaoke Tuesday is back. Who's singing?\"")], age: "6d", unread: false, to: .home),
    ]

    // ---------- reels ----------
    static let reelCaptions: [String: (headline: String, caption: String)] = [
        "thrifting": ("Thrift with me: $20 challenge", "$6 jacket. don't ask me where."),
        "vinyl": ("Crate digging, Sunday edition", "three records, zero regrets"),
        "coffee": ("The pour, in slow motion", "third cup, no regrets"),
        "sewing": ("Curtains to shirt in 60 seconds", "turned curtains into a shirt"),
        "baking": ("Sourdough, day 14", "it finally has ears"),
        "film": ("35mm, overcast, perfect", "one roll, one afternoon"),
        "ramen": ("Rating every bowl in town", "broth over everything"),
        "brunch": ("The hollandaise was a journey", "worth the 40 minute wait"),
        "climbing": ("Sent it. Legs disagree.", "V5 after three weeks"),
        "hiking": ("The view was worth the 5am", "trail was empty the whole way up"),
        "pottery": ("Wheel 1, me 0", "it was supposed to be a mug"),
        "running": ("Run club, 7am, sort of alive", "we ran. allegedly."),
        "pickleball": ("The dink is undefeated", "new paddle, same backhand"),
        "board games": ("This game ended a friendship", "rules explained twice"),
        "photography": ("Golden hour did the work", "no filter, i promise"),
        "plants": ("Repotted everything", "the pothos is thriving, at least"),
        "cooking": ("Dinner for eight, invited four", "market haul to plate"),
        "concerts": ("Front row, ears ringing", "they played the old stuff"),
        "bookstores": ("Left with six books", "came in for one"),
        "cycling": ("40k before breakfast", "legs are a rumor now"),
    ]
    // real clips for the demo. the files live in Resources/mock/reelvideo, which is not in
    // git (they are other creators' videos), so a build without them shows stills instead.
    struct VideoReel {
        let file: String
        let topic: String
        let creator: String
        let caption: String
        let pitch: String
        var url: URL? {
            guard let base = Bundle.main.resourcePath else { return nil }
            let path = "\(base)/mock/reelvideo/\(file).mp4"
            return FileManager.default.fileExists(atPath: path) ? URL(fileURLWithPath: path) : nil
        }
    }
    static let videoReels: [VideoReel] = [
        VideoReel(file: "thriftflip", topic: "thrifting", creator: "cherri.bb", caption: "thrift flip with me: an oversized shirt becomes a qipao-inspired top", pitch: "this could be us: a thrift flip day, find a shirt and remake it"),
        VideoReel(file: "cafeshoot", topic: "cafe photoshoots", creator: "ovng", caption: "when your client thinks differently", pitch: "this could be us: a cafe photoshoot, coffee and turns behind the camera"),
        VideoReel(file: "band", topic: "starting a band", creator: "cj.sendz", caption: "day 2 of starting a band. only up from here", pitch: "this could be us: starting a band, first jam session"),
        VideoReel(file: "vintagepopup", topic: "vintage popups", creator: "thriftshit.us", caption: "vintage and secondhand pop-up shop", pitch: "this could be us: hitting a vintage pop-up"),
    ]

    static func describeReel(_ topic: String) -> (headline: String, caption: String) {
        reelCaptions[topic] ?? ("\(topic.prefix(1).uppercased())\(topic.dropFirst()), but make it a weekend", "\(topic) again. no notes.")
    }
}
