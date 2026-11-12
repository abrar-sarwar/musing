import SwiftUI

// messenger. real group messaging through the api server, which checks membership.
// in a chat made for a plan, muse is available as a co-planner: it answers when someone
// writes @muse or taps one of its actions, and stays quiet otherwise.

struct MessagesScreen: View {
    @EnvironmentObject var app: AppState
    @State private var threads: [ThreadSummary] = []
    @State private var status = "Loading…"

    var body: some View {
        SubScreen(title: "Chats") {
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(threads) { t in
                        let others = t.memberIds.filter { $0 != app.userId }.compactMap { app.user($0) }
                        Button { app.push(.thread(t.id)) } label: {
                            HStack(spacing: 12) {
                                ZStack {
                                    if let a = others.first { Avatar(a, size: 36).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading) }
                                    if others.count > 1 { Avatar(others[1], size: 36).overlay(Circle().stroke(Color.white, lineWidth: 2)).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing) }
                                }
                                .frame(width: 56, height: 56)
                                VStack(alignment: .leading, spacing: 2) {
                                    HStack(spacing: 5) {
                                        Text(t.title).font(.system(size: 16, weight: .semibold)).foregroundStyle(FB.text)
                                        if t.hasMuse { Image(systemName: "sparkles").font(.system(size: 11, weight: .bold)).foregroundStyle(Muse.start).accessibilityLabel("muse is in this chat") }
                                    }
                                    if let last = t.last {
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
            .refreshable { await load() }
        }
        .task(id: "\(app.userId)-\(app.version)") {
            threads = []
            status = "Loading…"
            await load()
        }
        .onTableChange("thread_pings") { Task { await load() } }
    }

    private func load() async {
        let user = app.userId
        do {
            let list: ThreadList = try await API.get("/api/threads", user: user)
            guard user == app.userId, !Task.isCancelled else { return }
            threads = list.threads
            status = "No chats yet."
        } catch let e {
            guard user == app.userId, !Task.isCancelled else { return }
            status = errorText(e)
        }
    }
}

/// a message this phone has sent but the server has not confirmed yet
private struct Outgoing: Identifiable, Equatable {
    let id: String // the client id. resending uses the same one, so it is stored once.
    let body: String
    var failed = false
}

struct ThreadScreen: View {
    @EnvironmentObject var app: AppState
    @Environment(\.scenePhase) private var scenePhase
    let threadId: String
    @State private var detail: ThreadDetail?
    @State private var error: String?
    @State private var outgoing: [Outgoing] = []
    @State private var draft = ""
    @State private var museText: String? // muse's answer as it streams to the person who asked
    @State private var museBusy = false
    @State private var actionsHidden = false
    @FocusState private var typing: Bool

    private var museOn: Bool { (detail?.thread.hasMuse ?? false) && !(detail?.thread.museMuted ?? true) }
    private var messages: [Message] { detail?.messages ?? [] }
    /// sends not yet in the server's list. once a send shows up there it is dropped here.
    private var unsent: [Outgoing] {
        let known = Set(messages.compactMap(\.clientId))
        return outgoing.filter { !known.contains($0.id) }
    }

    var body: some View {
        SubScreen(title: detail?.thread.title ?? "Chat") {
            // one column: members, the messages (which take all spare room), muse actions, composer
            VStack(spacing: 0) {
            if let info = detail?.thread { memberStrip(info) }
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 4) {
                        if detail == nil { Text(error ?? "Loading…").foregroundStyle(FB.muted).padding(24) }
                        if let detail, detail.messages.isEmpty, unsent.isEmpty { Text("No messages yet. Say hi.").foregroundStyle(FB.muted).padding(24) }
                        let list = messages.filter { !($0.pending && museText != nil) }
                        ForEach(Array(list.enumerated()), id: \.element.id) { i, m in
                            if let stamp = timestamp(m, after: i > 0 ? list[i - 1] : nil) {
                                Text(stamp).font(.system(size: 12, weight: .medium)).foregroundStyle(FB.muted).padding(.top, 10).padding(.bottom, 2)
                            }
                            row(m, showName: i == 0 || list[i - 1].senderId != m.senderId || list[i - 1].kind != m.kind)
                        }
                        if let museText { museBubble(museText.isEmpty ? nil : museText, card: nil) }
                        ForEach(unsent) { o in
                            VStack(alignment: .trailing, spacing: 2) {
                                bubble(o.body, mine: true).opacity(o.failed ? 1 : 0.55)
                                if o.failed {
                                    Button { Task { await deliver(o) } } label: { Label("Not sent. Tap to retry", systemImage: "exclamationmark.circle").font(.system(size: 12, weight: .medium)).foregroundStyle(FB.red) }
                                } else {
                                    Text("Sending…").font(.system(size: 11)).foregroundStyle(FB.muted)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .trailing)
                        }
                        if detail != nil, let error { Text(error).font(.system(size: 12)).foregroundStyle(FB.muted).padding(.top, 6) }
                        Color.clear.frame(height: 1).id("end")
                    }
                    .padding(.horizontal, 12).padding(.vertical, 8)
                }
                .frame(maxHeight: .infinity)
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: messages) { scroll(proxy) }
                .onChange(of: outgoing) { scroll(proxy) }
                .onChange(of: museText) { scroll(proxy, animated: false) }
                .onChange(of: typing) { if typing { DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { scroll(proxy) } } }
                .onAppear { scroll(proxy, animated: false) }
            }
            if museOn && !actionsHidden { actionRow }
            composer
            }
        }
        .task(id: "\(app.userId)-\(app.version)") {
            detail = nil
            outgoing = []
            await load()
        }
        // other people's messages, muse's replies and votes land here without a refresh
        .onTableChange("thread_pings") { Task { await load() } }
        .onChange(of: scenePhase) { if scenePhase == .active { Task { await load() } } }
    }

    // ---------- loading and sending ----------

    private func load() async {
        let user = app.userId
        do {
            let d: ThreadDetail = try await API.get("/api/threads/\(threadId)", user: user)
            guard user == app.userId, !Task.isCancelled else { return }
            detail = d
            error = nil
        } catch let e {
            guard user == app.userId, !Task.isCancelled else { return }
            // keep what is on screen. a dropped connection should not blank the chat.
            error = detail == nil ? errorText(e) : "Reconnecting…"
        }
    }

    private func send() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        draft = ""
        let o = Outgoing(id: UUID().uuidString, body: text)
        outgoing.append(o)
        Task { await deliver(o) }
    }

    // a normal message never waits on muse. if it mentions @muse, muse is asked afterwards.
    private func deliver(_ o: Outgoing) async {
        if let i = outgoing.firstIndex(where: { $0.id == o.id }) { outgoing[i].failed = false }
        do {
            let r: SendResult = try await API.post("/api/threads/\(threadId)/messages", user: app.userId, body: ["body": o.body, "clientId": o.id])
            await load()
            outgoing.removeAll { $0.id == o.id }
            if r.wantsMuse { await askMuse(["messageId": r.message.id]) }
        } catch {
            if let i = outgoing.firstIndex(where: { $0.id == o.id }) { outgoing[i].failed = true }
        }
    }

    private func askMuse(_ body: [String: Any]) async {
        guard !museBusy else { return }
        museBusy = true
        museText = ""
        var failure: String?
        do {
            try await API.stream("/api/threads/\(threadId)/muse", user: app.userId, body: body) { event, data in
                switch event {
                case "delta": museText = (museText ?? "") + (data["text"] as? String ?? "")
                case "restart": museText = ""
                case "error": failure = data["message"] as? String ?? "muse couldn't answer"
                default: break
                }
            }
        } catch let e { failure = errorText(e) }
        await load()
        museText = nil
        museBusy = false
        // muse failing never blocks the chat. it just says so.
        if let failure { toast(failure) }
    }

    private func vote(_ p: Proposal, _ yes: Bool) {
        Task {
            do {
                try await API.data("POST", "/api/proposals/\(p.id)/vote", user: app.userId, body: ["vote": yes ? "yes" : "no"])
            } catch let e { toast(errorText(e)) }
            await load()
        }
    }

    private func setMuted(_ muted: Bool) {
        Task {
            do {
                try await API.data("POST", "/api/threads/\(threadId)/mute", user: app.userId, body: ["muted": muted])
                toast(muted ? "muse is muted in this chat." : "muse is back. write @muse to ask it something.")
            } catch let e { toast(errorText(e)) }
            await load()
        }
    }

    private func scroll(_ proxy: ScrollViewProxy, animated: Bool = true) {
        if animated { withAnimation(.easeOut(duration: 0.2)) { proxy.scrollTo("end", anchor: .bottom) } } else { proxy.scrollTo("end", anchor: .bottom) }
    }

    /// a time label when the chat starts or picks up again after a gap
    private func timestamp(_ m: Message, after previous: Message?) -> String? {
        guard let date = parseDate(m.createdAt) else { return nil }
        if let previous, let before = parseDate(previous.createdAt), date.timeIntervalSince(before) < 15 * 60 { return nil }
        return Calendar.current.isDateInToday(date) ? date.formatted(.dateTime.hour().minute()) : date.formatted(.dateTime.weekday(.abbreviated).hour().minute())
    }

    // ---------- pieces ----------

    private func memberStrip(_ info: ThreadDetail.Info) -> some View {
        HStack(spacing: 8) {
            HStack(spacing: -8) {
                ForEach(info.members.prefix(4)) { p in Avatar(p, size: 26).overlay(Circle().stroke(Color.white, lineWidth: 1.5)) }
                if info.hasMuse { MuseAvatar(size: 26).overlay(Circle().stroke(Color.white, lineWidth: 1.5)) }
            }
            VStack(alignment: .leading, spacing: 0) {
                Text(info.members.map { $0.id == app.userId ? "you" : firstName($0.name).lowercased() }.joined(separator: ", ")).font(.system(size: 13, weight: .medium)).foregroundStyle(FB.text).lineLimit(1)
                if info.hasMuse {
                    Text(info.museMuted ? "muse is muted here" : "+ muse, an AI co-planner. write @muse to ask it.").font(.system(size: 12)).foregroundStyle(Muse.text).lineLimit(1)
                }
            }
            Spacer(minLength: 0)
            if info.hasMuse {
                Button { setMuted(!info.museMuted) } label: {
                    Image(systemName: info.museMuted ? "bell.slash.fill" : "bell").font(.system(size: 15)).foregroundStyle(info.museMuted ? FB.muted : Muse.text)
                        .frame(width: 34, height: 34).background(info.museMuted ? FB.input : Muse.soft, in: Circle())
                }
                .accessibilityLabel(info.museMuted ? "Unmute muse" : "Mute muse")
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 7)
        .overlay(alignment: .bottom) { Hairline() }
    }

    @ViewBuilder private func row(_ m: Message, showName: Bool) -> some View {
        let mine = m.senderId == app.userId
        if m.kind == "muse" || m.senderId == nil {
            museBubble(m.pending ? nil : m.body, card: m.card, showName: showName)
        } else if mine {
            bubble(m.body ?? "", mine: true).frame(maxWidth: .infinity, alignment: .trailing)
        } else {
            let sender = app.user(m.senderId)
            HStack(alignment: .bottom, spacing: 8) {
                if let sender { Avatar(sender, size: 28) } else { Circle().fill(FB.input).frame(width: 28, height: 28) }
                VStack(alignment: .leading, spacing: 2) {
                    if showName { Text(sender.map { firstName($0.name) } ?? "Someone").font(.system(size: 12)).foregroundStyle(FB.muted).padding(.leading, 12) }
                    bubble(m.body ?? "", mine: false)
                }
                Spacer(minLength: 40)
            }
            .padding(.top, showName ? 6 : 0)
        }
    }

    private func bubble(_ text: String, mine: Bool) -> some View {
        Text(text).font(.system(size: 16)).foregroundStyle(mine ? Color.white : FB.text)
            .padding(.horizontal, 12).padding(.vertical, 8)
            .background(mine ? FB.blue : FB.input, in: RoundedRectangle(cornerRadius: 18))
            .padding(.leading, mine ? 50 : 0)
    }

    /// muse in the chat: a neutral surface with a small purple label that says what it is.
    /// `text` nil means it is still writing.
    private func museBubble(_ text: String?, card: PlanCard?, showName: Bool = true) -> some View {
        HStack(alignment: .bottom, spacing: 8) {
            MuseAvatar(size: 28)
            VStack(alignment: .leading, spacing: 4) {
                if showName {
                    HStack(spacing: 4) {
                        Text("muse").font(.system(size: 12, weight: .bold))
                        Text("AI").font(.system(size: 9.5, weight: .heavy)).padding(.horizontal, 4).padding(.vertical, 1).background(Muse.soft, in: RoundedRectangle(cornerRadius: 4))
                    }
                    .foregroundStyle(Muse.text).padding(.leading, 4)
                }
                if let text {
                    if !text.isEmpty {
                        Text(text).font(.system(size: 16)).foregroundStyle(FB.text)
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .background(Color.white, in: RoundedRectangle(cornerRadius: 18))
                            .overlay(RoundedRectangle(cornerRadius: 18).stroke(Muse.line, lineWidth: 1))
                    }
                } else {
                    TypingDots().padding(.horizontal, 14).padding(.vertical, 11)
                        .background(Color.white, in: RoundedRectangle(cornerRadius: 18)).overlay(RoundedRectangle(cornerRadius: 18).stroke(Muse.line, lineWidth: 1))
                        .accessibilityLabel("muse is typing")
                }
                if let card {
                    switch card.type {
                    case "plan": PlanMessageCard(card: card)
                    case "proposal":
                        if let p = detail?.proposals.first(where: { $0.id == card.proposalId }) { ProposalCard(proposal: p, vote: { vote(p, $0) }) }
                        if let items = card.items, !items.isEmpty { FindsCard(items: items) }
                    default: if let items = card.items, !items.isEmpty { FindsCard(items: items) }
                    }
                }
            }
            Spacer(minLength: 30)
        }
        .padding(.top, showName ? 6 : 0)
    }

    // compact muse actions. each one does something real, and the row can be dismissed.
    private var actionRow: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 6) {
                Image(systemName: "sparkles").font(.system(size: 11, weight: .bold)).foregroundStyle(Muse.start)
                chip("recap the plan") { Task { await askMuse(["action": "recap"]) } }
                chip("show our finds") { Task { await askMuse(["action": "finds"]) } }
                chip("find food nearby") { Task { await askMuse(["action": "food"]) } }
                chip("suggest a change") {
                    draft = "@muse can we "
                    typing = true
                }
                Button { actionsHidden = true } label: { Image(systemName: "xmark").font(.system(size: 10, weight: .bold)).foregroundStyle(FB.muted).frame(width: 26, height: 26) }
                    .accessibilityLabel("Hide muse actions")
            }
            .padding(.horizontal, 12).padding(.vertical, 6)
        }
        .scrollIndicators(.hidden)
        .disabled(museBusy)
        .opacity(museBusy ? 0.5 : 1)
    }

    private func chip(_ label: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label).font(.system(size: 13, weight: .semibold)).foregroundStyle(Muse.text)
                .padding(.horizontal, 10).padding(.vertical, 6).background(Muse.soft, in: Capsule())
        }
        .buttonStyle(FadePress())
    }

    private var composer: some View {
        let ready = !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        return HStack(alignment: .bottom, spacing: 8) {
            TextField(museOn ? "Message, or @muse" : "Message", text: $draft, axis: .vertical)
                .font(.system(size: 16)).foregroundStyle(FB.text).lineLimit(1...5).focused($typing)
                .padding(.horizontal, 14).padding(.vertical, 8)
                .background(FB.input, in: RoundedRectangle(cornerRadius: 19))
                .disabled(detail == nil)
            Button(action: send) {
                Image(systemName: "arrow.up.circle.fill").font(.system(size: 32)).foregroundStyle(ready ? FB.blue : FB.divider)
            }
            .disabled(!ready)
            .accessibilityLabel("Send")
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .background(Color.white)
        .overlay(alignment: .top) { Hairline() }
    }
}

private struct TypingDots: View {
    @State private var on = false
    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { i in
                Circle().fill(Muse.start).frame(width: 6, height: 6).opacity(on ? 1 : 0.3)
                    .animation(.easeInOut(duration: 0.6).repeatForever().delay(Double(i) * 0.2), value: on)
            }
        }
        .onAppear { on = true }
    }
}

/// catalog records muse pulled up: events, groups and listings, each opening its own screen
struct FindsCard: View {
    @EnvironmentObject var app: AppState
    let items: [PlanCard.Found]

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.element) { i, f in
                Button { app.push(f.kind == "event" ? .publicEvent(f.id) : f.kind == "group" ? .group(f.id) : .listing(f.id)) } label: {
                    HStack(spacing: 10) {
                        Image(systemName: f.kind == "event" ? "calendar" : f.kind == "group" ? "person.3.fill" : "storefront.fill").font(.system(size: 13)).foregroundStyle(FB.blue).frame(width: 22)
                        VStack(alignment: .leading, spacing: 0) {
                            Text(f.title).font(.system(size: 14, weight: .semibold)).foregroundStyle(FB.text).lineLimit(1)
                            Text(f.sub).font(.system(size: 12.5)).foregroundStyle(FB.muted).lineLimit(1)
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right").font(.system(size: 11, weight: .semibold)).foregroundStyle(FB.muted)
                    }
                    .padding(.horizontal, 12).padding(.vertical, 8)
                }
                .buttonStyle(RowPress())
                if i < items.count - 1 { Hairline() }
            }
        }
        .frame(width: 260)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(FB.divider, lineWidth: 0.5))
    }
}

/// a change the group votes on. the plan moves only when everyone going agrees.
struct ProposalCard: View {
    let proposal: Proposal
    let vote: (Bool) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("change the plan?").font(.system(size: 12, weight: .bold)).foregroundStyle(Muse.text)
            Text(proposal.summary).font(.system(size: 15, weight: .semibold)).foregroundStyle(FB.text)
            switch proposal.status {
            case "open":
                Text("\(proposal.yes) of \(proposal.needed) agreed. it changes only if everyone going does.").font(.system(size: 12.5)).foregroundStyle(FB.muted)
                if proposal.canVote {
                    HStack(spacing: 8) {
                        button(proposal.myVote == "yes" ? "you agreed" : "agree", primary: true, selected: proposal.myVote == "yes") { vote(true) }
                        button("keep it as is", primary: false, selected: false) { vote(false) }
                    }
                    .padding(.top, 2)
                }
            case "accepted": Label("everyone agreed. the plan is updated.", systemImage: "checkmark.circle.fill").font(.system(size: 12.5, weight: .medium)).foregroundStyle(FB.green)
            case "declined": Label("not everyone agreed. the plan stays as it was.", systemImage: "xmark.circle").font(.system(size: 12.5, weight: .medium)).foregroundStyle(FB.muted)
            default: Label("this vote ended without a change.", systemImage: "clock").font(.system(size: 12.5, weight: .medium)).foregroundStyle(FB.muted)
            }
        }
        .padding(12)
        .frame(width: 260, alignment: .leading)
        .background(Muse.softer, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Muse.line, lineWidth: 1))
    }

    private func button(_ label: String, primary: Bool, selected: Bool, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label).font(.system(size: 14, weight: .bold)).foregroundStyle(primary ? Color.white : FB.text)
                .frame(maxWidth: .infinity).frame(height: 34)
                .background(primary ? FB.blue.opacity(selected ? 0.6 : 1) : FB.button, in: RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(FadePress())
        .disabled(selected)
    }
}

struct PlanMessageCard: View {
    @EnvironmentObject var app: AppState
    let card: PlanCard

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Rectangle().fill(Muse.entryGradient).frame(height: 4)
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 4) {
                    Image(systemName: "sparkles").font(.system(size: 12, weight: .semibold))
                    Text("it's happening").font(.system(size: 12, weight: .semibold))
                }
                .foregroundStyle(Muse.text)
                Text(card.title ?? "").font(.system(size: 16, weight: .bold)).foregroundStyle(FB.text)
                Text([card.when, card.`where`].compactMap { $0 }.joined(separator: " · ")).font(.system(size: 13)).foregroundStyle(FB.muted)
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
                HStack(spacing: 8) {
                    if let id = card.planId { small("sparkles", "Plan") { app.push(.plan(id)) } }
                    if let event = card.eventId { small("calendar", "Event") { app.push(.event(event)) } }
                }
                .padding(.top, 6)
            }
            .padding(12)
        }
        .frame(width: 260, alignment: .leading)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(FB.divider, lineWidth: 0.5))
    }

    private func small(_ icon: String, _ label: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: icon).font(.system(size: 12))
                Text(label).font(.system(size: 14, weight: .semibold))
            }
            .foregroundStyle(FB.text).frame(maxWidth: .infinity).frame(height: 32).background(FB.input, in: RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(FadePress())
    }
}
