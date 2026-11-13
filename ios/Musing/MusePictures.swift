import SwiftUI

// the muse plush pictures for a build that does not have them bundled (they are not in git).
// asked for once from the server after sign-in, saved in the caches folder, and kept: later
// launches read the saved files and make no request. a face on screen redraws when they land.
@MainActor
final class MusePictures: ObservableObject {
    static let shared = MusePictures()
    static let names = ["awake", "asleep", "blink", "thinking", "hype", "serious", "sad"]

    @Published private(set) var images: [String: UIImage] = [:]
    private var asking = false

    private struct Links: Decodable { let pictures: [String: String] }

    private static var folder: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("muse", isDirectory: true)
    }

    private init() {
        for name in Self.names {
            if let img = UIImage(contentsOfFile: Self.folder.appendingPathComponent("\(name).png").path) { images[name] = img }
        }
    }

    /// fetch whatever is missing. does nothing when the pictures are bundled or already saved.
    func ensure(user: String) async {
        guard !asking, MockImages.load("muse/awake.png") == nil else { return }
        let missing = Self.names.filter { images[$0] == nil }
        guard !missing.isEmpty else { return }
        asking = true
        defer { asking = false }
        guard let links: Links = try? await API.get("/api/muse/pictures", user: user) else { return }
        try? FileManager.default.createDirectory(at: Self.folder, withIntermediateDirectories: true)
        for name in missing {
            guard let link = links.pictures[name], let url = URL(string: link),
                  let (data, resp) = try? await URLSession.shared.data(from: url),
                  (resp as? HTTPURLResponse)?.statusCode == 200, let img = UIImage(data: data) else { continue }
            try? data.write(to: Self.folder.appendingPathComponent("\(name).png"), options: .atomic)
            images[name] = img
        }
    }
}
