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
}

// space the floating tab bar needs at the bottom of every tab screen
let tabBarHeight: CGFloat = 58
let tabBarSpace: CGFloat = 96

// musing. ui copy. all lowercase. do not edit casing.
enum Copy {
    static let brand = "musing."
    static let composerPlaceholder = "what's the move?"
    static let pitchLead = "wait, hear me out..."
    static let down = "i'm down"
    static let whatIf = "what if..."
    static let privateLimit = "just between us"
    static let happening = "it's happening"
    static let runItBack = "run it back"
    static let sendIt = "send it"
    static let notThis = "not this"
    static let pass = "not this time"
    static let solving = "muse is reworking it"
    static let faded = "this one didn't land. nobody saw who passed."
    static let privateNote = "only muse sees this. it shapes the plan and is never repeated."
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
