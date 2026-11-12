import SwiftUI

// opportunity discovery: the fictional catalog of public events and groups, and the
// contextual "make a move" entry points. every entry point hands one thought and one
// context to the same composer.

/// the contextual musing. entry point on a listing, a public event or a group
struct MoveFromThis: View {
    let sub: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: "sparkles").font(.system(size: 14, weight: .bold)).foregroundStyle(Muse.start)
                VStack(alignment: .leading, spacing: 1) {
                    Text("make a move from this").font(.system(size: 15, weight: .bold)).foregroundStyle(FB.text)
                    Text(sub).font(.system(size: 12.5)).foregroundStyle(FB.muted).multilineTextAlignment(.leading)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(FB.muted)
            }
            .padding(12)
            .background(Muse.softer, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Muse.line, lineWidth: 1))
        }
        .buttonStyle(FadePress())
        .accessibilityLabel("make a move from this")
    }
}

struct DiscoverRow: View {
    let cover: String?
    let title: String
    let sub: String
    var detail: String?

    var body: some View {
        HStack(spacing: 12) {
            Pic(path: cover ?? "cover/hills.jpg").frame(width: 56, height: 56).clipShape(RoundedRectangle(cornerRadius: 8))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.system(size: 16, weight: .semibold)).foregroundStyle(FB.text).lineLimit(1)
                Text(sub).font(.system(size: 13)).foregroundStyle(FB.muted).lineLimit(1)
                if let detail { Text(detail).font(.system(size: 13)).foregroundStyle(FB.muted).lineLimit(1) }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.system(size: 14, weight: .semibold)).foregroundStyle(FB.muted)
        }
        .padding(12).background(Color.white)
    }
}

// "muse found a move": the public event, group and listings a plan uses, each with
// muse's one-line reason. tapping one pushes it; back returns to the plan.
struct FoundSection: View {
    @EnvironmentObject var app: AppState
    let found: [Opportunity]

    private func label(_ kind: String) -> (icon: String, name: String) {
        switch kind {
        case "event": ("calendar", "Event")
        case "group": ("person.3.fill", "Group")
        default: ("storefront.fill", "Marketplace")
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(found.enumerated()), id: \.element) { i, o in
                let meta = label(o.kind)
                Button { app.push(o.kind == "event" ? .publicEvent(o.id) : o.kind == "group" ? .group(o.id) : .listing(o.id)) } label: {
                    HStack(spacing: 12) {
                        Pic(path: o.cover ?? "cover/hills.jpg").frame(width: 48, height: 48).clipShape(RoundedRectangle(cornerRadius: 8))
                        VStack(alignment: .leading, spacing: 1) {
                            HStack(spacing: 4) {
                                Image(systemName: meta.icon).font(.system(size: 10, weight: .semibold))
                                Text(meta.name).font(.system(size: 11.5, weight: .bold))
                            }
                            .foregroundStyle(FB.blue)
                            Text(o.title).font(.system(size: 15, weight: .semibold)).foregroundStyle(FB.text).lineLimit(1)
                            Text(o.sub).font(.system(size: 13)).foregroundStyle(FB.muted).lineLimit(1)
                            if let reason = o.reason { Text(reason).font(.system(size: 13)).foregroundStyle(Muse.text).lineLimit(2).multilineTextAlignment(.leading) }
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(FB.muted)
                    }
                    .padding(.horizontal, 16).padding(.vertical, 10)
                }
                .buttonStyle(RowPress())
                if i < found.count - 1 { Hairline() }
            }
        }
        .background(Color.white)
        if found.contains(where: { $0.kind == "listing" }) {
            Text("listings are things to look at. nothing is bought, reserved or held, and no seller is contacted.").font(.system(size: 12)).foregroundStyle(FB.muted)
                .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 16).padding(.top, 8)
        }
    }
}

// groups discovery, reached from the menu. fictional communities.
struct GroupsScreen: View {
    @EnvironmentObject var app: AppState

    var body: some View {
        SubScreen(title: "Groups") {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 8) {
                    let groups = app.catalog?.groups ?? []
                    let mine = groups.filter { app.isSaved("group_join", $0.id) }
                    if !mine.isEmpty {
                        heading("Your groups")
                        ForEach(mine) { row($0) }
                    }
                    heading("Discover")
                    ForEach(groups.filter { !app.isSaved("group_join", $0.id) }) { row($0) }
                    if groups.isEmpty { Text(app.catalog == nil ? "Loading…" : "No groups yet.").foregroundStyle(FB.muted).frame(maxWidth: .infinity).padding(24) }
                    Text("Fictional groups for this prototype.").font(.system(size: 12.5)).foregroundStyle(FB.muted).frame(maxWidth: .infinity).padding(.top, 8)
                }
                .padding(.bottom, 24)
            }
            .background(FB.bg2)
        }
        .task { if app.catalog == nil { await app.loadCatalog() } }
    }

    private func heading(_ t: String) -> some View {
        Text(t).font(.system(size: 20, weight: .bold)).foregroundStyle(FB.text).padding(.horizontal, 12).padding(.top, 12).padding(.bottom, 4)
    }

    private func row(_ g: GroupRow) -> some View {
        Button { app.push(.group(g.id)) } label: {
            DiscoverRow(cover: g.cover, title: g.name, sub: "\(g.memberCount.formatted()) members · \(g.area)", detail: g.description)
        }
        .buttonStyle(FadePress())
    }
}

struct GroupDetailScreen: View {
    @EnvironmentObject var app: AppState
    let groupId: String

    var body: some View {
        SubScreen(title: "Group") {
            if let g = app.catalog?.groups.first(where: { $0.id == groupId }) {
                let joined = app.isSaved("group_join", g.id)
                let events = (app.catalog?.events ?? []).filter { $0.groupId == g.id }
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        Pic(path: g.cover ?? "cover/hills.jpg").aspectRatio(16 / 9, contentMode: .fit)
                        VStack(alignment: .leading, spacing: 6) {
                            Text(g.name).font(.system(size: 22, weight: .bold)).foregroundStyle(FB.text)
                            Text("Public group · \(g.memberCount.formatted()) members · \(g.area)").font(.system(size: 14)).foregroundStyle(FB.muted)
                            Text(g.description).font(.system(size: 16)).foregroundStyle(FB.text).padding(.top, 2)
                            HStack(spacing: 8) {
                                action(joined ? "checkmark" : "plus", joined ? "Joined" : "Join group", primary: !joined) {
                                    app.setSaved("group_join", g.id, !joined)
                                    toast(joined ? "You left the group. Mock only." : "You joined. Mock only, nobody is notified.")
                                }
                                action(app.isSaved("group", g.id) ? "bookmark.fill" : "bookmark", app.isSaved("group", g.id) ? "Saved" : "Save") { app.setSaved("group", g.id, !app.isSaved("group", g.id)) }
                            }
                            .padding(.vertical, 8)
                            MoveFromThis(sub: "muse can find friends who'd be into this and shape a plan.") {
                                app.makeAMove("something with friends from \(g.name)", from: SignalContext(kind: "group", id: g.id, title: g.name))
                            }
                        }
                        .padding(14).background(Color.white)

                        if !events.isEmpty {
                            SectionLabel("Events from this group")
                            ForEach(events) { ev in
                                Button { app.push(.publicEvent(ev.id)) } label: { DiscoverRow(cover: ev.cover, title: ev.title, sub: "\(sentenceCase(ev.whenText)) · \(ev.area)") }
                                    .buttonStyle(FadePress())
                            }
                        }
                        SectionLabel("Recent activity")
                        VStack(alignment: .leading, spacing: 0) {
                            ForEach(Array(g.activity.enumerated()), id: \.offset) { i, line in
                                HStack(alignment: .top, spacing: 10) {
                                    Circle().fill(FB.input).frame(width: 34, height: 34).overlay(Image(systemName: "person.fill").font(.system(size: 14)).foregroundStyle(FB.muted))
                                    VStack(alignment: .leading, spacing: 1) {
                                        Text("Group member").font(.system(size: 14, weight: .semibold)).foregroundStyle(FB.text)
                                        Text(line).font(.system(size: 15)).foregroundStyle(FB.text)
                                    }
                                    Spacer(minLength: 0)
                                }
                                .padding(.horizontal, 14).padding(.vertical, 10)
                                if i < g.activity.count - 1 { Hairline() }
                            }
                        }
                        .background(Color.white)
                    }
                    .padding(.bottom, 32)
                }
                .background(FB.bg2)
            } else {
                Text(app.catalog == nil ? "Loading…" : "This group isn't available.").foregroundStyle(FB.muted).padding(24)
            }
        }
        .task { if app.catalog == nil { await app.loadCatalog() } }
    }

    private func action(_ icon: String, _ label: String, primary: Bool = false, _ run: @escaping () -> Void) -> some View {
        Button(action: run) {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.system(size: 14, weight: .semibold))
                Text(label).font(.system(size: 15, weight: .bold))
            }
            .foregroundStyle(primary ? Color.white : FB.text).frame(maxWidth: .infinity).frame(height: 40)
            .background(primary ? FB.blue : FB.button, in: RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(FadePress())
    }
}

// a public mock event anyone could go to. different from the private event a plan makes.
struct PublicEventScreen: View {
    @EnvironmentObject var app: AppState
    let eventId: String

    var body: some View {
        SubScreen(title: "Event") {
            if let ev = app.catalog?.events.first(where: { $0.id == eventId }) {
                let group = app.catalog?.groups.first { $0.id == ev.groupId }
                let interested = app.isSaved("event", ev.id)
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        Pic(path: ev.cover ?? "cover/hills.jpg").aspectRatio(16 / 9, contentMode: .fit)
                        VStack(alignment: .leading, spacing: 8) {
                            Text(ev.whenText.uppercased()).font(.system(size: 13, weight: .bold)).foregroundStyle(FB.red)
                            Text(ev.title).font(.system(size: 22, weight: .bold)).foregroundStyle(FB.text)
                            Label(ev.area, systemImage: "mappin.and.ellipse").font(.system(size: 15)).foregroundStyle(FB.muted)
                            Label("Public · by \(ev.organizer)\(ev.capacity.map { " · \($0) spots" } ?? "")", systemImage: "globe.americas.fill").font(.system(size: 15)).foregroundStyle(FB.muted)
                            Button { app.setSaved("event", ev.id, !interested) } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: interested ? "star.fill" : "star").font(.system(size: 14))
                                    Text(interested ? "Interested" : "I'm interested").font(.system(size: 15, weight: .bold))
                                }
                                .foregroundStyle(interested ? FB.blue : FB.text).frame(maxWidth: .infinity).frame(height: 40)
                                .background(interested ? FB.blueSoft : FB.button, in: RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(FadePress()).padding(.top, 4)
                            MoveFromThis(sub: "muse asks the friends who are free then. the event's time and place stay as they are.") {
                                app.makeAMove("go to the \(ev.title.lowercased()) with friends", from: SignalContext(kind: "event", id: ev.id, title: ev.title))
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading).padding(16).background(Color.white)
                        VStack(alignment: .leading, spacing: 8) {
                            Text("About").font(.system(size: 17, weight: .bold)).foregroundStyle(FB.text)
                            Text(ev.description).font(.system(size: 15)).lineSpacing(3).foregroundStyle(FB.text)
                            Text("Fictional event for this prototype.").font(.system(size: 12.5)).foregroundStyle(FB.muted)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading).padding(16).background(Color.white).padding(.top, 8)
                        if let group {
                            SectionLabel("Hosted by a group")
                            Button { app.push(.group(group.id)) } label: { DiscoverRow(cover: group.cover, title: group.name, sub: "\(group.memberCount.formatted()) members · \(group.area)") }
                                .buttonStyle(FadePress())
                        }
                    }
                    .padding(.bottom, 32)
                }
                .background(FB.bg2)
            } else {
                Text(app.catalog == nil ? "Loading…" : "This event isn't available.").foregroundStyle(FB.muted).padding(24)
            }
        }
        .task { if app.catalog == nil { await app.loadCatalog() } }
    }
}
