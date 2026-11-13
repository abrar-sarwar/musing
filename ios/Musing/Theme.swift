import SwiftUI

extension Color {
    init(hex: UInt32, alpha: Double = 1) {
        self.init(.sRGB, red: Double((hex >> 16) & 0xff) / 255, green: Double((hex >> 8) & 0xff) / 255, blue: Double(hex & 0xff) / 255, opacity: alpha)
    }
}

// facebook mobile palette. light only.
enum FB {
    static let bg = Color.white
    static let bg2 = Color(hex: 0xf0f2f5)
    static let blue = Color(hex: 0x0866ff)
    static let blueSoft = Color(hex: 0xe7f3ff)
    static let text = Color(hex: 0x050505)
    static let muted = Color(hex: 0x65676b)
    static let divider = Color(hex: 0xced0d4)
    static let hover = Color(hex: 0xf2f2f2)
    static let input = Color(hex: 0xf0f2f5)
    static let button = Color(hex: 0xe4e6eb)
    static let green = Color(hex: 0x31a24c)
    static let red = Color(hex: 0xf3425f)
    static let badge = Color(hex: 0xe41e3f)
    static let band = Color(hex: 0xc9ccd1)
}

// musing. gets its own identity only inside musing. features: soft lavender to pink.
enum Muse {
    static let start = Color(hex: 0x8b5cf6)
    static let end = Color(hex: 0xec4899)
    static let soft = Color(hex: 0xf3eeff)
    static let softer = Color(hex: 0xfaf7ff)
    static let line = Color(hex: 0xe4d9ff)
    static let text = Color(hex: 0x6d28d9)
    static let dating = Color(hex: 0x6f3fd8)
    static let gradient = LinearGradient(colors: [start, end], startPoint: .topLeading, endPoint: .bottomTrailing)
    static let entryGradient = LinearGradient(colors: [FB.blue, start], startPoint: .leading, endPoint: .trailing)
    /// the faint blue to lavender wash behind a musing. card that leads somewhere
    static let wash = LinearGradient(colors: [Color(hex: 0xf1f6ff), Color(hex: 0xf7f2ff)], startPoint: .leading, endPoint: .trailing)
}

// one set of sizes for every musing. screen, so cards, titles and buttons match everywhere.
enum UI {
    static let margin: CGFloat = 16 // screen edge to content
    static let gap: CGFloat = 12 // between cards
    static let cardRadius: CGFloat = 14
    static let cardPad: CGFloat = 16
    static let buttonRadius: CGFloat = 12
    static let button: CGFloat = 40
    static let buttonBig: CGFloat = 48
    static let title = Font.system(size: 24, weight: .heavy) // one per screen
    static let section = Font.system(size: 19, weight: .bold) // "Your signals", "Matched friends"
    static let cardTitle = Font.system(size: 18, weight: .bold)
    static let body = Font.system(size: 15)
    static let meta = Font.system(size: 13)
    static let kicker = Font.system(size: 12, weight: .bold) // small caps line above a card title
}

// space the floating tab bar needs at the bottom of every tab screen
let tabBarHeight: CGFloat = 58
let tabBarSpace: CGFloat = 96

// musing. ui copy. one rule: titles, labels and buttons are sentence case, like the rest
// of the app. muse's own voice (its bubbles, the brand) stays lowercase.
enum Copy {
    static let brand = "musing."
    static let composerTitle = "What's the move?"
    static let composerSub = "Any spontaneous thoughts? Let's make it actually happen."
    static let composerPlaceholder = "lowkey wanna try a new food place..."
    static let pitchLead = "wait, hear me out..."
    static let down = "I'm in!"
    static let maybe = "Maybe"
    static let whatIf = "What if..."
    static let privateLimit = "Just between us"
    static let happening = "It's happening"
    static let runItBack = "Run it back"
    // the draft's own step: the signal is already out, this sends muse's private ask to each person picked
    static let sendIt = "Ask these friends"
    static let notThis = "Not this"
    static let pass = "Can't make it"
    static let solving = "muse is reworking it"
    static let faded = "This one didn't land. Nobody saw who passed."
    static let privateNote = "Only muse sees this. It shapes the plan and is never repeated."
}

// small stable hash for deterministic mock values (avatar colors, like counts).
// matches the javascript version: 32-bit wraparound over utf16 units.
func stableHash(_ s: String) -> Int {
    var h: Int32 = 0
    for u in s.utf16 { h = h &* 31 &+ Int32(truncatingIfNeeded: Int(u)) }
    return Int(h.magnitude)
}

func firstName(_ name: String) -> String {
    name.split(separator: " ").first.map(String.init) ?? name
}

func parseDate(_ iso: String?) -> Date? {
    guard var s = iso else { return nil }
    // postgres sends microseconds; drop the fraction so the plain iso parser accepts it
    if let dot = s.firstIndex(of: "."), let end = s[dot...].firstIndex(where: { $0 == "+" || $0 == "Z" || $0 == "-" }) {
        s.removeSubrange(dot..<end)
    }
    return ISO8601DateFormatter().date(from: s)
}

func timeAgo(_ iso: String) -> String {
    guard let d = parseDate(iso) else { return "" }
    return timeAgo(d)
}

func timeAgo(_ d: Date) -> String {
    let s = max(0, Int(Date().timeIntervalSince(d)))
    if s < 60 { return "Just now" }
    let m = s / 60
    if m < 60 { return "\(m)m" }
    let h = m / 60
    if h < 24 { return "\(h)h" }
    let days = h / 24
    if days < 7 { return "\(days)d" }
    return d.formatted(.dateTime.month(.abbreviated).day())
}

func money(_ n: Int) -> String {
    "$" + n.formatted(.number.locale(Locale(identifier: "en_US")))
}

func compactCount(_ n: Int) -> String {
    guard n >= 1000 else { return String(n) }
    return n >= 10000 ? "\(Int((Double(n) / 1000).rounded()))K" : String(format: "%.1fK", Double(n) / 1000)
}

/// "expires in 6d", "expires in 5h", "expired". nil when the signal has no end.
func expiresIn(_ iso: String?) -> String? {
    guard let d = parseDate(iso) else { return nil }
    let s = Int(d.timeIntervalSinceNow)
    if s <= 0 { return "expired" }
    if s < 3600 { return "expires in \(max(1, s / 60))m" }
    if s < 86400 { return "expires in \(s / 3600)h" }
    let days = Int((Double(s) / 86400).rounded())
    return days >= 14 ? "expires in \(days / 7)w" : "expires in \(days)d"
}

/// "saturday at 1" -> "Saturday at 1"
func sentenceCase(_ s: String) -> String {
    s.prefix(1).uppercased() + s.dropFirst()
}
