import SwiftUI

// cover art for catalog records. a record with a bundled photo shows the photo. one
// without shows a drawn placeholder (a soft gradient and a symbol for its topic), so the
// bigger fictional catalog never shows a broken image or a photo of the wrong thing.

private let topicSymbols: [String: String] = [
    "thrifting": "hanger", "fashion": "tshirt.fill", "home": "lamp.desk.fill", "photography": "camera.fill", "film": "film.fill",
    "games": "dice.fill", "gaming": "gamecontroller.fill", "music": "guitars.fill", "running": "figure.run", "fitness": "figure.yoga",
    "sports": "sportscourt.fill", "basketball": "basketball.fill", "soccer": "soccerball", "volleyball": "volleyball.fill", "tennis": "tennis.racket",
    "pickleball": "figure.pickleball", "climbing": "figure.climbing", "skate": "figure.skating", "cycling": "bicycle", "outdoors": "tent.fill",
    "food": "fork.knife", "cooking": "frying.pan.fill", "coffee": "cup.and.saucer.fill", "art": "paintpalette.fill", "crafts": "scissors",
    "creators": "video.fill", "tech": "cpu.fill", "security": "lock.shield.fill", "study": "graduationcap.fill", "career": "briefcase.fill",
    "volunteering": "heart.fill", "books": "books.vertical.fill", "anime": "sparkles.tv.fill", "dance": "figure.dance", "pets": "pawprint.fill",
    "travel": "globe.americas.fill", "plants": "leaf.fill", "social": "person.3.fill", "cozy": "moon.stars.fill", "weekend": "calendar",
]
private let categorySymbols: [String: String] = [
    "clothing": "tshirt.fill", "electronics": "desktopcomputer", "furniture": "sofa.fill", "home": "lamp.desk.fill", "hobbies": "puzzlepiece.fill",
    "sports": "sportscourt.fill", "books": "books.vertical.fill", "vehicles": "car.fill",
]
// pairs of soft colors. a topic always gets the same pair.
private let artPalette: [(UInt32, UInt32)] = [
    (0xe8e3ff, 0xc9b8ff), (0xdff1ff, 0xa9d4ff), (0xffe9dc, 0xffc3a0), (0xe2f7ea, 0xa8e3bf), (0xfff3cf, 0xffd97a),
    (0xffe1ec, 0xffadc8), (0xe0f5f5, 0x9fdcdc), (0xeee7df, 0xd4c2ad),
]

private func artHash(_ s: String) -> Int {
    var h: UInt32 = 5381
    for u in s.utf16 { h = h &* 33 &+ UInt32(u) }
    return Int(h % 10007)
}

/// the symbol for a topic key or a marketplace category, checked to exist on this system
func artSymbol(_ topic: String?) -> String {
    let key = (topic ?? "").lowercased()
    let name = topicSymbols[key] ?? categorySymbols[key] ?? "sparkles"
    return UIImage(systemName: name) == nil ? "sparkles" : name
}

/// a bundled photo when `path` loads, otherwise a drawn placeholder for `topic`.
/// fills whatever frame it is given, like Pic.
struct CoverArt: View {
    let path: String?
    let topic: String?

    var body: some View {
        if let path, !path.isEmpty, MockImages.load(path) != nil {
            Pic(path: path)
        } else {
            let pair = artPalette[artHash(topic ?? "musing") % artPalette.count]
            GeometryReader { geo in
                let side = min(geo.size.width, geo.size.height)
                ZStack {
                    LinearGradient(colors: [Color(hex: pair.0), Color(hex: pair.1)], startPoint: .topLeading, endPoint: .bottomTrailing)
                    Image(systemName: artSymbol(topic))
                        .font(.system(size: max(14, side * 0.34), weight: .semibold))
                        .foregroundStyle(Color.white.opacity(0.92))
                        .shadow(color: .black.opacity(0.08), radius: 4, y: 2)
                }
            }
            .clipped()
            .accessibilityHidden(true)
        }
    }
}

// ---------- the catalog's listings and reels, shaped for the screens that already exist ----------

extension AppState {
    /// marketplace: the original listings (with their photos) first, then the rest of the
    /// fictional catalog. the server only sends listings that are still available.
    var listings: [Mock.Listing] {
        let known = Set(Mock.listings.map(\.id))
        let more = (catalog?.listings ?? []).filter { !known.contains($0.id) }.map { l in
            Mock.Listing(id: l.id, title: l.title, price: l.price, category: l.category, seller: l.sellerId, place: l.place,
                         about: l.description ?? "", condition: l.condition, topic: l.tags.first ?? l.category, fromCatalog: true, photo: l.cover)
        }
        return Mock.listings + more
    }
}

// an sf symbol by name, except "muse", which is the plush face. keeps sparkles out of anything that stands for muse.
struct Glyph: View {
    let name: String
    var size: CGFloat = 14
    var weight: Font.Weight = .regular

    var body: some View {
        if name == "muse" { MuseFace(expression: .awake, size: size * 1.9) }
        else { Image(systemName: name).font(.system(size: size, weight: weight)) }
    }
}
