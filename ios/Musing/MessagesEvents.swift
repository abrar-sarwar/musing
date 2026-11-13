import SwiftUI

// ---------- events ----------

func formatEventDate(_ iso: String?) -> String {
    guard let d = parseDate(iso) else { return "Date to be announced" }
    return "\(d.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())) at \(d.formatted(.dateTime.hour().minute()))"
}

// ---------- the facebook events look, shared by events, signals and plans ----------

/// a facebook-style event card: cover, date in the accent color, title, place, counts, then
/// actions. the events tab, signals and plans all use it so they read as one surface.
struct EventStyleCard<Actions: View>: View {
    var cover: String? = nil
    var topic: String? = nil
    /// a short line above the date, like where a plan stands
    var kicker: String? = nil
    let date: String
    let title: String
    var place: String? = nil
    var counts: String? = nil
    /// muse's line for this one, if any
    var line: String? = nil
    @ViewBuilder var actions: Actions

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            CoverArt(path: cover, topic: topic).frame(maxWidth: .infinity).aspectRatio(2, contentMode: .fit).clipped()
            VStack(alignment: .leading, spacing: 5) {
                if let kicker { Text(kicker).font(UI.kicker).tracking(0.3).foregroundStyle(Muse.text) }
                Text(date.uppercased()).font(.system(size: 13, weight: .bold)).foregroundStyle(FB.red)
                Text(title).font(.system(size: 18, weight: .bold)).foregroundStyle(FB.text).fixedSize(horizontal: false, vertical: true)
                if let place { Text(place).font(.system(size: 14)).foregroundStyle(FB.muted).lineLimit(1) }
                if let counts { Text(counts).font(.system(size: 13)).foregroundStyle(FB.muted).lineLimit(1) }
                if let line {
                    HStack(alignment: .top, spacing: 6) {
                        Glyph(name: "muse", size: 10)
                        Text(line).font(.system(size: 14)).foregroundStyle(Muse.text).fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.top, 2)
                }
                actions.padding(.top, 6)
            }
            .padding(12)
        }
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: UI.cardRadius))
    }
}

/// the grey (or blue, when it is the main one) pill under an event card
struct EventPill: View {
    let icon: String
    let label: String
    var primary = false
    /// white instead of grey, for a card whose own background is tinted
    var white = false
    var busy = false
    let action: () -> Void

    var body: some View {
        Button(action: action) { EventPillLabel(icon: icon, label: busy ? "\(label)…" : label, primary: primary, white: white) }
            .buttonStyle(FadePress()).disabled(busy)
    }
}

struct EventPillLabel: View {
    let icon: String
    let label: String
    var primary = false
    var white = false

    var body: some View {
        HStack(spacing: 6) {
            Glyph(name: icon, size: icon == "muse" ? 10 : 14)
            Text(label).font(.system(size: 14, weight: .semibold)).lineLimit(1)
        }
        .foregroundStyle(primary ? FB.blue : FB.text).frame(maxWidth: .infinity).frame(height: 36)
        .background(white ? Color.white : primary ? FB.blueSoft : FB.input, in: RoundedRectangle(cornerRadius: 8))
    }
}

struct EventsScreen: View {
    enum Tab: String, CaseIterable { case forYou = "For you", local = "Local", thisWeek = "This week", yours = "Your events" }

    @EnvironmentObject var app: AppState
    @State private var events: [EventRow] = []
    @State private var status = "Loading…"
    @State private var tab = Tab.forYou
    @State private var category: String?
    /// the public events ranked for this person by the server (the reels rule), the top few with a line
    @State private var feed: [EventPick] = []

    private var lines: [String: String] { Dictionary(feed.compactMap { p in p.line.map { (p.eventId, $0) } }, uniquingKeysWith: { a, _ in a }) }
    private var categories: [String] { Array(Set((app.catalog?.events ?? []).compactMap(\.category))).sorted() }

    /// the catalog for the chosen tab and category. for you is the server's order.
    private var shown: [PublicEvent] {
        var all = app.catalog?.events ?? []
        if let category { all = all.filter { $0.category == category } }
        switch tab {
        case .forYou:
            let rank = Dictionary(feed.enumerated().map { ($0.element.eventId, $0.offset) }, uniquingKeysWith: { a, _ in a })
            return all.enumerated().sorted { (rank[$0.element.id] ?? feed.count + $0.offset) < (rank[$1.element.id] ?? feed.count + $1.offset) }.map(\.element)
        case .local: return all.filter { $0.online != true }.sorted { $0.area < $1.area }
        case .thisWeek: return all.sorted { daysAway($0.whenDay) < daysAway($1.whenDay) }
        case .yours: return []
        }
    }

    var body: some View {
        SubScreen(title: "Events") {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(Tab.allCases, id: \.self) { t in chip(t.rawValue, on: tab == t) { tab = t } }
                        }
                        .padding(.horizontal, 12)
                    }
                    .padding(.top, 10)
                    if tab == .yours {
                        yours
                    } else {
                        if !categories.isEmpty {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(categories, id: \.self) { c in chip(c, on: category == c, small: true) { category = category == c ? nil : c } }
                                }
                                .padding(.horizontal, 12)
                            }
                        }
                        ForEach(shown) { ev in card(ev).padding(.horizontal, 12) }
                        if shown.isEmpty { Text(app.catalog == nil ? "Loading…" : "No events here yet.").foregroundStyle(FB.muted).frame(maxWidth: .infinity).padding(24) }
                        Text("Fictional events for this prototype.").font(.system(size: 12.5)).foregroundStyle(FB.muted).padding(.horizontal, 12)
                    }
                }
                .padding(.bottom, 16)
            }
            .refreshable { await load() }
            .background(FB.bg2)
        }
        .task(id: app.version) { await load() }
        .onTableChange("events") { Task { await load() } }
    }

    /// one public event, facebook style, with muse's line and a way to make it a plan
    private func card(_ ev: PublicEvent) -> some View {
        let interested = app.isSaved("event", ev.id)
        return EventStyleCard(cover: ev.cover, topic: ev.tags?.first, date: ev.whenText, title: ev.title,
                              place: ev.online == true ? "Online event" : ev.area,
                              counts: "\(ev.priceText) · by \(ev.organizer)\(ev.capacity.map { " · \($0) spots" } ?? "")",
                              line: tab == .forYou ? lines[ev.id] : nil) {
            VStack(spacing: 8) {
                HStack(spacing: 8) {
                    EventPill(icon: interested ? "star.fill" : "star", label: "Interested", primary: interested) { app.setSaved("event", ev.id, !interested) }
                    ShareLink(item: "\(ev.title) · \(sentenceCase(ev.whenText)) · \(ev.area)") { EventPillLabel(icon: "arrowshape.turn.up.right", label: "Share") }
                }
                EventPill(icon: "muse", label: "Make it a plan", primary: true) {
                    app.makeAMove("go to the \(ev.title.lowercased()) with friends", from: SignalContext(kind: "event", id: ev.id, title: ev.title))
                }
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { app.push(.publicEvent(ev.id)) }
    }

    /// events made in the app (plan events and public ones), in the same card as the catalog
    @ViewBuilder private var yours: some View {
        ForEach(events) { ev in
            EventStyleCard(topic: ev.title, kicker: ev.planId == nil ? nil : "MADE WITH MUSING.", date: formatEventDate(ev.startsAt), title: ev.title,
                           place: ev.location ?? "Location to be announced", counts: "Hosted by \(ev.host.name) · \(ev.attendeeCount) going") {
                HStack(spacing: 8) {
                    EventPill(icon: "calendar", label: "See event", primary: true) { app.push(.event(ev.id)) }
                    ShareLink(item: "\(ev.title) · \(formatEventDate(ev.startsAt))") { EventPillLabel(icon: "arrowshape.turn.up.right", label: "Share") }
                }
            }
            .contentShape(Rectangle())
            .onTapGesture { app.push(.event(ev.id)) }
            .padding(.horizontal, 12)
        }
        if events.isEmpty { Text(status).foregroundStyle(FB.muted).frame(maxWidth: .infinity).padding(24) }
    }

    private func chip(_ label: String, on: Bool, small: Bool = false, _ tap: @escaping () -> Void) -> some View {
        Button(action: tap) {
            Text(label).font(.system(size: small ? 14 : 15, weight: .semibold)).foregroundStyle(on ? FB.blue : FB.text)
                .padding(.horizontal, 14).frame(height: small ? 32 : 36)
                .background(on ? FB.blueSoft : FB.input, in: Capsule())
        }
        .buttonStyle(FadePress())
    }

    /// days from today until a weekly event's next run, for "this week"
    private func daysAway(_ day: String?) -> Int {
        let keys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
        guard let day, let i = keys.firstIndex(of: day) else { return 7 }
        return (i - (Calendar.current.component(.weekday, from: Date()) - 1) + 7) % 7
    }

    private func load() async {
        if app.catalog == nil { await app.loadCatalog() }
        if let f: EventFeed = try? await API.get("/api/events/recommended", user: app.userId), !Task.isCancelled { feed = f.events }
        do {
            let response: EventsResponse = try await API.get("/api/events", user: app.userId)
            guard !Task.isCancelled else { return }
            events = response.events
            status = "No events yet."
        } catch let e {
            guard !Task.isCancelled else { return }
            status = errorText(e)
        }
    }
}

struct EventDetailScreen: View {
    @EnvironmentObject var app: AppState
    let eventId: String
    @State private var event: EventRow?
    @State private var status = "Loading…"
    @State private var busy: String?

    var body: some View {
        SubScreen(title: "Event") {
            if let ev = event {
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        if let poster = ev.posterUrl {
                            // the poster lands about a minute after the plan becomes real
                            AuthorizedServerImage(path: poster, user: app.userId)
                            .frame(maxWidth: .infinity).aspectRatio(1, contentMode: .fit).clipped()
                        } else {
                            Rectangle().fill(Muse.gradient).aspectRatio(16 / 9, contentMode: .fit)
                                .overlay {
                                    VStack(spacing: 6) {
                                        Glyph(name: ev.planId == nil ? "calendar" : "muse", size: 42)
                                        if ev.planId != nil { Text("made with musing.").font(.system(size: 13, weight: .semibold)) }
                                    }
                                    .foregroundStyle(.white.opacity(0.9))
                                }
                        }
                        VStack(alignment: .leading, spacing: 8) {
                            Text(formatEventDate(ev.startsAt).uppercased()).font(.system(size: 13, weight: .bold)).foregroundStyle(FB.red)
                            Text(ev.title).font(.system(size: 22, weight: .bold)).foregroundStyle(FB.text)
                            Label(ev.location ?? "Location to be announced", systemImage: "mappin.and.ellipse").font(.system(size: 15)).foregroundStyle(FB.muted)
                            HStack(spacing: 8) {
                                Avatar(ev.host, size: 24)
                                Text("Hosted by \(ev.host.name)").font(.system(size: 15)).foregroundStyle(FB.muted)
                            }
                            HStack(spacing: 8) {
                                rsvpChip("checkmark.circle.fill", "Going", status: "going")
                                rsvpChip("star", "Interested", status: "interested")
                                ShareLink(item: "\(ev.title) · \(formatEventDate(ev.startsAt))") { EventPillLabel(icon: "arrowshape.turn.up.right", label: "Share") }
                            }
                            .padding(.top, 8)
                            Text("\(ev.attendeeCount) going · \(ev.interestedCount) interested").font(.system(size: 13)).foregroundStyle(FB.muted)
                            if ev.rsvpLocked { Text("Your Going RSVP came from the confirmed plan.").font(.system(size: 13)).foregroundStyle(FB.muted) }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading).padding(16).background(Color.white)
                        FeedbackBanner(eventId: ev.id, state: FeedbackState(eligible: ev.feedback.eligible, memoryId: ev.feedback.memoryId, rating: ev.feedback.rating, prompt: ev.feedback.prompt, notification: ev.feedback.notification), onChanged: { Task { await load() } })
                            .padding(12).background(FB.bg2)
                        if let about = ev.description {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("About").font(.system(size: 17, weight: .bold)).foregroundStyle(FB.text)
                                Text(about).font(.system(size: 15)).lineSpacing(3).foregroundStyle(FB.text)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading).padding(16).background(Color.white).padding(.top, 8)
                        }
                    }
                    .padding(.bottom, 24)
                }
                .background(FB.bg2)
            } else {
                Text(status).foregroundStyle(FB.muted).padding(24)
            }
        }
        .task(id: app.version) { await load() }
        .onTableChange("events") { Task { await load() } }
    }

    private func load() async {
        do {
            let response: EventResponse = try await API.get("/api/events/\(eventId)", user: app.userId)
            guard !Task.isCancelled else { return }
            event = response.event
            status = "Event not found."
        } catch let e {
            guard !Task.isCancelled else { return }
            status = errorText(e)
        }
    }

    private func rsvpChip(_ icon: String, _ label: String, status: String) -> some View {
        let selected = event?.rsvp == status
        return EventPill(icon: icon, label: label, primary: selected, busy: busy == status) {
            guard event?.canRsvp == true else {
                if event?.rsvpLocked == true { toast("Your attendance is locked by the confirmed plan.") }
                else if event?.completed == true { toast("This event is complete.") }
                return
            }
            busy = status
            Task {
                do {
                    let body: [String: Any] = ["status": selected ? NSNull() : status]
                    let response: EventResponse = try await API.put("/api/events/\(eventId)/rsvp", user: app.userId, body: body)
                    event = response.event
                } catch let e { toast(errorText(e)) }
                busy = nil
            }
        }
    }
}

private struct AuthorizedServerImage: View {
    let path: String
    let user: String
    @State private var image: UIImage?
    var body: some View {
        Group { if let image { Image(uiImage: image).resizable().scaledToFill() } else { Rectangle().fill(Muse.gradient) } }
            .task(id: "\(user)-\(path)") {
                guard path.hasPrefix("/") else { return }
                if let data = try? await API.data("GET", path, user: user), let loaded = UIImage(data: data) { withAnimation(.easeIn(duration: 0.3)) { image = loaded } }
            }
    }
}
