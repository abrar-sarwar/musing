import SwiftUI

enum AppTab: String, CaseIterable {
    case home, reels, marketplace, dating, notifications, profile
}

/// the three tabs of the musing. surface
enum MusingTab: String, Hashable { case send, signals, plans }

enum Route: Hashable {
    case search, menu, messages, thread(String), events, event(String), listing(String), person(String)
    case musing(compose: Bool, tab: MusingTab = .send), plan(String), discoverTogether(String), musingSettings, nudge, recap
    case groups, group(String), publicEvent(String)
    case developer
}

// tiny toast for mocked facebook actions, so nothing on screen is a dead button.
@MainActor
final class ToastCenter: ObservableObject {
    static let shared = ToastCenter()
    @Published var text: String?
    private var hide: Task<Void, Never>?

    func show(_ t: String) {
        hide?.cancel()
        withAnimation(.easeOut(duration: 0.14)) { text = t }
        hide = Task {
            try? await Task.sleep(for: .seconds(1.7))
            guard !Task.isCancelled else { return }
            withAnimation(.easeIn(duration: 0.22)) { text = nil }
        }
    }
}

@MainActor
func toast(_ text: String) { ToastCenter.shared.show(text) }

// the acting user (no login: act as any seeded person), the demo controls and navigation.
@MainActor
final class AppState: ObservableObject {
    private static let userKey = "musing_user"
    private static let traceKey = "musing_trace"
    private static let chosenKey = "musing_account_chosen"
    private static let demoOrder = ["maya", "alex", "jo", "sam"]

    @Published var userId: String
    @Published var users: [User] = []
    /// true until someone has picked who this phone is. every phone in the demo is a different person.
    @Published var needsAccount: Bool
    /// why the list of people could not be loaded, shown on the account prompt
    @Published var usersError: String?
    /// bumps whenever data should refetch (user switch, reset)
    @Published var version = 0
    @Published var switcherOpen = false
    // muse on/off, replay and posters are global (server side, so both phones agree).
    @Published var settings = Settings()
    // the trace panel is per device.
    @Published var traceOn: Bool { didSet { UserDefaults.standard.set(traceOn, forKey: Self.traceKey) } }
    /// a thought handed to the composer from elsewhere (reels card, recap, suggestion)
    @Published var handoff: String?
    /// the listing, event, group or reel that thought started from, so nothing is typed twice
    @Published var handoffContext: SignalContext?
    // the fictional discovery catalog, and what this person saved or joined
    @Published var catalog: Catalog?
    @Published var saved: Set<String> = []
    @Published var path: [Route] = []
    @Published var tab: AppTab = .home
    private var pendingActAs: String?

    init() {
        userId = UserDefaults.standard.string(forKey: Self.userKey) ?? "maya"
        traceOn = UserDefaults.standard.bool(forKey: Self.traceKey)
        needsAccount = !UserDefaults.standard.bool(forKey: Self.chosenKey)
    }

    var me: User? { users.first { $0.id == userId } }
    func user(_ id: String?) -> User? { id.flatMap { id in users.first { $0.id == id } } }

    // ---- navigation ----
    func push(_ route: Route) { path.append(route) }
    func back() { if !path.isEmpty { path.removeLast() } }
    func go(_ tab: AppTab) {
        path.removeAll()
        self.tab = tab
    }

    // ---- acting user ----
    func loadUsers() async {
        do {
            let rows: [User] = try await Supa.select("users", "select=*")
            let rank: (User) -> Int = { Self.demoOrder.firstIndex(of: $0.id) ?? 99 }
            users = rows.sorted { (rank($0), $0.name) < (rank($1), $1.name) }
            usersError = nil
            if let id = pendingActAs { actAs(id) }
        } catch {
            print("users load failed:", errorText(error))
            if users.isEmpty { usersError = errorText(error) }
        }
    }

    func switchTo(_ id: String) {
        userId = id
        UserDefaults.standard.set(id, forKey: Self.userKey)
        UserDefaults.standard.set(true, forKey: Self.chosenKey)
        needsAccount = false
        switcherOpen = false
        version += 1
    }

    // demo affordance: a link with ?as=<userId> switches the acting user first, so a
    // deep link can open a second phone straight into a friend's view.
    func actAs(_ id: String) {
        guard !users.isEmpty else {
            pendingActAs = id
            return
        }
        pendingActAs = nil
        if id != userId, users.contains(where: { $0.id == id }) { switchTo(id) }
    }

    /// back to the "who's using this phone?" prompt, for handing the phone to someone else.
    func signOut() {
        UserDefaults.standard.set(false, forKey: Self.chosenKey)
        switcherOpen = false
        path.removeAll()
        tab = .home
        needsAccount = true
    }

    func resetDemo() async throws {
        try await API.data("POST", "/api/reset", user: userId)
        version += 1
    }

    // ---- discovery ----
    func loadCatalog() async {
        let user = userId
        guard let c: Catalog = try? await API.get("/api/discover", user: user), user == userId else { return }
        catalog = c
        saved = Set(c.saved)
    }

    func isSaved(_ kind: String, _ id: String) -> Bool { saved.contains("\(kind):\(id)") }

    /// save or join through a mock interaction. only ever for the acting person.
    func setSaved(_ kind: String, _ id: String, _ on: Bool) {
        let key = "\(kind):\(id)"
        if on { saved.insert(key) } else { saved.remove(key) }
        let user = userId
        Task {
            let body: [String: Any] = ["kind": kind, "id": id, "on": on]
            if (try? await API.data("POST", "/api/discover/save", user: user, body: body)) == nil, user == userId {
                if on { saved.remove(key) } else { saved.insert(key) }
                toast("Couldn't save that. Try again.")
            }
        }
    }

    /// every contextual entry point lands here: one thought, one context, the same composer.
    func makeAMove(_ thought: String, from context: SignalContext?) {
        handoff = thought
        handoffContext = context
        push(.musing(compose: true))
    }

    // ---- demo controls ----
    func loadSettings() async {
        if let s: Settings = try? await API.get("/api/settings", user: userId) { settings = s }
    }

    func setSetting(_ key: String, _ value: Bool) async {
        switch key {
        case "muse_on": settings.museOn = value
        case "muse_replay": settings.museReplay = value
        default: settings.postersOn = value
        }
        if let s: Settings = try? await API.post("/api/settings", user: userId, body: ["key": key, "value": value]) {
            settings = s
        } else {
            await loadSettings()
        }
    }
}

extension View {
    /// runs the action whenever a row in `table` changes. screens refetch through the api.
    func onTableChange(_ table: String, perform action: @escaping () -> Void) -> some View {
        onReceive(NotificationCenter.default.publisher(for: .tableChanged)) { note in
            if note.object as? String == table { action() }
        }
    }
}
