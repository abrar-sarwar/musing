import SwiftUI
import UIKit

// ---------- bundled mock images ----------

enum MockImages {
    private static let cache = NSCache<NSString, UIImage>()
    static func load(_ path: String) -> UIImage? {
        if let hit = cache.object(forKey: path as NSString) { return hit }
        guard let base = Bundle.main.resourcePath, let img = UIImage(contentsOfFile: "\(base)/mock/\(path)") else { return nil }
        cache.setObject(img, forKey: path as NSString)
        return img
    }
}

/// a bundled mock image that fills whatever frame it is given, cropped.
struct Pic: View {
    let path: String
    var body: some View {
        Color(hex: 0xdddddd).overlay {
            if let img = MockImages.load(path) {
                Image(uiImage: img).resizable().scaledToFill()
            }
        }
        .clipped()
    }
}

// ---------- avatars ----------

private let avatarPalette: [UInt32] = [0x1877f2, 0xe4405f, 0xf7b928, 0x45bd62, 0xa033ff, 0xf02849, 0x5b21b6, 0x0ea5e9, 0xf97316, 0x14b8a6]

private func initials(_ name: String) -> String {
    let parts = name.split(separator: " ")
    return (String(parts.first?.prefix(1) ?? "") + String(parts.dropFirst().first?.prefix(1) ?? "")).uppercased()
}

// mock avatar: an illustrated face bundled with the app (never a real photo),
// falling back to initials on a deterministic color.
struct Avatar: View {
    let name: String
    let seed: String
    var size: CGFloat = 40

    init(_ user: User, size: CGFloat = 40) { name = user.name; seed = user.avatarSeed; self.size = size }
    init(_ person: Person, size: CGFloat = 40) { name = person.name; seed = person.avatarSeed; self.size = size }
    init(name: String, seed: String, size: CGFloat = 40) { self.name = name; self.seed = seed; self.size = size }

    var body: some View {
        ZStack {
            Color(hex: avatarPalette[stableHash(seed) % avatarPalette.count])
            if let img = MockImages.load(avatarPath(name)) {
                Image(uiImage: img).resizable().scaledToFill()
            } else {
                Text(initials(name)).font(.system(size: (size * 0.38).rounded(), weight: .semibold)).foregroundStyle(.white)
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }
}

// muse's own avatar: a small lavender spark. used only inside musing. surfaces.
struct MuseAvatar: View {
    var size: CGFloat = 40
    var body: some View {
        Circle().fill(Muse.gradient).frame(width: size, height: size)
            .overlay(Image(systemName: "sparkles").font(.system(size: size * 0.48, weight: .semibold)).foregroundStyle(.white))
    }
}

// ---------- buttons ----------

/// a row or tile that shows a soft grey highlight while pressed.
struct RowPress: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.background(configuration.isPressed ? FB.hover : Color.clear).contentShape(Rectangle())
    }
}

struct FadePress: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.opacity(configuration.isPressed ? 0.8 : 1).contentShape(Rectangle())
    }
}

// the musing. primary action. gradient pill.
struct GradientButton: View {
    let label: String
    var icon: String?
    var big = false
    var busy = false
    var disabled = false
    var fill = false
    let action: () -> Void

    var body: some View {
        let off = disabled || busy
        Button(action: action) {
            HStack(spacing: 6) {
                if busy { ProgressView().tint(.white).controlSize(.small) } else if let icon { Image(systemName: icon).font(.system(size: big ? 17 : 14, weight: .bold)) }
                Text(label).font(.system(size: big ? 17 : 15, weight: .bold)).lineLimit(1)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 16)
            .frame(maxWidth: big || fill ? .infinity : nil)
            .frame(height: big ? 50 : 40)
            .background(Muse.gradient, in: Capsule())
            .opacity(off ? 0.45 : 1)
        }
        .buttonStyle(FadePress())
        .disabled(off)
    }
}

struct QuietButton: View {
    let label: String
    var disabled = false
    var fill = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label).font(.system(size: 15, weight: .semibold)).foregroundStyle(FB.text).lineLimit(1)
                .padding(.horizontal, 16)
                .frame(maxWidth: fill ? .infinity : nil)
                .frame(height: 40)
                .background(FB.button, in: Capsule())
                .opacity(disabled ? 0.45 : 1)
        }
        .buttonStyle(FadePress())
        .disabled(disabled)
    }
}

// ---------- musing. pieces ----------

// muse speaking. text streams in; a soft caret shows while it's still writing.
struct MuseBubble: View {
    let text: String
    var thinking = false
    var label: String?

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            MuseAvatar(size: 32)
            VStack(alignment: .leading, spacing: 2) {
                if let label { Text(label).font(.system(size: 12, weight: .semibold)).foregroundStyle(Muse.text) }
                Text(text.isEmpty && thinking ? "…" : text + (thinking && !text.isEmpty ? " ▍" : ""))
                    .font(.system(size: 16)).lineSpacing(3).foregroundStyle(FB.text)
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Muse.soft, in: UnevenRoundedRectangle(topLeadingRadius: 18, bottomLeadingRadius: 6, bottomTrailingRadius: 18, topTrailingRadius: 18))
        }
    }
}

struct SectionLabel: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text).font(.system(size: 13, weight: .bold)).foregroundStyle(FB.muted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16).padding(.top, 18).padding(.bottom, 8)
    }
}

struct Hairline: View {
    var body: some View { FB.divider.frame(height: 1 / UIScreen.main.scale) }
}

struct Band: View {
    var body: some View { FB.band.frame(height: 5) }
}

// ---------- shells ----------

enum HeaderAction: String { case create, search, messenger, more, assistant }

// the one mobile facebook header. home shows the wordmark, every other tab a big bold title.
struct FbHeader: View {
    @EnvironmentObject var app: AppState
    var title: String?
    let actions: [HeaderAction]
    var dark = false
    var onCreate: (() -> Void)?
    var onMore: (() -> Void)?

    private func icon(_ a: HeaderAction) -> String {
        switch a {
        case .create: "plus.app"
        case .search: "magnifyingglass"
        case .messenger: "message.fill"
        case .more: "ellipsis.circle"
        case .assistant: "sparkles"
        }
    }

    private func press(_ a: HeaderAction) {
        switch a {
        case .messenger: app.push(.messages)
        case .search: app.push(.search)
        case .create: onCreate?()
        case .more: if let onMore { onMore() } else { toast("Settings for this tab are mocked in the prototype.") }
        case .assistant: toast("Your assistant has no new ideas right now. Mock data.")
        }
    }

    var body: some View {
        let ink = dark ? Color.white : FB.text
        HStack(spacing: 0) {
            Button { app.push(.menu) } label: { Image(systemName: "line.3.horizontal").font(.system(size: 24, weight: .medium)).foregroundStyle(ink) }
                .accessibilityLabel("Menu").padding(.trailing, 8)
            if let title {
                Text(title).font(.system(size: 27, weight: .heavy)).tracking(-0.6).foregroundStyle(ink)
            } else {
                Text("facebook").font(.system(size: 31, weight: .heavy)).tracking(-1.6).foregroundStyle(FB.blue).offset(y: -2)
            }
            Spacer()
            ForEach(actions, id: \.self) { a in
                Button { press(a) } label: {
                    Image(systemName: icon(a)).font(.system(size: 23, weight: .medium)).foregroundStyle(ink)
                        .overlay(alignment: .topTrailing) {
                            if a == .messenger {
                                Text("3").font(.system(size: 11, weight: .bold)).foregroundStyle(.white)
                                    .frame(minWidth: 18, minHeight: 18).background(FB.badge, in: Circle())
                                    .overlay(Circle().stroke(dark ? Color.black : .white, lineWidth: 1.5))
                                    .offset(x: 8, y: -7)
                            }
                        }
                }
                .accessibilityLabel(a.rawValue)
                .padding(.leading, 18)
            }
        }
        .padding(.leading, 12).padding(.trailing, 12)
        .frame(height: 52)
    }
}

// pushed screens (messages, event detail, plan): back arrow + title
struct SubScreen<Content: View>: View {
    @EnvironmentObject var app: AppState
    let title: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                Button { app.back() } label: {
                    Image(systemName: "chevron.left").font(.system(size: 20, weight: .semibold)).foregroundStyle(FB.text).frame(width: 36, height: 36)
                }
                .accessibilityLabel("Back")
                Text(title).font(.system(size: 17, weight: .semibold)).foregroundStyle(FB.text).lineLimit(1)
                Spacer()
            }
            .padding(.horizontal, 8).frame(height: 48)
            Hairline()
            content.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .background(Color.white)
        .toolbar(.hidden, for: .navigationBar)
    }
}

// keep the swipe-back gesture even though every screen hides the system nav bar
extension UINavigationController: @retroactive UIGestureRecognizerDelegate {
    override open func viewDidLoad() {
        super.viewDidLoad()
        interactivePopGestureRecognizer?.delegate = self
    }

    public func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        viewControllers.count > 1
    }
}

struct ToastOverlay: View {
    @ObservedObject var center = ToastCenter.shared
    var body: some View {
        VStack {
            Spacer()
            if let text = center.text {
                Text(text).font(.system(size: 14, weight: .medium)).foregroundStyle(.white).multilineTextAlignment(.center)
                    .padding(.horizontal, 14).padding(.vertical, 10)
                    .background(Color(hex: 0x1c1e21, alpha: 0.94), in: RoundedRectangle(cornerRadius: 12))
                    .padding(.horizontal, 28).padding(.bottom, 84)
                    .transition(.opacity)
            }
        }
        .allowsHitTesting(false)
    }
}

// wraps children onto as many rows as needed (chips, tags)
struct Flow: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(proposal.width ?? .infinity, subviews)
        return CGSize(width: proposal.width ?? rows.width, height: rows.height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let rows = arrange(bounds.width, subviews)
        for (i, p) in rows.points.enumerated() {
            subviews[i].place(at: CGPoint(x: bounds.minX + p.x, y: bounds.minY + p.y), proposal: .unspecified)
        }
    }

    private func arrange(_ width: CGFloat, _ subviews: Subviews) -> (points: [CGPoint], width: CGFloat, height: CGFloat) {
        var points: [CGPoint] = []
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0, maxX: CGFloat = 0
        for s in subviews {
            let size = s.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            points.append(CGPoint(x: x, y: y))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
            maxX = max(maxX, x - spacing)
        }
        return (points, maxX, y + rowHeight)
    }
}

/// bold and regular runs in one wrapping text
func richText(_ parts: [Mock.Part], size: CGFloat, trailing: String? = nil) -> Text {
    var out = AttributedString()
    for p in parts {
        var run = AttributedString(p.t)
        run.font = .system(size: size, weight: p.b ? .bold : .regular)
        run.foregroundColor = FB.text
        out += run
    }
    if let trailing {
        var run = AttributedString(trailing)
        run.font = .system(size: size)
        run.foregroundColor = FB.muted
        out += run
    }
    return Text(out)
}
