import SwiftUI

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
