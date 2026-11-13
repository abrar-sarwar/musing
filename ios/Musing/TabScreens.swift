import SwiftUI
import AVFoundation

// ---------- reels ----------

struct Reel: Identifiable, Hashable {
    let id: String
    let topic: String
    let user: User
    let caption: String
    let headline: String
    let poster: String
    /// a real clip bundled with the app, and the thought it hands to muse
    var video: URL? = nil
    var pitch: String? = nil
    /// what the friends who liked it are after, for the card's line
    var want: String? = nil
    /// the clip's still, when it is streamed from the server rather than bundled
    var posterURL: URL? = nil
}

/// signed links to the reel clips, for a build that does not have the files bundled
struct ReelVideoLinks: Decodable {
    struct Link: Decodable { let video: String?; let poster: String? }
    let videos: [String: Link]
}

/// who liked a topic's reel. the screen only ever names opted-in friends.
struct ReelLikeRow: Decodable {
    struct Liker: Decodable { let id: String; let name: String; let avatarSeed: String; let reelsOptIn: Bool }
    let userId: String
    let topic: String
    let user: Liker
}

struct ReelsScreen: View {
    @EnvironmentObject var app: AppState
    @State private var overlap: Overlap?
    @State private var status = "Loading…"
    // launch with `-reel video:band` to open on that reel (screenshots, demos)
    @State private var current: String? = UserDefaults.standard.string(forKey: "reel").map { "0|\($0)" }
    @State private var liked: Set<String> = []
    @State private var saved: Set<String> = []
    @State private var dismissed = false
    @State private var likeRows: [ReelLikeRow] = []
    @State private var friendIds: Set<String> = []
    @State private var dismissedLikes: Set<String> = []
    @State private var muted = false
    @State private var remoteVideos: [String: ReelVideoLinks.Link] = [:]
    @Environment(\.scenePhase) private var scenePhase

    /// friends of the viewer who liked this topic's reel and share their reels activity
    private func likers(_ topic: String) -> [Person] {
        var seen = Set<String>()
        return likeRows
            .filter { $0.topic == topic && $0.userId != app.userId && friendIds.contains($0.userId) && $0.user.reelsOptIn && seen.insert($0.userId).inserted }
            .map { Person(id: $0.user.id, name: $0.user.name, avatarSeed: $0.user.avatarSeed) }
    }

    /// one screenful of the feed. the same clip comes round again under a new id.
    private struct ReelPage: Identifiable { let id: String; let reel: Reel }
    private static let rounds = 40

    /// the feed never runs out: after the last clip the first one comes again
    private var pages: [ReelPage] {
        let list = reels
        return (0..<Self.rounds).flatMap { round in list.map { ReelPage(id: "\(round)|\($0.id)", reel: $0) } }
    }

    private var reels: [Reel] {
        // real clips only, in the order Mock.videoReels lists them
        Mock.videoReels.compactMap { v -> Reel? in
            // the bundled file when this build has it, otherwise the same clip streamed from the server
            let remote = remoteVideos[v.file]
            guard let url = v.url ?? remote?.video.flatMap(URL.init(string:)) else { return nil }
            let creator = User(id: "creator:\(v.creator)", name: v.creator, avatarSeed: v.creator, bio: nil, interests: [])
            return Reel(id: "video:\(v.file)", topic: v.topic, user: creator, caption: v.caption, headline: "", poster: "reelvideo/\(v.file).jpg", video: url, pitch: v.pitch, want: v.want,
                        posterURL: v.url == nil ? remote?.poster.flatMap(URL.init(string:)) : nil)
        }
    }

    var body: some View {
        let list = pages
        let at = list.firstIndex { $0.id == (current ?? list.first?.id) } ?? 0
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()
            if list.isEmpty {
                Text(status).foregroundStyle(Color(hex: 0xaaaaaa)).padding(.top, 220)
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(Array(list.enumerated()), id: \.element.id) { i, p in
                            // a player exists only for the page on screen and its neighbours
                            page(p.reel, isCurrent: i == at, near: abs(i - at) <= 1)
                                .containerRelativeFrame([.horizontal, .vertical])
                                .id(p.id)
                        }
                    }
                    .scrollTargetLayout()
                }
                .scrollTargetBehavior(.paging)
                .scrollPosition(id: $current)
                .scrollIndicators(.hidden)
                .ignoresSafeArea()
            }
            FbHeader(title: "Reels", actions: [.more, .search, .messenger], dark: true)
        }
        .task(id: app.version) { await load() }
        .task {
            // only ask for links when a clip is missing from this build
            guard Mock.videoReels.contains(where: { $0.url == nil }) else { return }
            if let links: ReelVideoLinks = try? await API.get("/api/reels/videos", user: app.userId) { remoteVideos = links.videos }
        }
    }

    private func load() async {
        overlap = nil
        dismissed = false
        status = "Loading…"
        do {
            // the count comes from sql on the server: opted-in friends only, null below 3.
            async let o: OverlapResponse? = try? API.get("/api/overlap", user: app.userId)
            // likes are only read for the clips that hand muse a thought
            let topics = Mock.videoReels.filter { $0.pitch != nil }.map { "\"\($0.topic)\"" }.joined(separator: ",")
            let l: [ReelLikeRow] = try await Supa.select("reels_topics", "select=user_id,topic,user:users!reels_topics_user_id_fkey(id,name,avatar_seed,reels_opt_in)&topic=in.(\(topics))&order=score.desc")
            async let f: [FriendEdge]? = try? Supa.select("friendships", "select=friend_id&user_id=eq.\(app.userId)")
            let ov = await o
            let friends = await f
            guard !Task.isCancelled else { return }
            likeRows = l
            friendIds = Set((friends ?? []).map(\.friendId))
            dismissedLikes = []
            overlap = ov?.overlap
            status = "No reels yet."
        } catch let e {
            guard !Task.isCancelled else { return }
            status = errorText(e)
        }
    }

    private func page(_ item: Reel, isCurrent: Bool, near: Bool) -> some View {
        // a clip with nothing to hand muse shows no card at all
        let friends = item.pitch == nil ? [] : likers(item.topic)
        let likes = 900 + stableHash(item.id) % 140000 + friends.count
        return ZStack {
            CoverArt(path: item.poster, topic: item.topic)
            if let poster = item.posterURL {
                AsyncImage(url: poster) { image in image.resizable().scaledToFill() } placeholder: { Color.black }
                    .frame(maxWidth: .infinity, maxHeight: .infinity).clipped()
            }
            if let url = item.video, near {
                ReelVideo(url: url, playing: isCurrent && app.tab == .reels && scenePhase == .active, muted: muted)
                    .contentShape(Rectangle())
                    .onTapGesture { muted.toggle() }
                    .accessibilityLabel(muted ? "Unmute" : "Mute")
            }
            LinearGradient(stops: [.init(color: .black.opacity(0.75), location: 0), .init(color: .black.opacity(0.05), location: 0.3), .init(color: .black.opacity(0.9), location: 1)], startPoint: .top, endPoint: .bottom)
            VStack(spacing: 0) {
                Text(item.headline).font(.system(size: 19, weight: .semibold)).italic().foregroundStyle(.white).multilineTextAlignment(.center)
                    .shadow(color: .black.opacity(0.6), radius: 6).padding(.horizontal, 24).padding(.top, 140)
                Spacer()
                HStack(alignment: .bottom, spacing: 12) {
                    VStack(alignment: .leading, spacing: 0) {
                        if !friends.isEmpty, isCurrent, !dismissedLikes.contains(item.id) {
                            FriendsLikedCard(friends: friends, reel: item) { dismissedLikes.insert(item.id) }
                        } else if item.pitch != nil, let overlap, item.topic == overlap.topic, isCurrent, !dismissed {
                            OverlapCard(overlap: overlap) { dismissed = true }
                        }
                        HStack(spacing: 10) {
                            Avatar(item.user, size: 38)
                            VStack(alignment: .leading, spacing: 1) {
                                HStack(spacing: 5) {
                                    Text(item.user.name).font(.system(size: 15.5, weight: .bold))
                                    Image(systemName: "globe.americas.fill").font(.system(size: 12))
                                }
                                HStack(spacing: 5) {
                                    Image(systemName: "music.note").font(.system(size: 12))
                                    Text(item.video == nil ? "\(firstName(item.user.name)) · Original audio" : (muted ? "Muted · tap for sound" : "Original audio")).font(.system(size: 13.5)).lineLimit(1)
                                }
                            }
                        }
                        (Text(item.caption + " ") + Text("#" + item.topic.filter { !$0.isWhitespace }).bold())
                            .font(.system(size: 15)).lineLimit(2).padding(.top, 8)
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    VStack(spacing: 18) {
                        rail(liked.contains(item.id) ? "hand.thumbsup.fill" : "hand.thumbsup", compactCount(likes + (liked.contains(item.id) ? 1 : 0)), "Like") { liked.formSymmetricDifference([item.id]) }
                        rail("bubble.right", compactCount(40 + stableHash(item.id + "c") % 900), "Comment") { toast("Comments are mocked in this prototype.") }
                        rail("arrowshape.turn.up.right", compactCount(10 + stableHash(item.id + "s") % 5000), "Share") { toast("Sharing is mocked in this prototype.") }
                        rail(saved.contains(item.id) ? "bookmark.fill" : "bookmark", saved.contains(item.id) ? "Saved" : compactCount(20 + stableHash(item.id + "b") % 19000), "Save") { saved.formSymmetricDifference([item.id]) }
                        rail("ellipsis", "", "More") { toast("More options are mocked in this prototype.") }
                    }
                }
                .padding(.leading, 14).padding(.trailing, 10).padding(.bottom, tabBarSpace + 12)
            }
        }
    }

    private func rail(_ icon: String, _ label: String, _ name: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 3) {
                Image(systemName: icon).font(.system(size: 25, weight: .medium))
                if !label.isEmpty { Text(label).font(.system(size: 12.5, weight: .bold)) }
            }
            .foregroundStyle(.white).frame(minWidth: 44)
        }
        .buttonStyle(FadePress()).accessibilityLabel(name)
    }
}

// a real clip, looping, filling the page. it only plays on the page being looked at.
struct ReelVideo: UIViewRepresentable {
    let url: URL
    let playing: Bool
    let muted: Bool

    final class PlayerView: UIView {
        override class var layerClass: AnyClass { AVPlayerLayer.self }
        var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
        let player = AVQueuePlayer()
        var looper: AVPlayerLooper?
    }

    func makeUIView(context: Context) -> PlayerView {
        let v = PlayerView()
        v.looper = AVPlayerLooper(player: v.player, templateItem: AVPlayerItem(url: url))
        v.playerLayer.player = v.player
        v.playerLayer.videoGravity = .resizeAspectFill
        v.backgroundColor = .clear
        return v
    }

    func updateUIView(_ v: PlayerView, context: Context) {
        v.player.isMuted = muted
        if playing { v.player.play() } else { v.player.pause() }
    }

    static func dismantleUIView(_ v: PlayerView, coordinator: ()) {
        v.player.pause()
        v.looper = nil
    }
}

// friends who liked this reel, by name, and one tap to turn it into a plan with them.
// only opted-in friends are ever named.
struct FriendsLikedCard: View {
    @EnvironmentObject var app: AppState
    let friends: [Person]
    let reel: Reel
    let onDismiss: () -> Void
    @State private var shown = false

    private var names: [String] { friends.map { firstName($0.name) } }
    private var line: String {
        // "jo, alex and mina also want to explore chicago", or "liked this" when the clip names no wish
        let tail = reel.want.map { "also want\(names.count == 1 ? "s" : "") to \($0)" } ?? "liked this"
        switch names.count {
        case 1: return "\(names[0]) \(tail)"
        case 2: return "\(names[0]) and \(names[1]) \(tail)"
        case 3: return "\(names[0]), \(names[1]) and \(names[2]) \(tail)"
        default: return "\(names[0]), \(names[1]) and \(names.count - 2) other friends \(tail)"
        }
    }
    private var crew: String {
        let n = names.prefix(3).map { $0.lowercased() }
        return n.count < 2 ? n.joined() : n.dropLast().joined(separator: ", ") + " and " + n[n.count - 1]
    }

    var body: some View {
        HStack(spacing: 10) {
            HStack(spacing: -10) {
                ForEach(friends.prefix(3)) { f in
                    Avatar(f, size: 32).overlay(Circle().stroke(Color(hex: 0xfaf7ff), lineWidth: 2))
                }
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(line).font(.system(size: 14.5, weight: .semibold)).foregroundStyle(Color(hex: 0x1c1e21)).lineLimit(2).fixedSize(horizontal: false, vertical: true)
                Button {
                    onDismiss()
                    // the thought goes out as a signal friends can see, so it never names who liked the reel.
                    // the names stay on this card, which only the viewer sees.
                    app.makeAMove(reel.pitch ?? "this could be us: \(reel.topic)", from: SignalContext(kind: "reel", id: reel.topic, title: "a reel about \(reel.topic)"))
                } label: {
                    HStack(spacing: 4) {
                        MuseFace(expression: .awake, size: 20)
                        Text("this could be us").font(.system(size: 14.5, weight: .bold))
                    }
                    .foregroundStyle(Muse.text)
                }
                .accessibilityIdentifier("reel-could-be-us")
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: onDismiss) { Image(systemName: "xmark").font(.system(size: 13, weight: .semibold)).foregroundStyle(Color(hex: 0x6b6b70)).frame(width: 28, height: 28) }
                .accessibilityLabel("dismiss")
        }
        .padding(.vertical, 10).padding(.horizontal, 12)
        .background(Color(hex: 0xfaf7ff, alpha: 0.96), in: RoundedRectangle(cornerRadius: 16))
        .padding(.bottom, 12)
        .opacity(shown ? 1 : 0).offset(y: shown ? 0 : 30)
        .onAppear { withAnimation(.spring(response: 0.5, dampingFraction: 0.8).delay(0.5)) { shown = true } }
    }
}

// friends overlap: a small contextual card on a reel about something 3 or more
// opted-in friends are also into. it gives a count and never says who.
struct OverlapCard: View {
    @EnvironmentObject var app: AppState
    let overlap: Overlap
    let onDismiss: () -> Void
    @State private var shown = false

    var body: some View {
        HStack(spacing: 10) {
            MuseFace(expression: .awake, size: 30)
            VStack(alignment: .leading, spacing: 2) {
                Text("wait... some of your friends are into \(overlap.topic) too").font(.system(size: 14.5, weight: .semibold)).foregroundStyle(Color(hex: 0x1c1e21))
                Button {
                    onDismiss()
                    app.makeAMove("\(overlap.topic) with whoever's into it", from: SignalContext(kind: "reel", id: overlap.topic, title: "a reel about \(overlap.topic)"))
                } label: { Text("make a move").font(.system(size: 14.5, weight: .bold)).foregroundStyle(Muse.text) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: onDismiss) { Image(systemName: "xmark").font(.system(size: 13, weight: .semibold)).foregroundStyle(Color(hex: 0x6b6b70)).frame(width: 28, height: 28) }
                .accessibilityLabel("dismiss")
        }
        .padding(.vertical, 10).padding(.horizontal, 12)
        .background(Color(hex: 0xfaf7ff, alpha: 0.96), in: RoundedRectangle(cornerRadius: 16))
        .padding(.bottom, 12)
        .opacity(shown ? 1 : 0).offset(y: shown ? 0 : 30)
        .onAppear { withAnimation(.spring(response: 0.5, dampingFraction: 0.8).delay(0.5)) { shown = true } }
    }
}

// ---------- marketplace ----------

struct MarketplaceScreen: View {
    @EnvironmentObject var app: AppState
    @State private var tab = "Explore"
    private let columns = [GridItem(.flexible(), spacing: 4), GridItem(.flexible(), spacing: 4)]

    var body: some View {
        VStack(spacing: 0) {
            FbHeader(title: "Marketplace", actions: [.messenger, .search, .more])
            HStack(spacing: 0) {
                ScrollView(.horizontal) {
                    HStack(spacing: 2) {
                        ForEach(Mock.marketTabs, id: \.self) { t in
                            Button {
                                if t == "Sell" { toast("Listing an item is mocked in this prototype.") } else { tab = t }
                            } label: {
                                Text(t).font(.system(size: 16, weight: .semibold)).foregroundStyle(tab == t ? FB.blue : FB.text)
                                    .padding(.horizontal, 14).frame(height: 38).background(tab == t ? FB.blueSoft : .clear, in: Capsule())
                            }
                            .buttonStyle(FadePress())
                            .accessibilityAddTraits(tab == t ? .isSelected : [])
                        }
                    }
                    .padding(.horizontal, 10)
                }
                .scrollIndicators(.hidden)
                Button { toast("Atlanta, Georgia · within 40 miles. Mock location.") } label: { Image(systemName: "mappin.and.ellipse").font(.system(size: 20)).foregroundStyle(FB.text).padding(.horizontal, 12) }
                    .accessibilityLabel("Location")
            }
            .padding(.bottom, 8)
            ScrollView {
                if tab == "Jobs" || tab == "Services" {
                    LazyVStack(spacing: 0) {
                        ForEach(tab == "Jobs" ? Mock.jobs : Mock.services) { r in
                            Button { toast("Mock listing. Nothing to apply to or book.") } label: {
                                HStack(spacing: 12) {
                                    Circle().fill(FB.input).frame(width: 44, height: 44).overlay(Image(systemName: tab == "Jobs" ? "briefcase" : "wrench.and.screwdriver").font(.system(size: 18)).foregroundStyle(FB.text))
                                    VStack(alignment: .leading, spacing: 1) {
                                        Text(r.title).font(.system(size: 16, weight: .semibold)).foregroundStyle(FB.text)
                                        Text("\(r.who) · \(r.pay)").font(.system(size: 14)).foregroundStyle(FB.muted)
                                    }
                                    Spacer()
                                }
                                .padding(.horizontal, 14).padding(.vertical, 12)
                            }
                            .buttonStyle(RowPress())
                        }
                    }
                    .padding(.bottom, tabBarSpace)
                } else {
                    let all = app.listings
                    let items = tab == "Local" ? all.filter(\.nearby) : tab == "More" ? all.reversed() : all
                    LazyVGrid(columns: columns, spacing: 0) {
                        ForEach(items) { item in ListingTile(item: item) { app.push(.listing(item.id)) } }
                    }
                    .padding(.bottom, tabBarSpace)
                }
            }
            .scrollIndicators(.hidden)
        }
        .background(Color.white)
        .task { if app.catalog == nil { await app.loadCatalog() } }
    }
}

// dense two-column tile: square image, then "price · title" on one line.
struct ListingTile: View {
    let item: Mock.Listing
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 0) {
                CoverArt(path: item.image, topic: item.topic ?? item.category).aspectRatio(1, contentMode: .fit)
                    .overlay(alignment: .topLeading) {
                        if item.nearby {
                            Text("Nearby").font(.system(size: 12.5, weight: .medium)).foregroundStyle(FB.text)
                                .padding(.horizontal, 6).padding(.vertical, 2).background(Color.white, in: RoundedRectangle(cornerRadius: 5)).padding(8)
                        }
                    }
                (Text(money(item.price)).fontWeight(.medium)
                    + Text(item.was.map { " " + money($0) } ?? "").foregroundStyle(FB.muted).strikethrough()
                    + Text(" · \(item.title)"))
                    .font(.system(size: 15.5)).foregroundStyle(FB.text).lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 8).padding(.top, 8).padding(.bottom, 10)
            }
        }
        .buttonStyle(FadePress())
        .accessibilityLabel("\(item.title), \(money(item.price))")
    }
}

// lightweight product detail. mock data, no payments, no real sellers.
struct ListingScreen: View {
    @EnvironmentObject var app: AppState
    let listingId: String
    private let columns = [GridItem(.flexible(), spacing: 4), GridItem(.flexible(), spacing: 4)]

    var body: some View {
        SubScreen(title: "Marketplace") {
            let all = app.listings
            if let item = all.first(where: { $0.id == listingId }) {
                // the same kind of thing first (a camera next to a camera), then the same category
                let more = Array((all.filter { $0.id != item.id && item.topic != nil && $0.topic == item.topic } + all.filter { $0.id != item.id && $0.category == item.category && (item.topic == nil || $0.topic != item.topic) }).prefix(4))
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        CoverArt(path: item.image, topic: item.topic ?? item.category).aspectRatio(1, contentMode: .fit)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.title).font(.system(size: 22, weight: .bold)).foregroundStyle(FB.text)
                            (Text(money(item.price)).fontWeight(.semibold) + Text(item.was.map { "  " + money($0) } ?? "").foregroundStyle(FB.muted).strikethrough())
                                .font(.system(size: 19)).foregroundStyle(FB.text)
                            Text("Listed in \(item.place) · \(item.category)\(item.condition.map { " · \(sentenceCase($0))" } ?? "")").font(.system(size: 14)).foregroundStyle(FB.muted)
                            HStack(spacing: 8) {
                                pill("message.fill", "Message", primary: true) { toast("Message sent to the seller. Mock only.") }
                                pill(app.isSaved("listing", item.id) ? "bookmark.fill" : "bookmark", app.isSaved("listing", item.id) ? "Saved" : "Save") { app.setSaved("listing", item.id, !app.isSaved("listing", item.id)) }
                                pill("arrowshape.turn.up.right", "Share") { toast("Sharing is mocked in this prototype.") }
                            }
                            .padding(.vertical, 10)
                            MoveFromThis(sub: "muse can turn this into a plan with friends. nothing is bought or held.") {
                                app.makeAMove("something with friends around this \(item.title.lowercased())", from: SignalContext(kind: "listing", id: item.id, title: item.title))
                            }
                            heading("Description")
                            Text(item.about).font(.system(size: 16)).lineSpacing(3).foregroundStyle(FB.text)
                            heading("Seller information")
                            if let seller = app.user(item.seller) {
                                Button { app.push(.person(seller.id)) } label: {
                                    HStack(spacing: 12) {
                                        Avatar(seller, size: 48)
                                        VStack(alignment: .leading, spacing: 0) {
                                            Text(seller.name).font(.system(size: 16, weight: .semibold)).foregroundStyle(FB.text)
                                            Text("Joined Facebook in 2019 · mock profile").font(.system(size: 14)).foregroundStyle(FB.muted)
                                        }
                                        Spacer()
                                    }
                                    .padding(.vertical, 6)
                                }
                                .buttonStyle(RowPress())
                            }
                            if !more.isEmpty { heading("More like this") }
                        }
                        .padding(14)
                        LazyVGrid(columns: columns, spacing: 0) {
                            ForEach(more) { m in
                                ListingTile(item: m) {
                                    app.back()
                                    app.push(.listing(m.id))
                                }
                            }
                        }
                    }
                    .padding(.bottom, 40)
                }
            } else {
                Text(app.catalog == nil ? "Loading…" : "This listing isn't available.").foregroundStyle(FB.muted).padding(24)
            }
        }
        .task { if app.catalog == nil { await app.loadCatalog() } }
    }

    private func heading(_ t: String) -> some View {
        Text(t).font(.system(size: 18, weight: .bold)).foregroundStyle(FB.text).padding(.top, 12).padding(.bottom, 2)
    }

    private func pill(_ icon: String, _ label: String, primary: Bool = false, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.system(size: 15))
                Text(label).font(.system(size: 15, weight: primary ? .bold : .semibold))
            }
            .foregroundStyle(primary ? Color.white : FB.text)
            .frame(maxWidth: .infinity).frame(height: 40)
            .background(primary ? FB.blue : FB.button, in: RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(FadePress())
    }
}

// ---------- dating ----------

// facebook dating shell. fictional profiles, local interactions only. not connected to musing.
struct DatingScreen: View {
    @State private var tab = "Explore"
    @State private var banner = true
    @State private var at: [String: Int] = [:]
    @State private var answer: Int?
    private let dots = ["Friendship", "Matches", "Explore"]
    private let columns = [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)]

    var body: some View {
        let pool = Mock.datingProfiles.filter { $0.tags.contains(tab) }
        let profile = pool.isEmpty ? nil : pool[(at[tab] ?? 0) % pool.count]
        VStack(spacing: 0) {
            FbHeader(title: "Dating", actions: [.assistant, .more])
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    ScrollView(.horizontal) {
                        HStack(spacing: 8) {
                            ForEach(Mock.datingTabs, id: \.self) { t in
                                Button { tab = t } label: {
                                    Text(t).font(.system(size: 15.5, weight: .semibold)).foregroundStyle(tab == t ? Muse.dating : FB.text)
                                        .padding(.horizontal, 14).frame(height: 38).background(tab == t ? Muse.soft : FB.button, in: Capsule())
                                        .overlay(alignment: .topTrailing) {
                                            if dots.contains(t) { Circle().fill(Color(hex: 0x7c4dff)).frame(width: 8, height: 8).offset(x: -6, y: 4) }
                                        }
                                }
                                .buttonStyle(FadePress())
                            }
                        }
                        .padding(.horizontal, 12).padding(.bottom, 12)
                    }
                    .scrollIndicators(.hidden)

                    if banner {
                        HStack(alignment: .top, spacing: 10) {
                            Pic(path: "dating/jordan.jpg").frame(width: 40, height: 40).clipShape(Circle())
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Your dating assistant has a new idea for you and your match Jordan.").font(.system(size: 15.5, weight: .medium)).foregroundStyle(FB.text)
                                Button { toast("A bowling alley with a jukebox, apparently. Mock data.") } label: { Text("See more updates").font(.system(size: 15)).foregroundStyle(Muse.dating) }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            Button { banner = false } label: { Image(systemName: "xmark").font(.system(size: 15, weight: .semibold)).foregroundStyle(FB.text) }
                                .accessibilityLabel("Dismiss")
                        }
                        .padding(10).background(Muse.soft, in: RoundedRectangle(cornerRadius: 12))
                        .padding(.horizontal, 12).padding(.bottom, 14)
                    }

                    if let profile {
                        VStack(alignment: .leading, spacing: 0) {
                            Pic(path: profile.image).aspectRatio(1.02, contentMode: .fit)
                                .overlay(alignment: .bottomTrailing) {
                                    HStack(spacing: 14) {
                                        fab("xmark", fill: .white, ink: Muse.dating, label: "Pass") { next(profile, liked: false) }
                                        fab("heart.fill", fill: Muse.dating, ink: .white, label: "Like") { next(profile, liked: true) }
                                    }
                                    .padding(.trailing, 16).offset(y: 22)
                                }
                            VStack(alignment: .leading, spacing: 2) {
                                Text("\(profile.name), \(profile.age)").font(.system(size: 23, weight: .bold)).foregroundStyle(FB.text)
                                Text(profile.line).font(.system(size: 16)).foregroundStyle(FB.text)
                            }
                            .frame(maxWidth: .infinity, minHeight: 72, alignment: .topLeading).padding(16)
                        }
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .shadow(color: .black.opacity(0.12), radius: 8, y: 2)
                        .padding(.horizontal, 12)
                    } else {
                        Text("No one here right now. Mock data.").foregroundStyle(FB.muted).frame(maxWidth: .infinity).padding(40)
                    }

                    HStack(spacing: 8) {
                        Circle().fill(Muse.soft).frame(width: 26, height: 26).overlay(Image(systemName: "sparkles").font(.system(size: 12, weight: .bold)).foregroundStyle(Muse.dating))
                        Text("Ask your dating assistant").font(.system(size: 17, weight: .bold)).foregroundStyle(FB.text)
                    }
                    .padding(.horizontal, 14).padding(.top, 22).padding(.bottom, 10)
                    LazyVGrid(columns: columns, spacing: 8) {
                        ForEach(Array(Mock.datingQuestions.enumerated()), id: \.offset) { i, q in
                            Button { answer = answer == i ? nil : i } label: {
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(q.emoji).font(.system(size: 18))
                                    Text(q.q).font(.system(size: 15, weight: .medium)).foregroundStyle(FB.text).multilineTextAlignment(.leading)
                                }
                                .frame(maxWidth: .infinity, minHeight: 64, alignment: .topLeading).padding(12)
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(answer == i ? Muse.dating : FB.divider, lineWidth: 1))
                            }
                            .buttonStyle(FadePress())
                        }
                    }
                    .padding(.horizontal, 12)
                    if let answer {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(Mock.datingQuestions[answer].a).font(.system(size: 15.5)).lineSpacing(3).foregroundStyle(FB.text)
                            Text("Canned mock answer. No AI call is made here.").font(.system(size: 12)).foregroundStyle(FB.muted)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading).padding(12)
                        .background(Muse.soft, in: RoundedRectangle(cornerRadius: 12)).padding(.horizontal, 12).padding(.top, 10)
                    }
                }
                .padding(.bottom, tabBarSpace)
            }
            .scrollIndicators(.hidden)
        }
        .background(Color.white)
    }

    private func next(_ profile: Mock.DatingProfile, liked: Bool) {
        if liked { toast("You liked \(profile.name). Mock only, no one is notified.") }
        at[tab, default: 0] += 1
    }

    private func fab(_ icon: String, fill: Color, ink: Color, label: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Circle().fill(fill).frame(width: 66, height: 66).shadow(color: .black.opacity(0.2), radius: 6, y: 2)
                .overlay(Image(systemName: icon).font(.system(size: 26, weight: .semibold)).foregroundStyle(ink))
        }
        .buttonStyle(FadePress()).accessibilityLabel(label)
    }
}

// ---------- notifications ----------

struct NoteRow: Identifiable {
    enum Who { case person(Person), muse, facebook, image(String) }
    let id: String
    let parts: [Mock.Part]
    let age: String
    let unread: Bool
    let badge: (icon: String, color: Color)
    let who: Who
    var thumb: String?
    let go: Route?
    var tab: AppTab?
}

private let noteBadges: [String: (icon: String, color: Color)] = [
    "love": ("heart.fill", Color(hex: 0xf3425f)),
    "post": ("text.bubble.fill", FB.blue),
    "comment": ("bubble.left.fill", Color(hex: 0x31a24c)),
    "market": ("storefront.fill", Color(hex: 0x0aa5a5)),
    "dating": ("heart.circle.fill", Color(hex: 0x7c4dff)),
    "security": ("checkmark.shield.fill", FB.blue),
    "friend": ("calendar", Color(hex: 0xf3425f)),
]

private func nameList(_ people: [Person]) -> String {
    let n = people.map { firstName($0.name).lowercased() }
    return n.count <= 1 ? (n.first ?? "") : n.dropLast().joined(separator: ", ") + " and " + n[n.count - 1]
}

// musing. rows, built from what this person is allowed to see. before a plan is
// happening they carry a count, never names.
func musingRows(_ home: MusingHome?, me: String) -> [NoteRow] {
    guard let home else { return [] }
    var rows: [NoteRow] = []
    func add(_ p: PlanView, _ key: String, _ parts: [Mock.Part], _ who: NoteRow.Who, unread: Bool = true) {
        rows.append(NoteRow(id: "m-\(p.id)-\(key)", parts: parts, age: "now", unread: unread, badge: ("muse", Muse.start), who: who, go: .plan(p.id)))
    }
    typealias P = Mock.Part
    for p in home.asks {
        let starter = firstName(p.starter.name).lowercased()
        if p.state == "proposing", p.me?.status == "pending" {
            add(p, "ask", [P(t: starter, b: true), P(t: " is thinking about "), P(t: p.activity ?? "something", b: true), P(t: ", \(p.when ?? "soon"). muse thought of you. your answer stays private.")], .person(p.starter))
        } else if p.state == "happening", p.me?.status == "down" {
            add(p, "on", [P(t: "\(p.activity ?? "the plan") with "), P(t: starter, b: true), P(t: " is happening. \(p.when ?? "").")], .person(p.starter))
        }
    }
    for p in home.mine {
        if p.state == "happening" {
            let others = (p.going ?? []).filter { $0.id != me }
            add(p, "real", [P(t: nameList(others), b: true), P(t: " \(others.count == 1 ? "is" : "are") down for your "), P(t: p.activity ?? "plan", b: true), P(t: ". it's happening.")], others.first.map { .person($0) } ?? .muse)
        } else if p.state == "proposing" {
            if p.note != nil, p.version > 1 { add(p, "v\(p.version)", [P(t: "muse found a new time that works for everyone: "), P(t: p.when ?? "", b: true), P(t: ".")], .muse) }
            if p.downCount > 0 { add(p, "c\(p.downCount)", [P(t: "\(p.downCount) of \(p.quorum)", b: true), P(t: " are in for your \(p.activity ?? "plan") so far. names show once it's on.")], .muse) }
        } else if p.state == "draft" {
            add(p, "draft", [P(t: "muse drafted a plan for "), P(t: p.activity ?? "your thought", b: true), P(t: ". nothing has been sent yet.")], .muse, unread: false)
        }
    }
    return rows
}

struct NotificationsScreen: View {
    @EnvironmentObject var app: AppState
    @State private var home: MusingHome?
    @State private var read: Set<String> = []

    private var rows: [NoteRow] {
        let mock = Mock.notifications.filter { $0.from != app.userId }.map { n -> NoteRow in
            let who: NoteRow.Who = app.user(n.from).map { .person($0.person) } ?? Mock.datingProfiles.first { $0.id == n.from }.map { .image($0.image) } ?? .facebook
            return NoteRow(id: n.id, parts: n.text, age: n.age, unread: n.unread, badge: noteBadges[n.kind] ?? ("bell.fill", FB.blue), who: who, thumb: n.thumb, go: nil, tab: n.to)
        }
        return musingRows(home, me: app.userId) + mock
    }

    var body: some View {
        let list = rows
        VStack(spacing: 0) {
            FbHeader(title: "Notifications", actions: [.messenger, .search, .more], onMore: { read = Set(list.map(\.id)) })
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    Text("New").font(.system(size: 18, weight: .bold)).foregroundStyle(FB.text).padding(.horizontal, 14).padding(.bottom, 6)
                    ForEach(list) { item in
                        let unread = item.unread && !read.contains(item.id)
                        Button {
                            read.insert(item.id)
                            if let route = item.go { app.push(route) } else if let tab = item.tab { app.go(tab) }
                        } label: {
                            HStack(alignment: .top, spacing: 12) {
                                avatar(item.who)
                                    .overlay(alignment: .bottomTrailing) {
                                        Circle().fill(item.badge.color).frame(width: 28, height: 28)
                                            .overlay(Glyph(name: item.badge.icon, size: 12, weight: .semibold).foregroundStyle(.white))
                                            .overlay(Circle().stroke(Color.white, lineWidth: 2)).offset(x: 4, y: 2)
                                    }
                                richText(item.parts, size: 15.5, trailing: " " + item.age).lineLimit(4).multilineTextAlignment(.leading)
                                    .frame(maxWidth: .infinity, alignment: .leading).padding(.top, 4)
                                if let thumb = item.thumb { Pic(path: thumb).frame(width: 56, height: 44).clipShape(RoundedRectangle(cornerRadius: 6)).padding(.top, 8) }
                                Image(systemName: "ellipsis").font(.system(size: 17, weight: .semibold)).foregroundStyle(FB.text).padding(.top, 8)
                            }
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(unread ? FB.blueSoft : Color.white)
                        }
                        .buttonStyle(FadePress())
                    }
                }
                .padding(.bottom, tabBarSpace)
            }
            .scrollIndicators(.hidden)
        }
        .background(Color.white)
        .task(id: "\(app.userId)-\(app.version)") {
            home = nil
            await load()
        }
        .onTableChange("plans") { Task { await load() } }
    }

    private func load() async {
        let user = app.userId
        let h: MusingHome? = try? await API.get("/api/musing/home", user: user)
        guard user == app.userId, !Task.isCancelled, let h else { return }
        home = h
    }

    @ViewBuilder private func avatar(_ who: NoteRow.Who) -> some View {
        switch who {
        case .person(let p): Avatar(p, size: 62)
        case .muse: MuseAvatar(size: 62)
        case .image(let path): Pic(path: path).frame(width: 62, height: 62).clipShape(Circle())
        case .facebook: Circle().fill(FB.blue).frame(width: 62, height: 62).overlay(Text("f").font(.system(size: 46, weight: .heavy)).foregroundStyle(.white).offset(y: 4))
        }
    }
}
