import Foundation

// row types and api view models. keys arrive snake_case or camelCase; the decoder
// converts snake_case, so every property here is camelCase.

struct User: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let avatarSeed: String
    let bio: String?
    let interests: [String]
}

struct Person: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let avatarSeed: String
}

extension User {
    var person: Person { Person(id: id, name: name, avatarSeed: avatarSeed) }
}

struct Post: Decodable, Identifiable {
    let id: String
    let authorId: String
    let body: String
    let createdAt: String
}

struct ReelRow: Decodable {
    let userId: String
    let topic: String
    let user: User
}

struct FriendEdge: Decodable { let friendId: String }
struct TopicRow: Decodable { let topic: String }

struct Understood: Decodable {
    let activity: String
    let vibe: String?
    let timeHint: String?
    let reply: String
    let clarifyingQuestion: String?
}

struct MuseRow: Decodable, Identifiable {
    let id: String
    let rawText: String
    let understood: Understood?
    let createdAt: String
}

// one plan, shaped for one viewer. responses stay private until quorum:
// before "happening" nobody (starter included) sees who said yes or who passed.
struct PlanView: Decodable, Identifiable {
    struct Pick: Decodable { let user: Person; let reason: String? }
    struct Me: Decodable {
        let personalAsk: String?
        let status: String
        let counteroffer: String?
        let privateLimit: String?
    }
    let id: String
    let state: String // draft | proposing | happening | faded
    let version: Int
    let solving: Bool
    let museOn: Bool
    let role: String // starter | member
    let starter: Person
    let rawText: String?
    let activity: String?
    let when: String?
    let `where`: String?
    let pitch: String?
    let note: String?
    let quorum: Int
    let invited: Int
    let downCount: Int
    let picks: [Pick]?
    let going: [Person]?
    let me: Me?
    let threadId: String?
    let eventId: String?
    // what muse found for this plan: at most one public event, one group, two listings
    let opportunities: [Opportunity]?
    // signals: when the plan runs out if it is not real by then, and whether it already happened.
    // optional so an older server still decodes.
    let expiresAt: String?
    let completed: Bool?
    /// ideas for the "what if..." box that fit this plan
    let whatIfs: [String]?
    /// muse's picks the starter left off a draft, with muse's reason. starter, draft only
    let skipped: [Pick]?
}

/// a friend the starter could still add to a draft, within the signal's audience
struct AddablePerson: Decodable, Identifiable {
    let id: String
    let name: String
    let avatarSeed: String
    let interests: [String]
    var person: Person { Person(id: id, name: name, avatarSeed: avatarSeed) }
}
struct AddableList: Decodable { let people: [AddablePerson] }

/// one public event in the ranked events feed. friendCount is only ever 3 or more, never who.
struct EventPick: Decodable {
    let eventId: String
    let line: String?
    let friendCount: Int?
}
struct EventFeed: Decodable { let events: [EventPick] }

// one signal, shaped for one viewer. who is in is only ever a count.
struct SignalView: Decodable, Identifiable {
    let id: String
    let author: Person
    let text: String
    let createdAt: String
    let expiresAt: String?
    let audience: String // close | friends | mutual | muse (private, not a choice in the composer)
    let waitFor: Int
    let mine: Bool
    let planId: String?
    let planState: String?
    let inCount: Int
    let joined: Bool
}

// a catalog record a plan uses. fictional mock data, never anyone's private activity.
struct Opportunity: Decodable, Identifiable, Hashable {
    let kind: String // event | group | listing
    let id: String
    let title: String
    let sub: String
    let reason: String?
    let cover: String?
    /// the record's main topic key, for drawn cover art when there is no photo
    let topic: String?
}

struct PublicEvent: Decodable, Identifiable {
    let id: String
    let title: String
    let description: String
    let whenText: String
    /// sun..sat, the weekly slot. optional so an older server still decodes.
    let whenDay: String?
    let area: String
    let organizer: String
    let capacity: Int?
    let groupId: String?
    let cover: String?
    // the bigger catalog. optional so an older server still decodes.
    let tags: [String]?
    let category: String?
    let price: Int?
    let online: Bool?
    /// "Free" or "$12"
    var priceText: String { (price ?? 0) == 0 ? "Free" : "$\(price ?? 0)" }
}

struct GroupRow: Decodable, Identifiable {
    let id: String
    let name: String
    let description: String
    let area: String
    let cover: String?
    let memberCount: Int
    let activity: [String]
    let tags: [String]?
    let category: String?
    let visibility: String?
}

/// a marketplace listing from the fictional catalog. only available ones are sent.
struct CatalogListing: Decodable, Identifiable {
    let id: String
    let title: String
    let price: Int
    let category: String
    let place: String
    let tags: [String]
    let sellerId: String
    let description: String?
    let condition: String?
    let cover: String?
}

/// a fictional creator's reel. catalog content, not anyone's viewing history.
struct CatalogReel: Decodable, Identifiable {
    let id: String
    let topic: String
    let title: String
    let caption: String
    let creator: String
    let pitch: String
    let tags: [String]
    let poster: String?
}

struct Catalog: Decodable {
    let events: [PublicEvent]
    let groups: [GroupRow]
    let listings: [CatalogListing]?
    let reels: [CatalogReel]?
    let saved: [String] // "kind:id" for this person only
}

/// where a thought started when it didn't start in the composer
struct SignalContext: Equatable {
    let kind: String // listing | event | group | reel
    let id: String
    let title: String
}

struct Settings: Decodable {
    var museOn = true // false = plain poll mode, no muse calls
    var museReplay = false // true = serve last good muse responses, no live calls
    var postersOn = true // false = skip the invite poster image
}

struct MusingHome: Decodable {
    let settings: Settings
    let asks: [PlanView]
    let mine: [PlanView]
    let muses: [MuseRow]
    let signals: [SignalView]?
    let friendSignals: [SignalView]?
}

struct Suggestion: Decodable {
    let suggestion: String
    let why: String
}

struct Overlap: Decodable { let topic: String; let count: Int }
struct OverlapResponse: Decodable { let overlap: Overlap? }

struct ThreadRow: Decodable, Identifiable {
    let id: String
    let title: String
    let memberIds: [String]
}

// the finished plan, as a card in a messenger thread. payload comes from the create job.
struct PlanCard: Decodable {
    let type: String?
    let planId: String?
    let eventId: String?
    let title: String?
    let when: String?
    let `where`: String?
    let line: String?
    let found: [Found]?
    // a "finds" card lists catalog records. a "proposal" card points at a group vote.
    let items: [Found]?
    let proposalId: String?
    let summary: String?
    struct Found: Decodable, Hashable { let kind: String; let id: String; let title: String; let sub: String }
}

struct Message: Decodable, Identifiable, Equatable {
    let id: String
    let senderId: String? // nil = muse
    let kind: String // text | muse
    let body: String?
    let card: PlanCard?
    let clientId: String?
    let pending: Bool // muse is still writing
    let createdAt: String
    static func == (a: Message, b: Message) -> Bool { a.id == b.id && a.body == b.body && a.pending == b.pending }
}

struct ThreadSummary: Decodable, Identifiable {
    let id: String
    let title: String
    let memberIds: [String]
    let hasMuse: Bool
    let last: Message?
}
struct ThreadList: Decodable { let threads: [ThreadSummary] }

// a change to a confirmed plan. it happens only when everyone going agrees.
struct Proposal: Decodable, Identifiable {
    let id: String
    let summary: String
    let status: String // open | accepted | declined | expired
    let yes: Int
    let needed: Int
    let myVote: String?
    let canVote: Bool
}

struct ThreadDetail: Decodable {
    struct Info: Decodable {
        let id: String
        let title: String
        let planId: String?
        let members: [Person]
        let hasMuse: Bool // plan chats only. muse is a capability here, not an account
        let museMuted: Bool
    }
    let thread: Info
    let messages: [Message]
    let proposals: [Proposal]
}

struct SendResult: Decodable {
    let message: Message
    let wantsMuse: Bool
}

struct EventRow: Decodable, Identifiable {
    let id: String
    let planId: String?
    let title: String
    let description: String?
    let startsAt: String?
    let location: String?
    let posterUrl: String?
    let host: User
}

struct MuseTrace: Decodable, Identifiable {
    let id: Int
    let planId: String?
    let job: String
    let model: String
    let latencyMs: Int
    let ok: Bool
    let summary: String
}

struct PlanIdResponse: Decodable { let planId: String }
struct EventCreated: Decodable { let eventId: String }
