import SwiftUI

@main
struct MusingApp: App {
    @StateObject private var app = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(app)
                .preferredColorScheme(.light)
                .tint(FB.blue)
        }
    }
}

struct RootView: View {
    @EnvironmentObject var app: AppState

    var body: some View {
        NavigationStack(path: $app.path) {
            TabsView()
                .toolbar(.hidden, for: .navigationBar)
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case .search: SearchScreen()
                    case .menu: MenuScreen()
                    case .messages: MessagesScreen()
                    case .thread(let id): ThreadScreen(threadId: id)
                    case .events: EventsScreen()
                    case .event(let id): EventDetailScreen(eventId: id)
                    case .listing(let id): ListingScreen(listingId: id)
                    case .person(let id): PersonScreen(personId: id)
                    case .musing(let compose, let tab): MusingScreen(compose: compose, tab: tab)
                    case .plan(let id): PlanScreen(planId: id)
                    case .discoverTogether(let id): DiscoverTogetherScreen(planId: id)
                    case .musingSettings: MusingSettingsScreen()
                    case .nudge: NudgePreview()
                    case .recap: RecapPreview()
                    case .groups: GroupsScreen()
                    case .group(let id): GroupDetailScreen(groupId: id)
                    case .publicEvent(let id): PublicEventScreen(eventId: id)
                    case .developer: DeveloperScreen()
                    case .calendar: CalendarScreen()
                    case .availability: AvailabilityScreen()
                    case .describeAvailability: DescribeAvailabilityScreen()
                    }
                }
        }
        .sheet(isPresented: $app.switcherOpen) { UserSwitcherSheet().environmentObject(app) }
        .overlay { ToastOverlay() }
        .overlay { if app.needsAccount { AccountPrompt().transition(.opacity) } }
        .animation(.easeOut(duration: 0.22), value: app.needsAccount)
        .overlay { LaunchIntro() }
        .task {
            Realtime.shared.start()
            // `-open reels` (or any link target) as a launch argument starts on that screen
            if let target = UserDefaults.standard.string(forKey: "open"), let url = URL(string: "musing://\(target)") { open(url) }
            await app.loadUsers()
        }
        .task(id: app.version) {
            await app.loadSettings()
            await app.loadCatalog()
        }
        // lock-screen and home-screen notifications for whoever this phone is
        .task(id: "\(app.userId)-\(app.needsAccount)") {
            guard !app.needsAccount else { return }
            Task { await MusePictures.shared.ensure(user: app.userId) }
            await Notifier.shared.watch(user: app.userId)
            if let link = Notifier.shared.takePendingLink() { open(link) }
        }
        .onReceive(NotificationCenter.default.publisher(for: .openLink)) { _ in
            if let link = Notifier.shared.takePendingLink() { open(link) }
        }
        .onChange(of: app.version) { Task { await app.loadUsers() } }
        .onTableChange("app_settings") { Task { await app.loadSettings() } }
        .onOpenURL { open($0) }
    }

    private func open(_ url: URL) {
        // musing://musing?as=alex opens the musing. surface as alex
        let comps = URLComponents(url: url, resolvingAgainstBaseURL: false)
        if let who = comps?.queryItems?.first(where: { $0.name == "as" })?.value { app.actAs(who) }
        // musing://developer?server=https://name.trycloudflare.com points this phone at a new server
        if let server = comps?.queryItems?.first(where: { $0.name == "server" })?.value {
            UserDefaults.standard.set(server.trimmingCharacters(in: .whitespacesAndNewlines), forKey: Config.hostOverrideKey)
            Realtime.shared.restart()
            Task {
                await app.loadUsers()
                app.version += 1
            }
        }
        // every screen has a link: musing://reels, musing://menu, musing://plan/<id>, ...
        let arg = url.pathComponents.dropFirst().first
        switch url.host ?? "" {
        // musing://musing?tab=signals|plans opens on that tab
        case "musing": app.path = [.musing(compose: false, tab: comps?.queryItems?.first(where: { $0.name == "tab" })?.value.flatMap(MusingTab.init) ?? .send)]
        case "home", "reels", "marketplace", "dating", "notifications", "profile": if let tab = AppTab(rawValue: url.host ?? "") { app.go(tab) }
        case "menu": app.path = [.menu]
        case "search": app.path = [.search]
        case "messages": app.path = arg.map { [.messages, .thread($0)] } ?? [.messages]
        case "events": app.path = arg.map { [.events, .event($0)] } ?? [.events]
        case "listing": if let arg { app.path = [.listing(arg)] }
        case "people": if let arg { app.path = [.person(arg)] }
        case "plan": if let arg { app.path = [.musing(compose: false, tab: .plans), .plan(arg)] }
        case "discover": if let arg { app.path = [.musing(compose: false, tab: .plans), .plan(arg), .discoverTogether(arg)] }
        case "settings": app.path = [.musingSettings]
        case "developer": app.path = [.developer]
        case "calendar": app.path = [.calendar]
        case "availability": app.path = arg == "describe" ? [.calendar, .availability, .describeAvailability] : [.calendar, .availability]
        case "groups": app.path = arg.map { [.groups, .group($0)] } ?? [.groups]
        case "public-event": if let arg { app.path = [.events, .publicEvent(arg)] }
        default: break
        }
    }
}

// facebook's six bottom tabs. musing. is not one of them: it is reached from the
// home composer, feed, reels, notifications, messenger and the menu.
struct TabsView: View {
    @EnvironmentObject var app: AppState
    @State private var visited: Set<AppTab> = [.home]

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .bottom) {
                // tabs stay alive once opened, so switching back is instant
                ForEach(AppTab.allCases, id: \.self) { tab in
                    if visited.contains(tab) {
                        screen(tab)
                            .opacity(app.tab == tab ? 1 : 0)
                            .allowsHitTesting(app.tab == tab)
                            .accessibilityHidden(app.tab != tab)
                    }
                }
                FloatingTabBar()
                    .padding(.horizontal, 14)
                    .padding(.bottom, max(geo.safeAreaInsets.bottom - 14, 10))
            }
            .ignoresSafeArea(edges: .bottom)
        }
        .ignoresSafeArea(.keyboard)
        .background(app.tab == .reels ? Color.black : Color.white)
        .onChange(of: app.tab, initial: true) { visited.insert(app.tab) }
    }

    @ViewBuilder private func screen(_ tab: AppTab) -> some View {
        switch tab {
        case .home: HomeScreen()
        case .reels: ReelsScreen()
        case .marketplace: MarketplaceScreen()
        case .dating: DatingScreen()
        case .notifications: NotificationsScreen()
        case .profile:
            // remounts on a user switch so local edits don't carry over
            if let me = app.me { ProfileView(user: me, isSelf: true).id(me.id) } else { Color.white }
        }
    }
}

// facebook's floating bottom navigation: a white capsule above the safe area with
// six items. the selected one sits in a soft blue highlight. on reels it goes dark.
struct FloatingTabBar: View {
    @EnvironmentObject var app: AppState

    private func meta(_ tab: AppTab) -> (label: String, icon: String, active: String) {
        switch tab {
        case .home: ("Home", "house", "house.fill")
        case .reels: ("Reels", "play.rectangle", "play.rectangle.fill")
        case .marketplace: ("Marketplace", "storefront", "storefront.fill")
        case .dating: ("Dating", "heart", "heart.fill")
        case .notifications: ("Notifications", "bell", "bell.fill")
        case .profile: ("Profile", "person.crop.circle", "person.crop.circle.fill")
        }
    }

    var body: some View {
        let dark = app.tab == .reels
        HStack(spacing: 0) {
            ForEach(AppTab.allCases, id: \.self) { tab in
                let focused = app.tab == tab
                let m = meta(tab)
                Button { app.tab = tab } label: {
                    ZStack {
                        Capsule().fill(focused ? (dark ? Color.white.opacity(0.2) : FB.blueSoft) : .clear).frame(maxWidth: 76).frame(height: 46).padding(.horizontal, 2)
                        if tab == .profile {
                            if let me = app.me {
                                Avatar(me, size: 27).padding(1.5)
                                    .overlay(Circle().stroke(focused ? (dark ? Color.white : FB.blue) : Color.black.opacity(0.25), lineWidth: 1.5))
                            } else {
                                Circle().fill(FB.input).frame(width: 29, height: 29)
                            }
                        } else {
                            Image(systemName: focused ? m.active : m.icon).font(.system(size: 22, weight: .medium))
                                .foregroundStyle(dark ? Color.white : focused ? FB.blue : FB.text)
                                .overlay(alignment: .topTrailing) {
                                    if tab == .reels && !focused {
                                        Text("1").font(.system(size: 10, weight: .bold)).foregroundStyle(.white)
                                            .frame(minWidth: 17, minHeight: 17).background(FB.badge, in: Circle())
                                            .overlay(Circle().stroke(Color.white, lineWidth: 1.5)).offset(x: 9, y: -7)
                                    }
                                }
                        }
                    }
                    .frame(maxWidth: .infinity).frame(height: tabBarHeight).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(m.label)
                .accessibilityAddTraits(focused ? .isSelected : [])
            }
        }
        .padding(.horizontal, 6)
        .frame(height: tabBarHeight)
        .background(dark ? Color(hex: 0x262628, alpha: 0.88) : Color.white.opacity(0.97), in: Capsule())
        .overlay(Capsule().stroke(dark ? Color.white.opacity(0.22) : Color.black.opacity(0.14), lineWidth: 0.5))
        .shadow(color: .black.opacity(dark ? 0 : 0.16), radius: 14, y: 4)
    }
}

// act as any seeded user. no login, no passwords. also the one-tap demo reset.
struct UserSwitcherSheet: View {
    @EnvironmentObject var app: AppState
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Acting as").font(.system(size: 20, weight: .bold)).foregroundStyle(FB.text)
                Spacer()
                Button { app.switcherOpen = false } label: { Image(systemName: "xmark").font(.system(size: 18, weight: .semibold)).foregroundStyle(FB.text) }
                    .accessibilityLabel("Close")
            }
            .padding(.horizontal, 16).padding(.top, 16).padding(.bottom, 4)
            Text("Prototype only. Pick anyone to see the app as them. No login.").font(.system(size: 13)).foregroundStyle(FB.muted)
                .padding(.horizontal, 16).padding(.bottom, 8)
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(app.users) { u in
                        Button { app.switchTo(u.id) } label: {
                            HStack(spacing: 12) {
                                Avatar(u, size: 40)
                                VStack(alignment: .leading, spacing: 0) {
                                    Text(u.name).font(.system(size: 16, weight: .semibold)).foregroundStyle(FB.text)
                                    Text("@\(u.id)").font(.system(size: 13)).foregroundStyle(FB.muted)
                                }
                                Spacer()
                                if u.id == app.userId { Image(systemName: "checkmark").font(.system(size: 17, weight: .semibold)).foregroundStyle(FB.blue) }
                            }
                            .padding(.horizontal, 16).padding(.vertical, 10)
                            .background(u.id == app.userId ? FB.hover : .clear)
                        }
                        .buttonStyle(RowPress())
                    }
                    Hairline().padding(.top, 8)
                    VStack(alignment: .leading, spacing: 8) {
                        Button { app.signOut() } label: {
                            HStack(spacing: 10) {
                                Image(systemName: "rectangle.portrait.and.arrow.right").font(.system(size: 16, weight: .semibold))
                                Text("Log out and choose again").font(.system(size: 16, weight: .semibold))
                                Spacer()
                            }
                            .foregroundStyle(FB.text).padding(.horizontal, 14).padding(.vertical, 12)
                            .background(FB.input, in: RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(FadePress())
                        Button {
                            Task {
                                busy = true
                                error = nil
                                do {
                                    try await app.resetDemo()
                                    app.switcherOpen = false
                                } catch let e { error = errorText(e) }
                                busy = false
                            }
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: "arrow.clockwise").font(.system(size: 16, weight: .semibold))
                                Text(busy ? "Resetting…" : "Reset demo data").font(.system(size: 16, weight: .semibold))
                                Spacer()
                            }
                            .foregroundStyle(FB.text).padding(.horizontal, 14).padding(.vertical, 12)
                            .background(FB.input, in: RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(FadePress()).disabled(busy)
                        if let error { Text(error).font(.system(size: 13)).foregroundStyle(FB.red) }
                    }
                    .padding(16)
                }
            }
        }
        .background(Color.white)
    }
}

// the first thing a phone asks: who is using it. the demo runs one shared server on the
// laptop and every phone is a different person, so nobody lands on the same account by
// default. no passwords: it is a prototype with seeded people.
struct AccountPrompt: View {
    @EnvironmentObject var app: AppState
    @State private var host = UserDefaults.standard.string(forKey: Config.hostOverrideKey) ?? ""
    @State private var retrying = false

    var body: some View {
        ZStack {
            Color.white.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 0) {
                (Text("musing").foregroundStyle(FB.text) + Text(".").foregroundStyle(Muse.start))
                    .font(.system(size: 34, weight: .heavy)).tracking(-1.2)
                    .padding(.top, 28)
                Text("Who's using this phone?").font(.system(size: 24, weight: .bold)).foregroundStyle(FB.text).padding(.top, 18)
                Text("Pick yourself. Each phone in the demo should be a different person. No password, it's a prototype.")
                    .font(.system(size: 15)).foregroundStyle(FB.muted).padding(.top, 6).fixedSize(horizontal: false, vertical: true)

                if app.users.isEmpty {
                    if let error = app.usersError { unreachable(error) } else {
                        HStack { Spacer(); ProgressView(); Spacer() }.padding(.top, 60)
                    }
                    Spacer()
                } else {
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            ForEach(app.users) { u in
                                Button { app.switchTo(u.id) } label: {
                                    HStack(spacing: 14) {
                                        Avatar(u, size: 52)
                                        VStack(alignment: .leading, spacing: 1) {
                                            Text(u.name).font(.system(size: 17, weight: .semibold)).foregroundStyle(FB.text)
                                            Text("@\(u.id)").font(.system(size: 14)).foregroundStyle(FB.muted)
                                        }
                                        Spacer()
                                        Image(systemName: "chevron.right").font(.system(size: 14, weight: .semibold)).foregroundStyle(FB.muted)
                                    }
                                    .padding(.vertical, 10).contentShape(Rectangle())
                                }
                                .buttonStyle(RowPress())
                                .accessibilityLabel("Continue as \(u.name)")
                            }
                        }
                        .padding(.bottom, 24)
                    }
                    .padding(.top, 14)
                }
            }
            .padding(.horizontal, 20)
        }
        .task {
            // keep trying quietly, so the list appears the moment the laptop is reachable
            while app.users.isEmpty && !Task.isCancelled {
                try? await Task.sleep(for: .seconds(3))
                if app.users.isEmpty { await app.loadUsers() }
            }
        }
    }

    @ViewBuilder private func unreachable(_ error: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Can't reach the laptop yet").font(.system(size: 17, weight: .semibold)).foregroundStyle(FB.text)
            Text("Plug this phone into the Mac running musing., or join the same Wi‑Fi. If it still can't connect, type the Mac's address below.")
                .font(.system(size: 14)).foregroundStyle(FB.muted).fixedSize(horizontal: false, vertical: true)
            TextField(Config.devHost ?? "your-mac.local", text: $host)
                .textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.URL)
                .font(.system(size: 16)).padding(.horizontal, 12).padding(.vertical, 11)
                .background(FB.input, in: RoundedRectangle(cornerRadius: 8))
            Button {
                Task {
                    retrying = true
                    UserDefaults.standard.set(host.trimmingCharacters(in: .whitespaces), forKey: Config.hostOverrideKey)
                    await app.loadUsers()
                    retrying = false
                }
            } label: {
                Text(retrying ? "Trying…" : "Try again").font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 12).background(FB.blue, in: RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(FadePress()).disabled(retrying)
            Text(error).font(.system(size: 12)).foregroundStyle(FB.muted).lineLimit(2)
        }
        .padding(.top, 28)
    }
}

// the brief musing. introduction on a fresh launch. it waits on nothing: no api,
// no data, no images. it leaves on its own in about a second, or at once on a tap.
struct LaunchIntro: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var visible = true
    @State private var risen = false
    @State private var drawn = false

    var body: some View {
        if visible {
            ZStack {
                Color.white.ignoresSafeArea()
                VStack(spacing: 0) {
                    (Text("musing").foregroundStyle(FB.text) + Text(".").foregroundStyle(Muse.start))
                        .font(.system(size: 46, weight: .heavy)).tracking(-1.8)
                    Capsule().fill(Muse.entryGradient).frame(width: 132, height: 4).padding(.top, 6)
                        .scaleEffect(x: drawn ? 1 : 0, anchor: .center)
                    Text("less planning. more happening.").font(.system(size: 16)).foregroundStyle(FB.muted).padding(.top, 14)
                }
                .opacity(risen ? 1 : 0)
                .offset(y: risen ? 0 : 10)
            }
            .contentShape(Rectangle())
            .onTapGesture { leave(0.12) }
            .accessibilityLabel("musing. less planning. more happening. tap to skip")
            .transition(.opacity)
            .task {
                if reduceMotion {
                    risen = true
                    drawn = true
                } else {
                    withAnimation(.easeOut(duration: 0.38)) { risen = true }
                    withAnimation(.easeOut(duration: 0.52).delay(0.16)) { drawn = true }
                }
                try? await Task.sleep(for: .milliseconds(950))
                leave(0.26)
            }
        }
    }

    private func leave(_ duration: Double) {
        withAnimation(.easeOut(duration: duration)) { visible = false }
    }
}
