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
}

struct Message: Decodable, Identifiable {
    let id: String
    let threadId: String
    let senderId: String? // nil = muse
    let body: String?
    let card: PlanCard?
    let createdAt: String
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
