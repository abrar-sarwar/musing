import SwiftUI

// a personal facebook profile: cover, overlapping avatar, identity, actions, tabs.
// `isSelf` is the acting user's own profile (the profile tab); otherwise a friend's.
struct ProfileView: View {
    @EnvironmentObject var app: AppState
    let user: User
    let isSelf: Bool
    @State private var tab = "All"
    @State private var editing = false
    @State private var bio: String
    @State private var draftBio = ""
    @State private var friendIds: [String] = []
    @State private var posts: [Post] = []
    @State private var topics: [String] = []
    @State private var real: PlanView?

    private let tabs = ["All", "Photos", "Reels", "Memories"]
    private let three = [GridItem(.flexible(), spacing: 3), GridItem(.flexible(), spacing: 3), GridItem(.flexible(), spacing: 3)]

    init(user: User, isSelf: Bool) {
        self.user = user
        self.isSelf = isSelf
        _bio = State(initialValue: user.bio ?? "")
    }

    private var info: Mock.Profile { Mock.profiles[user.id] ?? Mock.defaultProfile }
    private var friends: [User] { app.users.filter { friendIds.contains($0.id) } }

    private var feed: [FeedItem] {
        let seeded = posts.map { p -> FeedItem in
            let extra = Mock.postExtras[p.authorId]
            return FeedItem(id: p.id, author: user, body: p.body, createdAt: parseDate(p.createdAt) ?? .now, image: extra?.image, ratio: extra?.ratio ?? 1, context: extra?.context)
        }
        let extra = Mock.extraPosts.filter { $0.authorId == user.id }.map { FeedItem(id: $0.id, author: user, body: $0.body, createdAt: Date().addingTimeInterval(-$0.hoursAgo * 3600), image: $0.image, ratio: $0.ratio) }
        let own = user.id == "maya" ? [FeedItem(id: "p-maya-film", author: user, body: "First roll back from the lab. The light leak is a feature.", createdAt: Date().addingTimeInterval(-50 * 3600), image: Mock.profilePhotos[0], ratio: 1)] : []
        return seeded + extra + own
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                Pic(path: info.cover).frame(height: 310)
                    .overlay(alignment: .top) { LinearGradient(colors: [.black.opacity(0.45), .clear], startPoint: .top, endPoint: .bottom).frame(height: 130) }
                    .overlay(alignment: .top) { coverBar.padding(.top, 60).padding(.horizontal, 12) }
                identity
                    .background(Color.white, in: UnevenRoundedRectangle(topLeadingRadius: 22, topTrailingRadius: 22))
                    .padding(.top, -34)
                switch tab {
                case "Photos": photos.padding(.top, 8)
                case "Reels": reelsGrid
                case "Memories": memory
                default: allTab
                }
            }
            .padding(.bottom, tabBarSpace)
        }
        .scrollIndicators(.hidden)
        .ignoresSafeArea(edges: .top)
        .background(Color.white)
        .toolbar(.hidden, for: .navigationBar)
        .task(id: app.version) { await load() }
        .sheet(isPresented: $editing) { editSheet }
    }

    private func load() async {
        async let edges: [FriendEdge]? = try? Supa.select("friendships", "select=friend_id&user_id=eq.\(user.id)")
        async let own: [Post]? = try? Supa.select("posts", "select=*&author_id=eq.\(user.id)&order=created_at.desc")
        async let reels: [TopicRow]? = try? Supa.select("reels_topics", "select=topic&user_id=eq.\(user.id)&order=score.desc")
        // a finished musing. plan shows up as ordinary profile activity. own profile only.
        async let home: MusingHome? = isSelf ? try? API.get("/api/musing/home", user: app.userId) : nil
        let (e, p, t, h) = await (edges, own, reels, home)
        guard !Task.isCancelled else { return }
        friendIds = (e ?? []).map(\.friendId)
        posts = p ?? []
        topics = (t ?? []).map(\.topic)
        real = h?.mine.first { $0.state == "happening" }
    }

    private var coverBar: some View {
        HStack(spacing: 18) {
            Button { if isSelf { app.push(.menu) } else { app.back() } } label: { Image(systemName: isSelf ? "line.3.horizontal" : "chevron.left").font(.system(size: 24, weight: .semibold)) }
                .accessibilityLabel(isSelf ? "Menu" : "Back")
            Spacer()
            if isSelf {
                Button { toast("Cover photo editing is mocked in this prototype.") } label: { Image(systemName: "pencil").font(.system(size: 21, weight: .medium)) }.accessibilityLabel("Edit cover")
            }
            Button { app.push(.search) } label: { Image(systemName: "magnifyingglass").font(.system(size: 22, weight: .medium)) }.accessibilityLabel("Search")
            Button { toast("Profile settings are mocked in this prototype.") } label: { Image(systemName: "ellipsis.circle").font(.system(size: 22, weight: .medium)) }.accessibilityLabel("More")
        }
        .foregroundStyle(.white).shadow(color: .black.opacity(0.35), radius: 3)
    }

    private var identity: some View {
        VStack(spacing: 0) {
            Avatar(user, size: 178).padding(5).background(Color.white, in: Circle())
                .overlay(alignment: .bottomTrailing) {
                    if isSelf {
                        Button { toast("Profile photo editing is mocked in this prototype.") } label: {
                            Circle().fill(FB.button).frame(width: 38, height: 38).overlay(Image(systemName: "camera.fill").font(.system(size: 15)).foregroundStyle(FB.text)).overlay(Circle().stroke(Color.white, lineWidth: 2))
                        }
                        .accessibilityLabel("Change profile photo").offset(x: -8, y: -12)
                    }
                }
                .padding(.top, -112)
            HStack(spacing: 6) {
                Text(user.name).font(.system(size: 25, weight: .heavy)).tracking(-0.4).foregroundStyle(FB.text)
                Image(systemName: "checkmark.circle").font(.system(size: 17)).foregroundStyle(FB.text)
            }
            .frame(maxWidth: .infinity)
            .overlay(alignment: .trailing) {
                if isSelf {
                    Button { app.switcherOpen = true } label: { Circle().fill(FB.button).frame(width: 38, height: 38).overlay(Image(systemName: "chevron.down").font(.system(size: 16, weight: .semibold)).foregroundStyle(FB.text)) }
                        .accessibilityLabel("Switch account").padding(.trailing, 14)
                }
            }
            .padding(.top, 8)
            Text("\(friends.count) friends").font(.system(size: 15.5, weight: .bold)).foregroundStyle(FB.text).padding(.top, 4)
            if !bio.isEmpty { Text(bio).font(.system(size: 15)).foregroundStyle(FB.text).multilineTextAlignment(.center).padding(.horizontal, 30).padding(.top, 8) }
            HStack(spacing: 4) {
                Image(systemName: "mappin").font(.system(size: 14))
                Text("\(info.city.split(separator: ",").first.map(String.init) ?? info.city), GA ·")
                Image(systemName: "graduationcap.fill").font(.system(size: 14))
                Text(info.school).lineLimit(1)
            }
            .font(.system(size: 15, weight: .bold)).foregroundStyle(FB.text).padding(.top, 14).padding(.horizontal, 14)

            HStack(spacing: 0) {
                HStack(spacing: -10) {
                    ForEach(Array(friends.prefix(3))) { f in Avatar(f, size: 36).overlay(Circle().stroke(Color.white, lineWidth: 2)) }
                }
                Text(isSelf ? "Friends with things in common" : "\(min(friends.count, 4)) mutual friends").font(.system(size: 15)).foregroundStyle(FB.text).padding(.leading, 8)
                Spacer()
            }
            .padding(.horizontal, 14).padding(.top, 14)

            HStack(spacing: 10) {
                if isSelf {
                    wide("plus.circle", "Add to story", primary: true) { toast("Added to your story. Mock only.") }
                    wide("pencil", "Edit profile") {
                        draftBio = bio
                        editing = true
                    }
                } else {
                    wide("person.fill.checkmark", "Friends", primary: true) { toast("You're already friends in the mock data.") }
                    wide("message.fill", "Message") { app.push(.messages) }
                }
            }
            .padding(.horizontal, 14).padding(.top, 14)

            ScrollView(.horizontal) {
                HStack(spacing: 6) {
                    ForEach(tabs, id: \.self) { t in
                        Button { tab = t } label: {
                            Text(t).font(.system(size: 17, weight: .semibold)).foregroundStyle(tab == t ? FB.blue : FB.text)
                                .padding(.horizontal, 16).frame(height: 40).background(tab == t ? FB.blueSoft : .clear, in: Capsule())
                        }
                        .buttonStyle(FadePress())
                    }
                }
                .padding(.horizontal, 14).padding(.top, 16).padding(.bottom, 4)
            }
            .scrollIndicators(.hidden)
        }
        .padding(.bottom, 6)
    }

    private func wide(_ icon: String, _ label: String, primary: Bool = false, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.system(size: 16, weight: .semibold))
                Text(label).font(.system(size: 16, weight: .bold))
            }
            .foregroundStyle(primary ? Color.white : FB.text).frame(maxWidth: .infinity).frame(height: 42)
            .background(primary ? FB.blue : FB.button, in: RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(FadePress())
    }

    private func section<C: View>(_ title: String, right: String? = nil, onEdit: (() -> Void)? = nil, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title).font(.system(size: 19, weight: .bold)).foregroundStyle(FB.text)
                Spacer()
                if let right { Text(right).font(.system(size: 15)).foregroundStyle(FB.muted) }
                if let onEdit { Button(action: onEdit) { Image(systemName: "pencil").font(.system(size: 19)).foregroundStyle(FB.muted) }.accessibilityLabel("Edit \(title)") }
            }
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 14).padding(.top, 16)
    }

    private func detail(_ icon: String, _ text: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon).font(.system(size: 22)).foregroundStyle(FB.text).frame(width: 46)
            Text(text).font(.system(size: 17, weight: .semibold)).foregroundStyle(FB.text)
        }
        .padding(.vertical, 9)
    }

    private var photos: some View {
        LazyVGrid(columns: three, spacing: 3) {
            ForEach(Mock.profilePhotos, id: \.self) { p in Pic(path: p).aspectRatio(1, contentMode: .fit) }
        }
    }

    @ViewBuilder private var allTab: some View {
        let list = feed
        section("Personal details", onEdit: isSelf ? { toast("Editing details is mocked in this prototype.") } : nil) {
            detail("mappin.circle", info.city)
            detail("birthday.cake", info.birthday)
        }
        section("Education", onEdit: isSelf ? { toast("Editing education is mocked in this prototype.") } : nil) {
            HStack(spacing: 14) {
                Circle().fill(Color(hex: 0x12379b)).frame(width: 46, height: 46).overlay(Image(systemName: "graduationcap.fill").font(.system(size: 18)).foregroundStyle(.white))
                VStack(alignment: .leading, spacing: 1) {
                    Text(info.school).font(.system(size: 17, weight: .semibold)).foregroundStyle(FB.text)
                    Text("Started August 2022").font(.system(size: 14)).foregroundStyle(FB.muted)
                }
            }
            .padding(.vertical, 9)
        }
        section("Friends", right: "\(friends.count) friends") {
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                ForEach(Array(friends.prefix(6))) { f in
                    Button { app.push(.person(f.id)) } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Pic(path: avatarPath(f.name)).aspectRatio(1, contentMode: .fit).clipShape(RoundedRectangle(cornerRadius: 10))
                            Text(f.name).font(.system(size: 14, weight: .semibold)).foregroundStyle(FB.text).lineLimit(1)
                        }
                    }
                    .buttonStyle(FadePress())
                }
            }
        }
        section("Photos") { photos }
        Band().padding(.top, 14)
        Text("Posts").font(.system(size: 19, weight: .bold)).foregroundStyle(FB.text).frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 14).padding(.top, 14)
        if let real {
            Button { if let id = real.eventId { app.push(.event(id)) } } label: {
                HStack(spacing: 10) {
                    Avatar(user, size: 42)
                    VStack(alignment: .leading, spacing: 1) {
                        richText([Mock.Part(t: user.name, b: true), Mock.Part(t: " is going to an event with \(max((real.going?.count ?? 1) - 1, 0)) friends.")], size: 15.5).multilineTextAlignment(.leading)
                        Text("\(real.activity ?? "") · \(real.when ?? "") · made with musing.").font(.system(size: 14)).foregroundStyle(FB.muted)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right").font(.system(size: 15, weight: .semibold)).foregroundStyle(FB.muted)
                }
                .padding(.horizontal, 14).padding(.top, 12)
            }
            .buttonStyle(FadePress())
        }
        ForEach(list) { p in
            Band().padding(.top, 14)
            FeedPostView(post: p)
        }
        if list.isEmpty && real == nil { Text("No posts yet.").foregroundStyle(FB.muted).padding(24) }
    }

    @ViewBuilder private var reelsGrid: some View {
        if topics.isEmpty {
            Text("No reels yet.").foregroundStyle(FB.muted).padding(24)
        } else {
            LazyVGrid(columns: three, spacing: 3) {
                ForEach(Array(topics.enumerated()), id: \.element) { i, t in
                    Button { app.go(.reels) } label: {
                        Pic(path: reelPoster(t, variant: i)).aspectRatio(9 / 16, contentMode: .fit)
                            .overlay(alignment: .bottomLeading) {
                                Text("#" + t.filter { !$0.isWhitespace }).font(.system(size: 13, weight: .bold)).foregroundStyle(.white).shadow(color: .black.opacity(0.7), radius: 4).padding(6)
                            }
                    }
                    .buttonStyle(FadePress())
                }
            }
            .padding(.top, 8)
        }
    }

    private var memory: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("On this day, 1 year ago").font(.system(size: 17, weight: .bold)).foregroundStyle(FB.text)
            Pic(path: Mock.profilePhotos[3]).aspectRatio(4 / 3, contentMode: .fit).clipShape(RoundedRectangle(cornerRadius: 10))
            Text("Golden hour at the reservoir with the whole crew.").font(.system(size: 16)).foregroundStyle(FB.text)
            Button { toast("Sharing memories is mocked in this prototype.") } label: {
                Text("Share").font(.system(size: 16, weight: .bold)).foregroundStyle(FB.text).frame(maxWidth: .infinity).frame(height: 40).background(FB.button, in: RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(FadePress())
        }
        .padding(14)
    }

    private var editSheet: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Button("Cancel") { editing = false }.font(.system(size: 17)).foregroundStyle(FB.text)
                Spacer()
                Text("Edit profile").font(.system(size: 18, weight: .bold)).foregroundStyle(FB.text)
                Spacer()
                Button("Save") {
                    bio = draftBio.trimmingCharacters(in: .whitespacesAndNewlines)
                    editing = false
                    toast("Saved on this device. Mock only.")
                }
                .font(.system(size: 17, weight: .bold)).foregroundStyle(FB.blue)
            }
            .padding(.horizontal, 16).frame(height: 56)
            Hairline()
            Avatar(user, size: 120).frame(maxWidth: .infinity).padding(20)
            Text("Bio").font(.system(size: 17, weight: .bold)).foregroundStyle(FB.text).padding(.horizontal, 16)
            TextField("Describe yourself", text: $draftBio, axis: .vertical).lineLimit(3...6).font(.system(size: 16)).foregroundStyle(FB.text)
                .padding(12).background(FB.input, in: RoundedRectangle(cornerRadius: 10)).padding(16)
                .onChange(of: draftBio) { if draftBio.count > 101 { draftBio = String(draftBio.prefix(101)) } }
            Text("Prototype only. Changes stay on this device and reset with the demo.").font(.system(size: 13)).foregroundStyle(FB.muted).padding(.horizontal, 16)
            Spacer()
        }
        .background(Color.white)
    }
}

// a friend's profile, pushed from search, a listing or a friends grid.
struct PersonScreen: View {
    @EnvironmentObject var app: AppState
    let personId: String

    var body: some View {
        if let user = app.user(personId) {
            ProfileView(user: user, isSelf: user.id == app.userId).id(user.id)
        } else {
            SubScreen(title: "Profile") { Text("This profile isn't available.").foregroundStyle(FB.muted).padding(24) }
        }
    }
}

// search over the mock data: seeded people and marketplace listings.
struct SearchScreen: View {
    @EnvironmentObject var app: AppState
    @State private var q = ""

    var body: some View {
        let term = q.trimmingCharacters(in: .whitespaces).lowercased()
        let people = Array(app.users.filter { term.isEmpty || $0.name.lowercased().contains(term) || $0.interests.contains { $0.contains(term) } }.prefix(term.isEmpty ? 6 : 12))
        let listings = term.isEmpty ? [] : Array(Mock.listings.filter { $0.title.lowercased().contains(term) || $0.category.lowercased().contains(term) }.prefix(8))
        VStack(spacing: 0) {
            HStack(spacing: 4) {
                Button { app.back() } label: { Image(systemName: "chevron.left").font(.system(size: 22, weight: .semibold)).foregroundStyle(FB.text).frame(width: 36, height: 40) }
                    .accessibilityLabel("Back")
                HStack(spacing: 6) {
                    Image(systemName: "magnifyingglass").font(.system(size: 16)).foregroundStyle(FB.muted)
                    TextField("Search Facebook", text: $q).font(.system(size: 16)).foregroundStyle(FB.text)
                        .textInputAutocapitalization(.never).autocorrectionDisabled().submitLabel(.search).composerFocus()
                }
                .padding(.horizontal, 12).frame(height: 40).background(FB.input, in: Capsule()).padding(.trailing, 10)
            }
            .padding(.horizontal, 6).padding(.bottom, 8)
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    heading(term.isEmpty ? "Suggested" : "People")
                    ForEach(people) { u in
                        Button { app.push(.person(u.id)) } label: {
                            HStack(spacing: 12) {
                                Avatar(u, size: 44)
                                VStack(alignment: .leading, spacing: 0) {
                                    Text(u.name).font(.system(size: 16, weight: .semibold)).foregroundStyle(FB.text)
                                    Text(u.bio ?? "").font(.system(size: 13.5)).foregroundStyle(FB.muted).lineLimit(1)
                                }
                                Spacer()
                            }
                            .padding(.horizontal, 14).padding(.vertical, 8)
                        }
                        .buttonStyle(RowPress())
                    }
                    if people.isEmpty { Text("No people match. This searches mock data only.").foregroundStyle(FB.muted).padding(14) }
                    if !listings.isEmpty { heading("Marketplace") }
                    ForEach(listings) { l in
                        Button { app.push(.listing(l.id)) } label: {
                            HStack(spacing: 12) {
                                Pic(path: l.image).frame(width: 44, height: 44).clipShape(RoundedRectangle(cornerRadius: 8))
                                VStack(alignment: .leading, spacing: 0) {
                                    Text(l.title).font(.system(size: 16, weight: .semibold)).foregroundStyle(FB.text)
                                    Text("\(money(l.price)) · \(l.place)").font(.system(size: 13.5)).foregroundStyle(FB.muted)
                                }
                                Spacer()
                            }
                            .padding(.horizontal, 14).padding(.vertical, 8)
                        }
                        .buttonStyle(RowPress())
                    }
                }
                .padding(.bottom, 40)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .background(Color.white)
        .toolbar(.hidden, for: .navigationBar)
    }

    private func heading(_ t: String) -> some View {
        Text(t).font(.system(size: 17, weight: .bold)).foregroundStyle(FB.text).padding(.horizontal, 14).padding(.top, 12).padding(.bottom, 4)
    }
}

// the hamburger menu: facebook shortcuts (musing. among them), then the prototype
// disclaimer and developer controls, so they stay out of the main headers.
struct MenuScreen: View {
    @EnvironmentObject var app: AppState
    @State private var busy = false
    @State private var editingHost = false
    @State private var host = UserDefaults.standard.string(forKey: Config.hostOverrideKey) ?? ""

    var body: some View {
        SubScreen(title: "Menu") {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    Button { app.go(.profile) } label: {
                        HStack(spacing: 12) {
                            if let me = app.me { Avatar(me, size: 44) }
                            Text(app.me?.name ?? "…").font(.system(size: 18, weight: .bold)).foregroundStyle(FB.text)
                            Spacer()
                            Button { app.switcherOpen = true } label: { Circle().fill(FB.button).frame(width: 38, height: 38).overlay(Image(systemName: "arrow.left.arrow.right").font(.system(size: 15, weight: .semibold)).foregroundStyle(FB.text)) }
                                .accessibilityLabel("Switch user")
                        }
                        .padding(12).background(Color.white, in: RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(FadePress())

                    title("Your shortcuts")
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                        tile("person.2.fill", "Friends", FB.blue) { app.push(.search) }
                        tile("person.3.fill", "Groups", FB.blue) { app.push(.groups) }
                        tile("calendar", "Events", FB.red) { app.push(.events) }
                        tile("clock", "Memories", FB.blue) { app.go(.profile) }
                        tile("bookmark.fill", "Saved", Color(hex: 0xa033ff)) { toast("Nothing saved yet. Save a reel or a listing.") }
                        tile("sparkles", "musing.", Muse.start) { app.push(.musing(compose: false)) }
                    }

                    title("Prototype")
                    VStack(spacing: 0) {
                        row("arrow.left.arrow.right", "Switch user") { app.switcherOpen = true }
                        Hairline()
                        row("message.fill", "Messenger") { app.push(.messages) }
                        Hairline()
                        row("gearshape", "musing. settings") { app.push(.musingSettings) }
                        Hairline()
                        row("arrow.clockwise", busy ? "Resetting…" : "Reset demo data") { reset() }
                        Hairline()
                        row("network", "Server address") { editingHost = true }
                    }
                    .background(Color.white, in: RoundedRectangle(cornerRadius: 12))

                    title("Demo controls")
                    VStack(spacing: 0) {
                        toggle("Muse", app.settings.museOn ? "On. Muse reads, picks and re-solves." : "Off. What's left is a plain poll.", Binding(get: { app.settings.museOn }, set: { v in Task { await app.setSetting("muse_on", v) } }))
                        Hairline()
                        toggle("Muse trace", "Show each Muse step and how long it took, inside musing.", $app.traceOn)
                        Hairline()
                        toggle("Replay cached Muse", "Serve the last good Muse responses instead of calling the API. For when the network dies mid-demo.", Binding(get: { app.settings.museReplay }, set: { v in Task { await app.setSetting("muse_replay", v) } }))
                        Hairline()
                        toggle("Invite posters", "Generate a Muse Image poster when a plan becomes real. About 45 seconds, and the priciest call.", Binding(get: { app.settings.postersOn }, set: { v in Task { await app.setSetting("posters_on", v) } }))
                    }
                    .background(Color.white, in: RoundedRectangle(cornerRadius: 12))

                    Text("Hackathon prototype · mock data · invented people · no real accounts · no Facebook or Graph API. Photos are CC0, avatars are generated illustrations.\nServer: \(Config.apiURL)")
                        .font(.system(size: 12.5)).foregroundStyle(FB.muted).multilineTextAlignment(.center).frame(maxWidth: .infinity).padding(.top, 8)
                }
                .padding(12).padding(.bottom, 28)
            }
            .background(FB.bg2)
        }
        .alert("Server address", isPresented: $editingHost) {
            TextField("laptop ip, e.g. 192.168.1.5", text: $host).textInputAutocapitalization(.never).autocorrectionDisabled()
            Button("Save") {
                UserDefaults.standard.set(host.trimmingCharacters(in: .whitespaces), forKey: Config.hostOverrideKey)
                app.version += 1
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("The laptop running the api and supabase. Leave empty to use the address found when the app was built.")
        }
    }

    private func reset() {
        guard !busy else { return }
        busy = true
        Task {
            do {
                try await app.resetDemo()
                toast("Demo data restored.")
            } catch let e { toast(errorText(e)) }
            busy = false
        }
    }

    private func title(_ t: String) -> some View {
        Text(t).font(.system(size: 17, weight: .bold)).foregroundStyle(FB.text).padding(.top, 6).padding(.horizontal, 2)
    }

    private func tile(_ icon: String, _ label: String, _ color: Color, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: icon).font(.system(size: 23)).foregroundStyle(color).frame(height: 28)
                Text(label).font(.system(size: 16, weight: .semibold)).foregroundStyle(FB.text)
            }
            .frame(maxWidth: .infinity, alignment: .leading).padding(14)
            .background(Color.white, in: RoundedRectangle(cornerRadius: 12)).shadow(color: .black.opacity(0.06), radius: 4, y: 1)
        }
        .buttonStyle(FadePress()).accessibilityLabel(label)
    }

    private func row(_ icon: String, _ label: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Circle().fill(FB.input).frame(width: 36, height: 36).overlay(Image(systemName: icon).font(.system(size: 16)).foregroundStyle(FB.text))
                Text(label).font(.system(size: 16, weight: .semibold)).foregroundStyle(FB.text)
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 14, weight: .semibold)).foregroundStyle(FB.muted)
            }
            .padding(12)
        }
        .buttonStyle(RowPress()).accessibilityLabel(label)
    }

    private func toggle(_ label: String, _ sub: String, _ value: Binding<Bool>) -> some View {
        Toggle(isOn: value) {
            VStack(alignment: .leading, spacing: 1) {
                Text(label).font(.system(size: 16, weight: .semibold)).foregroundStyle(FB.text)
                Text(sub).font(.system(size: 13)).foregroundStyle(FB.muted)
            }
        }
        .tint(FB.green).padding(12)
    }
}
