import SwiftUI

// ---------- messenger ----------

struct MessagesScreen: View {
    @EnvironmentObject var app: AppState
    @State private var threads: [(thread: ThreadRow, last: Message?)] = []
    @State private var status = "Loading…"

    var body: some View {
        SubScreen(title: "Chats") {
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(threads, id: \.thread.id) { row in
                        let t = row.thread
                        let others = t.memberIds.filter { $0 != app.userId }.compactMap { app.user($0) }
                        Button { app.push(.thread(t.id)) } label: {
                            HStack(spacing: 12) {
                                ZStack {
                                    if let a = others.first { Avatar(a, size: 36).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading) }
                                    if others.count > 1 { Avatar(others[1], size: 36).overlay(Circle().stroke(Color.white, lineWidth: 2)).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing) }
                                }
                                .frame(width: 56, height: 56)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(t.title).font(.system(size: 16, weight: .semibold)).foregroundStyle(FB.text)
                                    if let last = row.last {
                                        let sender = last.senderId == app.userId ? "You" : last.senderId.map { app.user($0).map { firstName($0.name) } ?? "" } ?? "muse"
                                        Text("\(sender): \(last.body ?? "sent a plan") · \(timeAgo(last.createdAt))").font(.system(size: 14)).foregroundStyle(FB.muted).lineLimit(1)
                                    }
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(.horizontal, 16).padding(.vertical, 10)
                        }
                        .buttonStyle(RowPress())
                    }
                    if threads.isEmpty { Text(status).foregroundStyle(FB.muted).padding(24) }
                }
            }
        }
        .task(id: "\(app.userId)-\(app.version)") {
            threads = []
            status = "Loading…"
            await load()
        }
        .onTableChange("messages") { Task { await load() } }
    }

    private func load() async {
        let user = app.userId
        do {
            let list: [ThreadRow] = try await Supa.select("threads", "select=*&member_ids=cs.{\(user)}")
            var msgs: [Message] = []
            if !list.isEmpty {
                msgs = try await Supa.select("messages", "select=*&thread_id=in.(\(list.map(\.id).joined(separator: ",")))&order=created_at.desc")
            }
            guard user == app.userId, !Task.isCancelled else { return }
            threads = list.map { t in (t, msgs.first { $0.threadId == t.id }) }.sorted { ($0.last?.createdAt ?? "") > ($1.last?.createdAt ?? "") }
            status = "No chats yet."
        } catch let e {
            guard user == app.userId, !Task.isCancelled else { return }
            status = errorText(e)
        }
    }
}

struct ThreadScreen: View {
    @EnvironmentObject var app: AppState
    let threadId: String
    @State private var title = "Chat"
    @State private var messages: [Message] = []
    @State private var error: String?

    var body: some View {
        SubScreen(title: title) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 6) {
                        if let error { Text(error).foregroundStyle(FB.muted).padding(24) }
                        ForEach(messages) { m in
                            let mine = m.senderId == app.userId
                            HStack(alignment: .bottom, spacing: 8) {
                                if mine { Spacer(minLength: 40) } else if let sender = app.user(m.senderId) { Avatar(sender, size: 28) } else { MuseAvatar(size: 28) }
                                if let card = m.card, card.type == "plan" {
                                    PlanMessageCard(card: card)
                                } else {
                                    Text(m.body ?? "").font(.system(size: 16)).foregroundStyle(mine ? Color.white : FB.text)
                                        .padding(.horizontal, 12).padding(.vertical, 8)
                                        .background(mine ? FB.blue : FB.input, in: RoundedRectangle(cornerRadius: 18))
                                }
                                if !mine { Spacer(minLength: 40) }
                            }
                            .id(m.id)
                        }
                    }
                    .padding(12)
                }
                .onChange(of: messages.count) { if let last = messages.last { proxy.scrollTo(last.id, anchor: .bottom) } }
            }
            HStack(spacing: 10) {
                Text("Aa").foregroundStyle(FB.muted).frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 14).frame(height: 38).background(FB.input, in: Capsule())
                Image(systemName: "hand.thumbsup.fill").font(.system(size: 22)).foregroundStyle(FB.blue)
            }
            .padding(10)
            .overlay(alignment: .top) { Hairline() }
        }
        .task(id: app.version) { await load() }
        // new messages land live (the plan card arrives this way on quorum)
        .onTableChange("messages") { Task { await load() } }
    }

    private func load() async {
        do {
            async let t: [ThreadRow] = Supa.select("threads", "select=*&id=eq.\(threadId)")
            let ms: [Message] = try await Supa.select("messages", "select=*&thread_id=eq.\(threadId)&order=created_at.asc")
            let thread = try await t.first
            guard !Task.isCancelled else { return }
            title = thread?.title ?? "Chat"
            messages = ms
            error = nil
        } catch let e {
            guard !Task.isCancelled else { return }
            error = errorText(e)
        }
    }
}

struct PlanMessageCard: View {
    @EnvironmentObject var app: AppState
    let card: PlanCard

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Rectangle().fill(LinearGradient(colors: [Muse.start, Muse.end], startPoint: .leading, endPoint: .trailing)).frame(height: 4)
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 4) {
                    Image(systemName: "sparkles").font(.system(size: 12, weight: .semibold))
                    Text("it's happening").font(.system(size: 12, weight: .semibold))
                }
                .foregroundStyle(Muse.text)
                Text(card.title ?? "").font(.system(size: 16, weight: .bold)).foregroundStyle(FB.text)
                Text([card.when, card.`where`].compactMap { $0 }.joined(separator: " · ")).font(.system(size: 13)).foregroundStyle(FB.muted)
                if let line = card.line { Text(line).font(.system(size: 14)).foregroundStyle(FB.text).padding(.top, 4) }
                // the public event, group and listings the plan uses
                ForEach(card.found ?? [], id: \.self) { f in
                    Button { app.push(f.kind == "event" ? .publicEvent(f.id) : f.kind == "group" ? .group(f.id) : .listing(f.id)) } label: {
                        HStack(spacing: 6) {
                            Image(systemName: f.kind == "event" ? "calendar" : f.kind == "group" ? "person.3.fill" : "storefront.fill").font(.system(size: 11)).foregroundStyle(FB.blue).frame(width: 16)
                            Text(f.title).font(.system(size: 13, weight: .semibold)).foregroundStyle(FB.blue).lineLimit(1)
                        }
                    }
                    .buttonStyle(FadePress())
                }
                if let event = card.eventId {
                    Button { app.push(.event(event)) } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "calendar").font(.system(size: 13))
                            Text("View event").font(.system(size: 14, weight: .semibold))
                        }
                        .foregroundStyle(FB.text).frame(maxWidth: .infinity).frame(height: 34).background(FB.input, in: RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(FadePress()).padding(.top, 8)
                }
            }
            .padding(12)
        }
        .frame(width: 260, alignment: .leading)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(FB.divider, lineWidth: 0.5))
        .onTapGesture { if let id = card.planId { app.push(.plan(id)) } }
    }
}

// ---------- events ----------

func formatEventDate(_ iso: String?) -> String {
    guard let d = parseDate(iso) else { return "Date to be announced" }
    return "\(d.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())) at \(d.formatted(.dateTime.hour().minute()))"
}

private let eventQuery = "select=*,host:users!events_host_id_fkey(*)"

struct EventsScreen: View {
    @EnvironmentObject var app: AppState
    @State private var events: [EventRow] = []
    @State private var status = "Loading…"

    var body: some View {
        SubScreen(title: "Events") {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 8) {
                    if let found = app.catalog?.events, !found.isEmpty {
                        Text("Discover").font(.system(size: 20, weight: .bold)).foregroundStyle(FB.text).padding(.horizontal, 12).padding(.top, 12).padding(.bottom, 4)
                        ForEach(found) { ev in
                            Button { app.push(.publicEvent(ev.id)) } label: {
                                DiscoverRow(cover: ev.cover, title: ev.title, sub: "\(sentenceCase(ev.whenText)) · \(ev.area)", detail: "By \(ev.organizer) · mock event")
                            }
                            .buttonStyle(FadePress())
                        }
                    }
                    Text("Your events").font(.system(size: 20, weight: .bold)).foregroundStyle(FB.text).padding(.horizontal, 12).padding(.top, 12).padding(.bottom, 4)
                    ForEach(events) { ev in
                        let date = parseDate(ev.startsAt)
                        Button { app.push(.event(ev.id)) } label: {
                            HStack(spacing: 12) {
                                VStack(spacing: 0) {
                                    Text(date.map { $0.formatted(.dateTime.month(.abbreviated)).uppercased() } ?? "TBA").font(.system(size: 11, weight: .bold)).foregroundStyle(FB.red)
                                    Text(date.map { $0.formatted(.dateTime.day()) } ?? "–").font(.system(size: 22, weight: .bold)).foregroundStyle(FB.text)
                                }
                                .frame(width: 52, height: 56).background(FB.input, in: RoundedRectangle(cornerRadius: 8))
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(ev.title).font(.system(size: 16, weight: .semibold)).foregroundStyle(FB.text).lineLimit(2).multilineTextAlignment(.leading)
                                    Text(formatEventDate(ev.startsAt)).font(.system(size: 13)).foregroundStyle(FB.muted)
                                    if let loc = ev.location { Label(loc, systemImage: "mappin").font(.system(size: 13)).foregroundStyle(FB.muted).lineLimit(1) }
                                    Text("Hosted by \(ev.host.name)").font(.system(size: 13)).foregroundStyle(FB.muted)
                                }
                                Spacer(minLength: 0)
                                Image(systemName: "chevron.right").font(.system(size: 14, weight: .semibold)).foregroundStyle(FB.muted)
                            }
                            .padding(12).background(Color.white)
                        }
                        .buttonStyle(FadePress())
                    }
                    if events.isEmpty { Text(status).foregroundStyle(FB.muted).frame(maxWidth: .infinity).padding(24) }
                }
                .padding(.bottom, 16)
            }
            .refreshable { await load() }
            .background(FB.bg2)
        }
        .task(id: app.version) { await load() }
        .onTableChange("events") { Task { await load() } }
    }

    private func load() async {
        do {
            let rows: [EventRow] = try await Supa.select("events", "\(eventQuery)&order=starts_at.asc")
            guard !Task.isCancelled else { return }
            events = rows
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

    var body: some View {
        SubScreen(title: "Event") {
            if let ev = event {
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        if let poster = ev.posterUrl, let url = API.absoluteURL(poster) {
                            // the poster lands about a minute after the plan becomes real
                            AsyncImage(url: url, transaction: Transaction(animation: .easeIn(duration: 0.3))) { phase in
                                if let image = phase.image { image.resizable().scaledToFill() } else { Rectangle().fill(Muse.gradient) }
                            }
                            .frame(maxWidth: .infinity).aspectRatio(1, contentMode: .fit).clipped()
                        } else {
                            Rectangle().fill(Muse.gradient).aspectRatio(16 / 9, contentMode: .fit)
                                .overlay {
                                    VStack(spacing: 6) {
                                        Image(systemName: ev.planId == nil ? "calendar" : "sparkles").font(.system(size: 42))
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
                                chip("checkmark.circle.fill", "Going", primary: true)
                                chip("star", "Interested")
                                chip("arrowshape.turn.up.right", "Share")
                            }
                            .padding(.top, 8)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading).padding(16).background(Color.white)
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
            let rows: [EventRow] = try await Supa.select("events", "\(eventQuery)&id=eq.\(eventId)")
            guard !Task.isCancelled else { return }
            event = rows.first
            status = "Event not found."
        } catch let e {
            guard !Task.isCancelled else { return }
            status = errorText(e)
        }
    }

    private func chip(_ icon: String, _ label: String, primary: Bool = false) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon).font(.system(size: 14))
            Text(label).font(.system(size: 14, weight: .semibold))
        }
        .foregroundStyle(primary ? Color.white : FB.text).frame(maxWidth: .infinity).frame(height: 38)
        .background(primary ? FB.blue : FB.input, in: RoundedRectangle(cornerRadius: 8))
    }
}
