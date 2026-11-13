import SwiftUI

// the musing. surface: send a signal, see signals (yours and your friends'), see plans.
// every card, title and button here is built from the sizes in `UI`, so the three tabs,
// the plan page and discover together all look like one thing.

// ---------- shared pieces ----------

/// the one card: white, hairline border, same radius and padding everywhere
struct Card<Content: View>: View {
    var pad: CGFloat = UI.cardPad
    var tint = false // the soft musing. wash, for a card that leads somewhere
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) { content }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(pad)
            .background(tint ? AnyShapeStyle(Muse.wash) : AnyShapeStyle(Color.white), in: RoundedRectangle(cornerRadius: UI.cardRadius))
            .overlay(RoundedRectangle(cornerRadius: UI.cardRadius).stroke(tint ? Muse.line : FB.button, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: UI.cardRadius))
    }
}

/// "Your signals", "Matched friends": the heading above a group of cards
struct SectionTitle: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text).font(UI.section).foregroundStyle(FB.text).frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// a line of quiet text where a list would be
struct EmptyNote: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text).font(UI.body).foregroundStyle(FB.muted).frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 4)
    }
}

/// an icon and one line: the date, the place, who is invited
struct MetaRow: View {
    let icon: String
    let text: String
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Image(systemName: icon).font(.system(size: 14)).foregroundStyle(FB.muted).frame(width: 18)
            Text(text).font(UI.body).foregroundStyle(FB.text).fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// the pale blue strip at the bottom of a signal card
struct StatusStrip: View {
    let text: String
    var chevron = false
    var body: some View {
        HStack(spacing: 6) {
            Text(text).font(.system(size: 14, weight: .medium)).foregroundStyle(FB.blue).fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            if chevron { Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(FB.blue) }
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(FB.blueSoft, in: RoundedRectangle(cornerRadius: 8))
    }
}

struct SegmentChips: View {
    @Binding var tab: MusingTab
    /// a plan someone else's "what if" changed and this person has not opened: a dot on "View plans"
    var waiting = false
    private let items: [(MusingTab, String)] = [(.send, "Send a signal"), (.signals, "View signals"), (.plans, "View plans")]

    var body: some View {
        HStack(spacing: 8) {
            ForEach(items, id: \.0) { item in
                let on = tab == item.0
                Button { tab = item.0 } label: {
                    Text(item.1).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(on ? FB.blue : FB.muted).lineLimit(1).minimumScaleFactor(0.85)
                        .frame(maxWidth: .infinity).frame(height: 36)
                        .background(on ? FB.blueSoft : FB.button, in: Capsule())
                        .overlay(alignment: .topTrailing) {
                            // a red dot while a plan someone else changed has not been opened
                            if item.0 == .plans, waiting { Circle().fill(FB.badge).frame(width: 10, height: 10).overlay(Circle().stroke(Color.white, lineWidth: 1.5)).offset(x: -6, y: 2) }
                        }
                }
                .buttonStyle(FadePress())
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        .padding(.horizontal, UI.margin).padding(.vertical, 10)
    }
}

/// one choice about a signal ("Send to · Friends only"). opens a menu of the options.
struct OptionRow<Value: Hashable>: View {
    let label: String
    /// a small symbol before the label
    var icon: String?
    let options: [(value: Value, label: String)]
    @Binding var selection: Value
    var disabled = false

    var body: some View {
        Menu {
            Picker(label, selection: $selection) {
                ForEach(options, id: \.value) { o in Text(o.label).tag(o.value) }
            }
        } label: {
            HStack(spacing: 8) {
                if let icon { Image(systemName: icon).font(.system(size: 15, weight: .medium)).foregroundStyle(FB.blue).frame(width: 22) }
                Text(label).font(UI.body).foregroundStyle(FB.muted)
                Spacer(minLength: 0)
                Text(options.first { $0.value == selection }?.label ?? "").font(.system(size: 15, weight: .semibold)).foregroundStyle(FB.blue)
                Image(systemName: "chevron.down").font(.system(size: 12, weight: .semibold)).foregroundStyle(FB.muted)
            }
            .padding(.horizontal, UI.cardPad).frame(height: UI.buttonBig)
            .background(FB.blueSoft, in: RoundedRectangle(cornerRadius: UI.buttonRadius))
            .overlay(RoundedRectangle(cornerRadius: UI.buttonRadius).stroke(FB.blue.opacity(0.35), lineWidth: 1))
        }
        .disabled(disabled)
        .accessibilityLabel("\(label): \(options.first { $0.value == selection }?.label ?? "")")
    }
}

/// a choice between two things, as two pills side by side across the screen, in the same
/// style as the tabs at the top: the chosen one is soft blue, the other grey. tap to switch.
struct HalfToggle<Value: Hashable>: View {
    let options: [(value: Value, label: String)]
    @Binding var selection: Value
    var disabled = false

    var body: some View {
        HStack(spacing: 8) {
            ForEach(options, id: \.value) { o in
                let on = o.value == selection
                Button { withAnimation(.easeOut(duration: 0.15)) { selection = o.value } } label: {
                    Text(o.label).font(.system(size: 14, weight: .semibold)).foregroundStyle(on ? FB.blue : FB.muted).lineLimit(1)
                        .frame(maxWidth: .infinity).frame(height: 38)
                        .background(on ? FB.blueSoft : FB.button, in: Capsule())
                        .overlay(Capsule().stroke(on ? FB.blue.opacity(0.45) : .clear, lineWidth: 1))
                }
                .buttonStyle(FadePress())
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        .opacity(disabled ? 0.6 : 1)
        .disabled(disabled)
    }
}

func audienceLabel(_ a: String) -> String {
    switch a {
    case "close": "Close friends"
    case "mutual": "Friends of friends"
    case "muse": "Private"
    default: "Friends only"
    }
}

func peopleCount(_ n: Int) -> String { n == 1 ? "1 person" : "\(n) people" }
func friendCount(_ n: Int) -> String { n == 1 ? "1 friend" : "\(n) friends" }

// ---------- people ----------

/// who is on a plan, as far as this viewer may know. confirmed people are blue; people
/// who were only asked are grey. names never appear here unless the server sent them.
struct PeopleChips: View {
    @EnvironmentObject var app: AppState
    let plan: PlanView

    var body: some View {
        Flow(spacing: 6) {
            if let going = plan.going {
                ForEach(going) { chip($0, confirmed: true) }
            } else if plan.role == "starter", let picks = plan.picks {
                if let me = app.me { chip(me.person, confirmed: false) }
                ForEach(picks, id: \.user.id) { chip($0.user, confirmed: false) }
            } else {
                chip(plan.starter, confirmed: false)
                if plan.invited > 1 { count("+\(plan.invited - 1) more") }
            }
        }
    }

    private func chip(_ p: Person, confirmed: Bool) -> some View {
        HStack(spacing: 6) {
            Avatar(p, size: 24)
            Text(p.id == app.userId ? "You" : firstName(p.name)).font(.system(size: 13, weight: .semibold)).foregroundStyle(confirmed ? FB.text : FB.muted)
        }
        .padding(3).padding(.trailing, 8)
        .background(confirmed ? FB.blueSoft : FB.input, in: Capsule())
    }

    private func count(_ t: String) -> some View {
        Text(t).font(.system(size: 13, weight: .semibold)).foregroundStyle(FB.muted)
            .padding(.horizontal, 10).frame(height: 30).background(FB.input, in: Capsule())
    }
}

// ---------- plans ----------

/// the small line above a plan's title: where it stands, for this viewer
func planKicker(_ p: PlanView) -> String {
    let who = firstName(p.starter.name).uppercased()
    let count = "\(p.downCount)/\(p.quorum) DOWN"
    if p.solving { return "MUSE IS REWORKING IT" }
    switch p.state {
    case "draft": return "MUSE DRAFT · NOT SENT"
    case "faded": return "DIDN'T LAND"
    case "happening":
        if p.completed == true { return "HAPPENED" }
        return "CONFIRMED · \(p.role == "starter" ? "YOU" : who) + \(p.downCount) DOWN"
    default: break
    }
    if p.role == "starter" { return "SENT · \(count)" }
    switch p.me?.status {
    case "down": return "YOU'RE IN · \(count)"
    case "maybe": return "YOU SAID MAYBE · \(count)"
    case "out": return "YOU PASSED"
    default: return "FROM \(who) · \(count)"
    }
}

/// one plan: where it stands, what, when, where, who. the same card in the list and on the plan page.
struct PlanSummaryCard: View {
    @EnvironmentObject var app: AppState
    let plan: PlanView
    /// on the plan's own page the title is larger
    var detail = false
    /// set by the plan's own page, which has already marked it seen but still wants it shown as news
    var lookOverride: PlanLook?
    /// the plans tab and the plan's own page offer the starter "create event"; the calendar does not
    var eventAction = false
    @State private var confirming = false
    @State private var making = false

    var body: some View {
        // each status has its own look: red outline for news, dashed for a draft, soft blue once it's on
        let look = lookOverride ?? PlanLook.of(plan, user: app.userId)
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 5) {
                if let icon = look.icon { Image(systemName: icon).font(.system(size: 11, weight: .bold)).foregroundStyle(look.ink) }
                Text(look == .updated ? "UPDATED PLAN · \(plan.downCount)/\(plan.quorum) DOWN" : planKicker(plan))
                    .font(UI.kicker).tracking(0.3).foregroundStyle(look.ink)
                Spacer(minLength: 0)
            }
            Text(sentenceCase(plan.activity ?? "A plan")).font(detail ? .system(size: 22, weight: .bold) : UI.cardTitle).foregroundStyle(FB.text)
                .fixedSize(horizontal: false, vertical: true)
            VStack(alignment: .leading, spacing: 8) {
                if let when = plan.when { MetaRow(icon: "calendar", text: sentenceCase(when)) }
                if let place = plan.where { MetaRow(icon: "mappin.and.ellipse", text: sentenceCase(place)) }
                MetaRow(icon: "person.2", text: "\(plan.role == "starter" ? "You" : firstName(plan.starter.name)) + \(friendCount(plan.invited)) invited")
                if plan.state == "draft" || plan.state == "proposing", let left = expiresIn(plan.expiresAt) { MetaRow(icon: "hourglass", text: sentenceCase(left)) }
            }
            PeopleChips(plan: plan).padding(.top, 2)
            if eventAction, plan.role == "starter" {
                // on the soft blue of a confirmed plan a grey button disappears, so it is white there
                EventPill(icon: "calendar.badge.plus", label: "Create event", white: look == .confirmed, busy: making) { confirming = true }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(UI.cardPad)
        .background(look.fill, in: RoundedRectangle(cornerRadius: UI.cardRadius))
        .overlay(look.border())
        // the same explicit, confirmed step as on a signal card
        .confirmationDialog("Make this a public event?", isPresented: $confirming, titleVisibility: .visible) {
            Button("Create event") { makeEvent() }
        } message: {
            Text("Anyone in the app will see it. It's an in-app mock event. Nothing is posted to Facebook.")
        }
    }

    private func makeEvent() {
        making = true
        Task {
            do {
                let r: EventCreated = try await API.post("/api/events", user: app.userId, body: ["planId": plan.id])
                app.push(.event(r.eventId))
            } catch let e {
                toast(errorText(e))
            }
            making = false
        }
    }
}

// ---------- signals ----------

struct SignalCard: View {
    @EnvironmentObject var app: AppState
    let signal: SignalView
    var busy = false
    let onJoin: () -> Void

    private var meta: String {
        let base = signal.audience == "muse" ? "Private" : "\(audienceLabel(signal.audience)) · \(signal.waitFor)+ \(signal.waitFor == 1 ? "person" : "people")"
        // a count, never who
        return signal.inCount > 0 ? "\(base) · \(signal.inCount) in" : base
    }

    /// sent in the last few minutes: muse may still be drafting
    private var isFresh: Bool { parseDate(signal.createdAt).map { Date().timeIntervalSince($0) < 300 } ?? false }

    private var inLine: String { signal.inCount == 0 ? "" : " · \(signal.inCount) in so far" }

    @State private var confirming = false
    @State private var making = false

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 10) {
                    Avatar(signal.author, size: 40)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(signal.mine ? "You" : signal.author.name).font(.system(size: 15, weight: .semibold)).foregroundStyle(FB.text)
                        Text([timeAgo(signal.createdAt).lowercased(), expiresIn(signal.expiresAt)].compactMap { $0 }.joined(separator: " · ")).font(UI.meta).foregroundStyle(FB.muted)
                    }
                    Spacer(minLength: 0)
                    if signal.mine {
                        Menu {
                            Button("Send it again", systemImage: "arrow.clockwise") { app.handoff = signal.text }
                        } label: {
                            Image(systemName: "ellipsis").font(.system(size: 15, weight: .semibold)).foregroundStyle(FB.muted).frame(width: 32, height: 32)
                        }
                        .accessibilityLabel("more")
                    }
                }
                Text(signal.text).font(.system(size: 17, weight: .semibold)).foregroundStyle(FB.text).fixedSize(horizontal: false, vertical: true)
                Text(meta).font(UI.meta).foregroundStyle(FB.muted)
                strip
                if let eventId = signal.eventId, let feedback = signal.feedback, feedback.eligible {
                    FeedbackBanner(eventId: eventId, state: feedback)
                }
                if signal.mine {
                    EventPill(icon: "calendar.badge.plus", label: "Create event", busy: making) { confirming = true }
                }
            }
        }
        // turning a signal public is the author's explicit choice, so it asks first
        .confirmationDialog("Make this a public event?", isPresented: $confirming, titleVisibility: .visible) {
            Button("Create event") { makeEvent() }
        } message: {
            Text("Anyone in the app will see it. It's an in-app mock event. Nothing is posted to Facebook.")
        }
    }

    private func makeEvent() {
        making = true
        Task {
            do {
                let r: EventCreated = try await API.post("/api/events", user: app.userId, body: ["signalId": signal.id])
                app.push(.event(r.eventId))
            } catch let e {
                toast(errorText(e))
            }
            making = false
        }
    }

    @ViewBuilder private var strip: some View {
        if let planId = signal.planId {
            Button { app.push(.plan(planId)) } label: { StatusStrip(text: planLine, chevron: true) }.buttonStyle(FadePress())
        } else if signal.mine, isFresh {
            StatusStrip(text: "Muse is working on this one")
        } else if signal.mine, signal.audience == "muse" || signal.planState == "faded" || expiresIn(signal.expiresAt) == "expired" {
            // nothing is going to come of this one by itself: offer the way back in
            Button { app.handoff = signal.text } label: { StatusStrip(text: "No plan came of this. Tap to send it again.", chevron: true) }.buttonStyle(FadePress())
        } else if signal.mine {
            StatusStrip(text: "Waiting to turn this into a plan\(inLine)")
        } else if signal.joined {
            StatusStrip(text: "You're in\(signal.inCount > 1 ? " · \(signal.inCount) in so far" : ""). \(firstName(signal.author.name)) only sees the count.")
        } else {
            GradientButton(label: "I'm into this", icon: "hand.raised.fill", busy: busy, fill: true, action: onJoin)
        }
    }

    private var planLine: String {
        switch signal.planState {
        case "draft": "Muse drafted a plan. Tap to review."
        case "happening": "It's happening! Tap to view."
        case "faded": "This one didn't land. Tap to view."
        default: signal.mine ? "Plan sent\(inLine). Tap to view." : "Plan created! Tap to view."
        }
    }
}

// ---------- the screen ----------

struct MusingScreen: View {
    @EnvironmentObject var app: AppState
    let compose: Bool
    @State private var tab: MusingTab
    @State private var home: MusingHome?
    @State private var loading = true
    @State private var error: String?
    @State private var joining: String?
    @State private var allMine = false
    @StateObject private var mood = MuseMood()
    /// "Upcoming plans" narrowed to one status. nil shows them all.
    @State private var planFilter: PlanLook?

    init(compose: Bool, tab: MusingTab = .send) {
        self.compose = compose
        _tab = State(initialValue: tab)
    }

    /// someone else's "what if" changed a plan since this person last opened it
    private var waiting: Bool {
        ((home?.asks ?? []) + (home?.mine ?? [])).contains { PlanSeen.isUpdated($0, user: app.userId) }
    }

    var body: some View {
        SubScreen(title: Copy.brand, trailing: [("calendar", "Calendar", { app.push(.calendar) })]) {
            VStack(spacing: 0) {
                SegmentChips(tab: $tab, waiting: waiting)
                ZStack(alignment: .top) {
                    // the composer stays mounted so a half-typed thought survives a look at another tab
                    page { sendTab }
                        .opacity(tab == .send ? 1 : 0).allowsHitTesting(tab == .send).accessibilityHidden(tab != .send)
                    if tab == .signals { page { signalsTab }.background(Color.white) }
                    if tab == .plans { page { plansTab }.background(Color.white) }
                }
            }
        }
        .task(id: "\(app.userId)-\(app.version)") {
            home = nil
            loading = true
            await load()
        }
        // any plan change anywhere: refetch. the server decides what this person may see.
        .onTableChange("plans") { Task { await load() } }
        // `-muse_state reading|checking|writing|error` as a launch argument holds muse in that mood, for screenshots
        .onAppear {
            let stages: [String: MuseMood.Stage] = ["reading": .reading, "checking": .checking, "writing": .writing, "error": .error]
            if let s = UserDefaults.standard.string(forKey: "muse_state").flatMap({ stages[$0] }) { mood.stage = s }
        }
        // a thought handed over (run it back, a reel, a suggestion) goes to the composer
        .onChange(of: app.handoff) { if app.handoff != nil { tab = .send } }
    }

    private func page<C: View>(@ViewBuilder _ content: () -> C) -> some View {
        let inner = content()
        return ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: UI.gap) { inner }
                    .padding(.horizontal, UI.margin).padding(.top, 4).padding(.bottom, 40)
            }
            .scrollDismissesKeyboard(.interactively)
            .refreshable { await load() }
            // muse is working, or has something to show: bring it into view
            .onChange(of: mood.stage) { if mood.stage != .idle, mood.stage != .asking { withAnimation { proxy.scrollTo("muse", anchor: .bottom) } } }
            .onChange(of: mood.hasNews) { if mood.hasNews { Task { try? await Task.sleep(for: .milliseconds(350)); withAnimation { proxy.scrollTo("muse", anchor: .bottom) } } } }
            .onChange(of: mood.freshPlanId) { if mood.freshPlanId != nil { Task { try? await Task.sleep(for: .milliseconds(500)); withAnimation { proxy.scrollTo("muse", anchor: .bottom) } } } }
        }
    }

    @ViewBuilder private var sendTab: some View {
        // the plan that comes back is shown by muse under the form, with a way in
        SignalComposer(mood: mood, autoFocus: compose && tab == .send) { _ in
            Task { await load() }
        }
        MuseCompanion(mood: mood, home: home).id("muse")
        TracePanel(planId: nil)
    }

    @ViewBuilder private var signalsTab: some View {
        let mine = home?.signals ?? []
        let friends = home?.friendSignals ?? []
        HStack(alignment: .firstTextBaseline) {
            SectionTitle("Your signals")
            // the newest few show by default, so friends' signals are never a long scroll away
            if mine.count > 2 {
                Button { withAnimation(.easeOut(duration: 0.15)) { allMine.toggle() } } label: {
                    Text(allMine ? "Show fewer" : "Past signals").font(.system(size: 14, weight: .semibold)).foregroundStyle(FB.blue).fixedSize()
                }
            }
        }
        if mine.isEmpty { EmptyNote(note("Nothing sent yet. A signal you send shows up here.")) }
        ForEach(allMine ? mine : Array(mine.prefix(2))) { s in SignalCard(signal: s) {} }
        SectionTitle("Your friends' signals").padding(.top, 12)
        if friends.isEmpty { EmptyNote(note("Nothing from friends right now.")) }
        ForEach(friends) { s in SignalCard(signal: s, busy: joining == s.id) { join(s) } }
        if !friends.isEmpty {
            Text("Joining is private. Your friend sees how many are in, never who, until the plan is on.").font(UI.meta).foregroundStyle(FB.muted)
        }
    }

    @ViewBuilder private var plansTab: some View {
        let all = plans
        let upcoming = all.filter { $0.completed != true }
        let done = all.filter { $0.completed == true }
        let shown = upcoming.filter { p in planFilter.map { PlanLook.of(p, user: app.userId) == $0 } ?? true }
        HStack(alignment: .firstTextBaseline) {
            SectionTitle("Upcoming plans")
            Menu {
                Picker("Show", selection: $planFilter) {
                    Text("All plans").tag(PlanLook?.none)
                    ForEach([PlanLook.confirmed, .updated, .draft, .sent], id: \.self) { look in Text(look.name).tag(PlanLook?.some(look)) }
                }
            } label: {
                HStack(spacing: 4) {
                    Text(planFilter?.name ?? "All plans").font(.system(size: 14, weight: .semibold))
                    Image(systemName: "chevron.down").font(.system(size: 11, weight: .semibold))
                }
                .foregroundStyle(FB.blue).fixedSize()
            }
            .accessibilityLabel("Filter plans: \(planFilter?.name ?? "All plans")")
        }
        if upcoming.isEmpty { EmptyNote(note("No plans yet. Send a signal and muse drafts one.")) }
        else if shown.isEmpty, let planFilter { EmptyNote("No \(planFilter.name.lowercased()) plans right now.") }
        ForEach(shown) { p in planButton(p) }
        SectionTitle("Completed plans").padding(.top, 12)
        if done.isEmpty { EmptyNote(note("Plans that happened show up here.")) }
        ForEach(done) { p in planButton(p) }
    }

    private func planButton(_ p: PlanView) -> some View {
        Button { app.push(.plan(p.id)) } label: { PlanSummaryCard(plan: p, eventAction: true) }.buttonStyle(FadePress())
    }

    /// confirmed plans first, then updated, then drafts, then everything else. each group soonest
    /// first; a plan with no day yet goes after the ones that have one, and plans that faded go last.
    private var plans: [PlanView] {
        var seen = Set<String>()
        let all = ((home?.asks ?? []) + (home?.mine ?? [])).filter { seen.insert($0.id).inserted }
        let user = app.userId
        let now = Date()
        func group(_ p: PlanView) -> Int {
            switch PlanLook.of(p, user: user) {
            case .confirmed: 0
            case .updated: 1
            case .draft: 2
            case .sent: 3
            case .past: p.state == "faded" ? 5 : 4
            }
        }
        return all.enumerated().sorted { a, b in
            let (ga, gb) = (group(a.element), group(b.element))
            if ga != gb { return ga < gb }
            let (da, db) = (planDate(a.element, from: now) ?? .distantFuture, planDate(b.element, from: now) ?? .distantFuture)
            if da != db { return da < db }
            return a.offset < b.offset
        }.map(\.element)
    }

    private func note(_ empty: String) -> String {
        if loading { return "One sec" }
        if let error { return "Couldn't load (\(error))." }
        return empty
    }

    private func join(_ s: SignalView) {
        joining = s.id
        Task {
            do {
                try await API.data("POST", "/api/signals/\(s.id)/join", user: app.userId)
                await load()
            } catch let e { toast("Couldn't join (\(errorText(e))).") }
            joining = nil
        }
    }

    private func load() async {
        let user = app.userId
        do {
            let h: MusingHome = try await API.get("/api/musing/home", user: user)
            guard user == app.userId, !Task.isCancelled else { return }
            home = h
            error = nil
            PlanSeen.adopt(h.asks + h.mine, user: user)
        } catch let e {
            guard user == app.userId, !Task.isCancelled else { return }
            error = errorText(e)
        }
        loading = false
    }
}

// ---------- discover together ----------

/// what muse found around a plan, counted: "1 event · 1 location · 2 Marketplace finds · 1 group"
func discoverSummary(_ p: PlanView) -> String? {
    let found = p.opportunities ?? []
    let n = { (kind: String) in found.filter { $0.kind == kind }.count }
    let parts = [
        n("event") > 0 ? (n("event") == 1 ? "1 event" : "\(n("event")) events") : nil,
        p.where != nil ? "1 location" : nil,
        n("listing") > 0 ? (n("listing") == 1 ? "1 Marketplace find" : "\(n("listing")) Marketplace finds") : nil,
        n("group") > 0 ? (n("group") == 1 ? "1 group" : "\(n("group")) groups") : nil,
    ].compactMap { $0 }
    return found.isEmpty ? nil : parts.joined(separator: " · ")
}

struct DiscoverSummaryCard: View {
    let summary: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Card(tint: true) {
                HStack(alignment: .center, spacing: 8) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Discover").font(UI.cardTitle).foregroundStyle(FB.text)
                        Text(summary).font(.system(size: 14, weight: .medium)).foregroundStyle(FB.blue).multilineTextAlignment(.leading)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(FB.muted)
                }
            }
        }
        .buttonStyle(FadePress())
        .accessibilityLabel("Discover together: \(summary)")
    }
}

/// a heading that folds its cards away
struct FoldSection<Content: View>: View {
    let title: String
    @State private var open = true
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: UI.gap) {
            Button { withAnimation(.easeOut(duration: 0.15)) { open.toggle() } } label: {
                HStack {
                    SectionTitle(title)
                    Image(systemName: "chevron.down").font(.system(size: 13, weight: .semibold)).foregroundStyle(FB.muted).rotationEffect(.degrees(open ? 0 : -90))
                }
            }
            .buttonStyle(FadePress())
            if open { content }
        }
        .padding(.top, 8)
    }
}

// the event, the meeting place, the listings and the group a plan uses. optional
// ingredients: catalog records only, nothing is booked, bought or joined from here.
struct DiscoverTogetherScreen: View {
    @EnvironmentObject var app: AppState
    let planId: String
    @State private var plan: PlanView?
    @State private var loading = true
    private let columns = [GridItem(.flexible(), spacing: UI.gap), GridItem(.flexible(), spacing: UI.gap)]

    var body: some View {
        SubScreen(title: "Discover") {
            if let p = plan {
                ScrollView {
                    VStack(alignment: .leading, spacing: UI.gap) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Discover together").font(UI.title).foregroundStyle(FB.text)
                            Text("Optional ingredients for your upcoming plan.").font(.system(size: 14)).foregroundStyle(FB.muted)
                        }
                        sections(p)
                    }
                    .padding(.horizontal, UI.margin).padding(.top, 12).padding(.bottom, 40)
                }
            } else {
                Text(loading ? "One sec" : "This plan isn't here anymore.").foregroundStyle(FB.muted).padding(24)
            }
        }
        .task(id: "\(app.userId)-\(app.version)") {
            let user = app.userId
            let p: PlanView? = try? await API.get("/api/plans/\(planId)", user: user)
            guard user == app.userId, !Task.isCancelled else { return }
            plan = p
            loading = false
        }
    }

    @ViewBuilder private func sections(_ p: PlanView) -> some View {
        let found = p.opportunities ?? []
        let events = found.filter { $0.kind == "event" }
        let listings = found.filter { $0.kind == "listing" }
        let groups = found.filter { $0.kind == "group" }

        if !events.isEmpty {
            FoldSection(title: "Events") {
                ForEach(events) { o in
                    Button { app.push(.publicEvent(o.id)) } label: { bigCard(o, kicker: "EVENT") }.buttonStyle(FadePress())
                }
            }
        }
        if let place = p.where {
            FoldSection(title: "Locations") {
                Card {
                    HStack(alignment: .top, spacing: 12) {
                        Circle().fill(FB.blueSoft).frame(width: 44, height: 44).overlay(Image(systemName: "mappin.and.ellipse").font(.system(size: 17)).foregroundStyle(FB.blue))
                        VStack(alignment: .leading, spacing: 3) {
                            Text(sentenceCase(place)).font(UI.cardTitle).foregroundStyle(FB.text).fixedSize(horizontal: false, vertical: true)
                            if let when = p.when { Text(sentenceCase(when)).font(UI.meta).foregroundStyle(FB.muted) }
                            Text("Where this plan meets.").font(.system(size: 14).italic()).foregroundStyle(FB.text).padding(.top, 2)
                        }
                    }
                }
            }
        }
        if !listings.isEmpty {
            FoldSection(title: "Marketplace finds") {
                LazyVGrid(columns: columns, alignment: .leading, spacing: UI.gap) {
                    ForEach(listings) { o in
                        Button { app.push(.listing(o.id)) } label: { listingCard(o) }.buttonStyle(FadePress())
                    }
                }
                Text("Listings are things to look at. Nothing is bought, reserved or held, and no seller is contacted.").font(UI.meta).foregroundStyle(FB.muted)
            }
        }
        if !groups.isEmpty {
            FoldSection(title: "Groups") {
                ForEach(groups) { o in
                    Button { app.push(.group(o.id)) } label: {
                        Card {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("GROUP").font(UI.kicker).tracking(0.3).foregroundStyle(FB.blue)
                                Text(o.title).font(UI.cardTitle).foregroundStyle(FB.text).multilineTextAlignment(.leading)
                                Text(o.sub).font(UI.meta).foregroundStyle(FB.muted)
                                if let reason = o.reason { Text(sentenceCase(reason)).font(.system(size: 14).italic()).foregroundStyle(FB.text).multilineTextAlignment(.leading).padding(.top, 2) }
                                Text("View group \u{2192}").font(.system(size: 15, weight: .semibold)).foregroundStyle(FB.blue).padding(.top, 6)
                            }
                        }
                    }
                    .buttonStyle(FadePress())
                }
                Text("Browse first. Joining is always your choice.").font(UI.meta).foregroundStyle(FB.muted)
            }
        }
        if found.isEmpty { EmptyNote("Muse didn't find anything extra for this one.") }
    }

    private func bigCard(_ o: Opportunity, kicker: String) -> some View {
        Card(pad: 0) {
            CoverArt(path: o.cover, topic: o.topic).frame(height: 150).frame(maxWidth: .infinity)
            VStack(alignment: .leading, spacing: 4) {
                Text(kicker).font(UI.kicker).tracking(0.3).foregroundStyle(FB.blue)
                Text(o.title).font(UI.cardTitle).foregroundStyle(FB.text).multilineTextAlignment(.leading)
                Text(sentenceCase(o.sub)).font(UI.meta).foregroundStyle(FB.muted)
                if let reason = o.reason { Text(sentenceCase(reason)).font(.system(size: 14).italic()).foregroundStyle(FB.text).multilineTextAlignment(.leading).padding(.top, 2) }
            }
            .padding(UI.cardPad)
        }
    }

    /// a listing's sub line is "$24 · place": the price leads, as it does on Marketplace
    private func listingCard(_ o: Opportunity) -> some View {
        let parts = o.sub.components(separatedBy: " · ")
        return Card(pad: 0) {
            CoverArt(path: o.cover, topic: o.topic).aspectRatio(1, contentMode: .fit)
            VStack(alignment: .leading, spacing: 2) {
                Text(parts.first ?? "").font(UI.cardTitle).foregroundStyle(FB.text)
                Text(o.title).font(.system(size: 14, weight: .semibold)).foregroundStyle(FB.text).lineLimit(2).multilineTextAlignment(.leading)
                if parts.count > 1 { Text(parts.dropFirst().joined(separator: " · ")).font(UI.meta).foregroundStyle(FB.muted).lineLimit(1) }
            }
            .padding(12)
            .frame(maxWidth: .infinity, minHeight: 86, alignment: .topLeading)
        }
    }
}
