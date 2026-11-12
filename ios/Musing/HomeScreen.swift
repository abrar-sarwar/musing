import SwiftUI

struct FeedItem: Identifiable {
    let id: String
    let author: User
    let body: String
    let createdAt: Date
    var image: String?
    var ratio: CGFloat = 1
    var context: String?
}

struct StoryRef: Identifiable {
    let user: User
    let media: String
    var id: String { user.id }
}

struct HomeScreen: View {
    @EnvironmentObject var app: AppState
    @State private var posts: [Post] = []
    @State private var loaded = false
    @State private var error: String?
    @State private var composing = false
    @State private var draft = ""
    @State private var mine: [FeedItem] = []
    @State private var hidden: Set<String> = []
    @State private var story: StoryRef?

    private var items: [FeedItem] {
        let seeded = posts.compactMap { p -> FeedItem? in
            guard let author = app.user(p.authorId) else { return nil }
            let extra = Mock.postExtras[p.authorId]
            return FeedItem(id: p.id, author: author, body: p.body, createdAt: parseDate(p.createdAt) ?? .now, image: extra?.image, ratio: extra?.ratio ?? 1, context: extra?.context)
        }
        let extra = Mock.extraPosts.compactMap { p -> FeedItem? in
            guard let author = app.user(p.authorId) else { return nil }
            return FeedItem(id: p.id, author: author, body: p.body, createdAt: Date().addingTimeInterval(-p.hoursAgo * 3600), image: p.image, ratio: p.ratio)
        }
        return mine + (seeded + extra).filter { !hidden.contains($0.id) }.sorted { $0.createdAt > $1.createdAt }
    }

    private var storyUsers: [User] {
        Array(app.users.filter { $0.id != app.userId && Mock.storyMedia[$0.id] != nil }.prefix(9))
    }

    var body: some View {
        VStack(spacing: 0) {
            FbHeader(actions: [.create, .search, .messenger], onCreate: { composing = true })
            ScrollView {
                LazyVStack(spacing: 0) {
                    composerRow
                    MusingHomeCard()
                    stories
                    Band()
                    let list = items
                    if list.isEmpty {
                        if let error { Text("Couldn't load the feed: \(error)").foregroundStyle(FB.muted).padding(24) } else if !loaded { FeedSkeleton() }
                    }
                    ForEach(Array(list.enumerated()), id: \.element.id) { i, item in
                        // the musing. unit sits one post down, like any suggested unit
                        if i == 1 { MusingFeedUnit() }
                        FeedPostView(post: item, onHide: { hidden.insert(item.id) })
                        Band()
                    }
                    if list.count == 1 { MusingFeedUnit() }
                }
                .padding(.bottom, tabBarSpace)
            }
            .scrollIndicators(.hidden)
            .refreshable { await load() }
        }
        .background(Color.white)
        .task(id: app.version) {
            posts = []
            loaded = false
            await load()
        }
        .sheet(isPresented: $composing) { composerSheet }
        .fullScreenCover(item: $story) { s in StoryViewer(story: s) }
    }

    private func load() async {
        do {
            let rows: [Post] = try await Supa.select("posts", "select=*&order=created_at.desc")
            guard !Task.isCancelled else { return }
            posts = rows
            error = nil
        } catch let e {
            guard !Task.isCancelled else { return }
            error = errorText(e)
        }
        loaded = true
    }

    private var composerRow: some View {
        Button { composing = true } label: {
            HStack(spacing: 12) {
                if let me = app.me { Avatar(me, size: 42) } else { Circle().fill(FB.input).frame(width: 42, height: 42) }
                Text("What's on your mind?").font(.system(size: 17)).foregroundStyle(FB.text)
                Spacer()
                Image(systemName: "photo").font(.system(size: 22)).foregroundStyle(FB.muted)
            }
            .padding(.horizontal, 14).padding(.top, 4).padding(.bottom, 10)
        }
        .buttonStyle(FadePress())
        .accessibilityLabel("Create a post")
    }

    private var stories: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 6) {
                if let me = app.me {
                    let media = Mock.storyMedia[me.id] ?? "cover/hills.jpg"
                    StoryCard(user: me, media: media, label: "Your story", seen: true) { story = StoryRef(user: me, media: media) }
                }
                if app.users.isEmpty {
                    ForEach(0..<4, id: \.self) { _ in RoundedRectangle(cornerRadius: 14).fill(FB.input).frame(width: 118, height: 200) }
                }
                ForEach(storyUsers) { u in
                    let media = Mock.storyMedia[u.id] ?? "cover/hills.jpg"
                    StoryCard(user: u, media: media, label: u.name, seen: false) { story = StoryRef(user: u, media: media) }
                }
            }
            .padding(.horizontal, 10).padding(.bottom, 12)
        }
        .scrollIndicators(.hidden)
    }

    private var canPost: Bool { !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    // facebook-style post composer sheet
    private var composerSheet: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Button { composing = false } label: { Image(systemName: "xmark").font(.system(size: 19, weight: .semibold)).foregroundStyle(FB.text) }
                    .accessibilityLabel("Close")
                Spacer()
                Text("Create post").font(.system(size: 18, weight: .bold)).foregroundStyle(FB.text)
                Spacer()
                Button(action: publish) {
                    Text("Post").font(.system(size: 15, weight: .bold)).foregroundStyle(canPost ? Color.white : FB.muted)
                        .padding(.horizontal, 14).frame(height: 34).background(canPost ? FB.blue : FB.button, in: RoundedRectangle(cornerRadius: 8))
                }
                .disabled(!canPost)
            }
            .padding(.horizontal, 14).frame(height: 56)
            Hairline()
            HStack(spacing: 10) {
                if let me = app.me { Avatar(me, size: 44) }
                VStack(alignment: .leading, spacing: 2) {
                    Text(app.me?.name ?? "").font(.system(size: 16, weight: .bold)).foregroundStyle(FB.text)
                    Label("Friends", systemImage: "person.2.fill").font(.system(size: 12, weight: .semibold)).foregroundStyle(FB.text)
                        .padding(.horizontal, 6).padding(.vertical, 2).background(FB.button, in: RoundedRectangle(cornerRadius: 6))
                }
            }
            .padding(14)
            TextField("What's on your mind?", text: $draft, axis: .vertical)
                .font(.system(size: 22)).foregroundStyle(FB.text).padding(.horizontal, 14)
                .frame(maxHeight: .infinity, alignment: .top)
                .composerFocus()
        }
        .background(Color.white)
    }

    private func publish() {
        guard let me = app.me, canPost else { return }
        mine.insert(FeedItem(id: "local-\(Date().timeIntervalSince1970)", author: me, body: draft.trimmingCharacters(in: .whitespacesAndNewlines), createdAt: .now), at: 0)
        draft = ""
        composing = false
        toast("Posted. Local to this device, it resets with the demo.")
    }
}

/// focuses a text field as soon as it appears
private struct ComposerFocus: ViewModifier {
    @FocusState private var focused: Bool
    func body(content: Content) -> some View {
        content.focused($focused).onAppear { focused = true }
    }
}

extension View {
    func composerFocus() -> some View { modifier(ComposerFocus()) }
}

// facebook-style placeholder posts while the feed loads. home is usable right away.
struct FeedSkeleton: View {
    var body: some View {
        VStack(spacing: 0) {
            ForEach(0..<2, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 10) {
                        Circle().fill(FB.input).frame(width: 42, height: 42)
                        VStack(alignment: .leading, spacing: 6) {
                            Capsule().fill(FB.input).frame(width: 140, height: 10)
                            Capsule().fill(FB.input).frame(width: 80, height: 10)
                        }
                    }
                    .padding(.horizontal, 14)
                    Capsule().fill(FB.input).frame(height: 10).padding(.leading, 14).padding(.trailing, 80)
                    FB.input.frame(height: 220)
                }
                .padding(.top, 12)
                Band()
            }
        }
    }
}

// one tall story tile: media, ringed avatar top left, name over a dark gradient.
struct StoryCard: View {
    let user: User
    let media: String
    let label: String
    let seen: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack(alignment: .topLeading) {
                Pic(path: media)
                LinearGradient(stops: [.init(color: .black.opacity(0.25), location: 0), .init(color: .clear, location: 0.4), .init(color: .black.opacity(0.6), location: 1)], startPoint: .top, endPoint: .bottom)
                VStack(alignment: .leading) {
                    Avatar(user, size: 34).padding(1.5).background(Color.white.opacity(0.9), in: Circle())
                        .overlay(Circle().stroke(seen ? Color.white.opacity(0.7) : FB.blue, lineWidth: 3))
                    Spacer()
                    Text(label).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(.white).lineLimit(2).multilineTextAlignment(.leading)
                        .shadow(color: .black.opacity(0.5), radius: 3)
                }
                .padding(8)
            }
            .frame(width: 118, height: 200)
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(FadePress())
        .accessibilityLabel("\(label) story")
    }
}

struct StoryViewer: View {
    @Environment(\.dismiss) private var dismiss
    let story: StoryRef

    var body: some View {
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()
            Pic(path: story.media).ignoresSafeArea()
            VStack(spacing: 0) {
                Capsule().fill(Color.white.opacity(0.85)).frame(height: 3).padding(.horizontal, 10).padding(.top, 6)
                HStack(spacing: 8) {
                    Avatar(story.user, size: 38)
                    Text(story.user.name).font(.system(size: 16, weight: .bold)).foregroundStyle(.white)
                    Text("3h").font(.system(size: 14)).foregroundStyle(.white.opacity(0.8))
                    Spacer()
                    Image(systemName: "xmark").font(.system(size: 20, weight: .semibold)).foregroundStyle(.white)
                }
                .padding(12)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { dismiss() }
        .accessibilityLabel("Close story")
    }
}

// a facebook feed post: header, caption, edge-to-edge media, reactions, actions.
struct FeedPostView: View {
    let post: FeedItem
    var onHide: (() -> Void)?
    @State private var liked = false

    var body: some View {
        let base = 4 + stableHash(post.id) % 60
        let comments = stableHash(post.id + "c") % 14
        let shares = stableHash(post.id + "s") % 5
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 10) {
                Avatar(post.author, size: 42)
                VStack(alignment: .leading, spacing: 1) {
                    richText([Mock.Part(t: post.author.name, b: true)] + (post.context.map { [Mock.Part(t: " " + $0)] } ?? []), size: 15.5)
                    HStack(spacing: 3) {
                        Text("\(timeAgo(post.createdAt)) ·").font(.system(size: 13)).foregroundStyle(FB.muted)
                        Image(systemName: "globe.americas.fill").font(.system(size: 11)).foregroundStyle(FB.muted)
                    }
                }
                Spacer(minLength: 0)
                Button { toast("Post options are mocked in this prototype.") } label: { Image(systemName: "ellipsis").font(.system(size: 18, weight: .semibold)).foregroundStyle(FB.muted).frame(width: 28, height: 28) }
                    .accessibilityLabel("Post options")
                if let onHide {
                    Button(action: onHide) { Image(systemName: "xmark").font(.system(size: 17, weight: .medium)).foregroundStyle(FB.muted).frame(width: 28, height: 28) }
                        .accessibilityLabel("Hide post")
                }
            }
            .padding(.horizontal, 14)
            Text(post.body).font(.system(size: 16)).lineSpacing(2).foregroundStyle(FB.text)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 14).padding(.top, 8).padding(.bottom, 10)
            if let image = post.image {
                Pic(path: image).aspectRatio(post.ratio, contentMode: .fit)
            }
            HStack(spacing: 6) {
                Circle().fill(FB.blue).frame(width: 19, height: 19).overlay(Image(systemName: "hand.thumbsup.fill").font(.system(size: 9)).foregroundStyle(.white))
                Text("\(base + (liked ? 1 : 0))")
                Spacer()
                Text([comments > 0 ? "\(comments) comments" : nil, shares > 0 ? "\(shares) shares" : nil].compactMap { $0 }.joined(separator: " · "))
            }
            .font(.system(size: 14)).foregroundStyle(FB.muted)
            .padding(.horizontal, 14).padding(.vertical, 9)
            Hairline().padding(.horizontal, 14)
            HStack(spacing: 0) {
                action(liked ? "hand.thumbsup.fill" : "hand.thumbsup", "Like", active: liked) { liked.toggle() }
                action("bubble.right", "Comment") { toast("Comments are mocked in this prototype.") }
                action("arrowshape.turn.up.right", "Share") { toast("Sharing is mocked in this prototype.") }
            }
            .padding(.horizontal, 14).padding(.vertical, 2)
        }
        .padding(.top, 12)
        .background(Color.white)
    }

    private func action(_ icon: String, _ label: String, active: Bool = false, _ run: @escaping () -> Void) -> some View {
        Button(action: run) {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.system(size: 17))
                Text(label).font(.system(size: 14.5, weight: .semibold))
            }
            .foregroundStyle(active ? FB.blue : FB.muted)
            .frame(maxWidth: .infinity).padding(.vertical, 9)
        }
        .buttonStyle(RowPress())
        .accessibilityLabel(label)
    }
}

// ---------- musing. on facebook home ----------

private struct HomeState {
    let headline: String
    let sub: String
    let action: String
    var planId: String?
    /// no plan yet: the action reopens the composer with this thought
    var thought: String?
}

// pick the single most useful thing to say, from data the server already shaped for
// this person. counts only before a plan is on. never who answered, never a limit.
private func pickHomeState(_ home: MusingHome?) -> HomeState? {
    guard let home else { return nil }
    if let ask = home.asks.first(where: { $0.state == "proposing" && $0.me?.status == "pending" }) {
        return HomeState(headline: "\(firstName(ask.starter.name).lowercased()) has a move you might be into.", sub: "\(ask.activity ?? "something"), \(ask.when ?? "soon"). your answer stays private.", action: "see the ask", planId: ask.id)
    }
    if let on = home.mine.first(where: { $0.state == "happening" }) {
        return HomeState(headline: "your \(on.activity ?? "plan") is happening.", sub: "\(on.when ?? "soon"). the chat and the event are ready.", action: "check the plan", planId: on.id)
    }
    if let open = home.mine.first(where: { $0.state == "proposing" }) {
        return HomeState(headline: "your \(open.activity ?? "") plan is coming together.", sub: "\(open.downCount) of \(open.quorum) in so far. names show once it's on.", action: "check the plan", planId: open.id)
    }
    if let draft = home.mine.first(where: { $0.state == "draft" }) {
        return HomeState(headline: "still thinking about \(draft.activity ?? "it")?", sub: "muse might've found a move with your friends.", action: "see the mix", planId: draft.id)
    }
    // a thought from the last few days that never became a plan. older ones stay quiet.
    if let recent = home.muses.first(where: { m in parseDate(m.createdAt).map { Date().timeIntervalSince($0) < 3 * 86400 } ?? false }) {
        return HomeState(headline: "still thinking about \(recent.understood?.activity ?? "that thought")?", sub: "pick it back up and muse will find a move with your friends.", action: Copy.runItBack, thought: recent.rawText)
    }
    return nil
}

// the musing. entry point on facebook home, directly under the composer. one tap
// opens the signal composer with the keyboard up. it is always there, never a pop-up.
struct MusingHomeCard: View {
    @EnvironmentObject var app: AppState
    @State private var home: MusingHome?

    private static let chips = [("thrifting", "lowkey wanna go thrifting"), ("food run", "anyone down for food later?"), ("weekend plans", "need something to do this weekend")]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 4) {
                Image(systemName: "sparkles").font(.system(size: 12, weight: .bold)).foregroundStyle(Muse.start)
                Text(Copy.brand).font(.system(size: 13.5, weight: .heavy)).foregroundStyle(Muse.start)
                if !app.settings.museOn { Text("muse is off · plain poll").font(.system(size: 12)).foregroundStyle(FB.muted).padding(.leading, 6) }
            }
            if let state = pickHomeState(home) {
                Text(state.headline).font(.system(size: 19, weight: .heavy)).foregroundStyle(FB.text).lineLimit(2).minimumScaleFactor(0.9).padding(.top, 2)
                Text(state.sub).font(.system(size: 13.5)).foregroundStyle(FB.muted).lineLimit(1).minimumScaleFactor(0.85).padding(.top, 1)
                HStack(spacing: 8) {
                    cta(state.action) {
                        if let id = state.planId { app.push(.plan(id)) } else { compose(state.thought) }
                    }
                    Button { compose(nil) } label: { Text("new thought").font(.system(size: 14.5, weight: .semibold)).foregroundStyle(FB.blue).padding(.horizontal, 6) }
                        .accessibilityLabel("start a new thought")
                }
                .padding(.top, 8)
            } else {
                Text(Copy.composerPlaceholder).font(.system(size: 19, weight: .heavy)).foregroundStyle(FB.text).padding(.top, 2)
                Text("that random thought? let's make it happen with friends.").font(.system(size: 13.5)).foregroundStyle(FB.muted).lineLimit(1).minimumScaleFactor(0.85).padding(.top, 1)
                HStack(spacing: 8) {
                    Button { compose(nil) } label: {
                        Text("lowkey wanna do something this weekend...").font(.system(size: 14.5)).foregroundStyle(FB.muted).lineLimit(1)
                            .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 14).frame(height: 36).background(FB.input, in: Capsule())
                    }
                    .buttonStyle(FadePress()).accessibilityLabel("type a thought for muse")
                    cta("make a move") { compose(nil) }
                }
                .padding(.top, 8)
                HStack(spacing: 6) {
                    ForEach(Self.chips, id: \.0) { chip in
                        Button { compose(chip.1) } label: {
                            Text(chip.0).font(.system(size: 13, weight: .semibold)).foregroundStyle(FB.text)
                                .padding(.horizontal, 11).padding(.vertical, 4).overlay(Capsule().stroke(FB.button, lineWidth: 1))
                        }
                        .buttonStyle(FadePress()).accessibilityLabel("start with \(chip.0)")
                    }
                }
                .padding(.top, 7)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 12).padding(.top, 9).padding(.bottom, 10)
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(FB.button, lineWidth: 1))
        .padding(.horizontal, 12).padding(.bottom, 12)
        // paint from the last good answer for this person, then refresh in the background.
        // this endpoint is database only, so opening home never costs a muse call.
        .task(id: "\(app.userId)-\(app.version)") {
            home = UserDefaults.standard.data(forKey: cacheKey(app.userId)).flatMap { try? API.decoder.decode(MusingHome.self, from: $0) }
            await refresh()
        }
        .onTableChange("plans") { Task { await refresh() } }
    }

    private func cacheKey(_ user: String) -> String { "musing_home_\(user)" }

    private func refresh() async {
        let user = app.userId
        guard let data = try? await API.data("GET", "/api/musing/home", user: user), let h = try? API.decoder.decode(MusingHome.self, from: data) else { return }
        // only the newest acting user may write. a slow answer for the previous person is dropped.
        guard user == app.userId, !Task.isCancelled else { return }
        home = h
        UserDefaults.standard.set(data, forKey: cacheKey(user))
    }

    private func compose(_ thought: String?) {
        if let thought { app.handoff = thought }
        app.push(.musing(compose: true))
    }

    private func cta(_ label: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label).font(.system(size: 14.5, weight: .bold)).foregroundStyle(.white).padding(.horizontal, 16).frame(height: 36).background(Muse.entryGradient, in: Capsule())
        }
        .buttonStyle(FadePress())
    }
}

// one musing. unit in feed, styled like a suggested post. it is the friends overlap:
// a count and a topic, never who.
struct MusingFeedUnit: View {
    @EnvironmentObject var app: AppState
    @State private var overlap: Overlap?

    var body: some View {
        Group {
            if app.settings.museOn, let overlap {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 10) {
                        MuseAvatar(size: 42)
                        VStack(alignment: .leading, spacing: 0) {
                            Text(Copy.brand).font(.system(size: 15.5, weight: .bold)).foregroundStyle(FB.text)
                            Text("Suggested for you · only you can see this").font(.system(size: 13)).foregroundStyle(FB.muted)
                        }
                    }
                    .padding(.horizontal, 14)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(overlap.count) of your friends are into \(overlap.topic) lately").font(.system(size: 18, weight: .bold)).foregroundStyle(FB.text)
                        Text("want muse to make it a thing? nobody finds out who.").font(.system(size: 15)).foregroundStyle(FB.muted)
                        Button {
                            app.handoff = "\(overlap.topic) with whoever's into it"
                            app.push(.musing(compose: true))
                        } label: {
                            Text("make a move").font(.system(size: 15, weight: .bold)).foregroundStyle(Muse.text)
                                .frame(maxWidth: .infinity).frame(height: 38).background(Muse.soft, in: RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(FadePress()).padding(.top, 8)
                    }
                    .padding(14)
                    .background(Muse.softer, in: RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Muse.line, lineWidth: 1))
                    .padding(.horizontal, 14).padding(.top, 10)
                }
                .padding(.top, 12).padding(.bottom, 14)
                Band()
            }
        }
        .task(id: "\(app.userId)-\(app.version)") {
            overlap = nil
            let r: OverlapResponse? = try? await API.get("/api/overlap", user: app.userId)
            guard !Task.isCancelled else { return }
            overlap = r?.overlap
        }
    }
}
