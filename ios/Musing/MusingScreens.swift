import SwiftUI

private struct CardBox<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 0) { content }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white)
    }
}

/// what the starter has chosen for a draft that has not gone out yet. kept outside the
/// screen so the choices survive muse redoing the draft (the redo is a new plan, a new screen).
@MainActor
final class DraftChoices: ObservableObject {
    static let shared = DraftChoices()
    @Published var audience = "friends" // close | friends | mutual
    @Published var waitFor = 2
    @Published var expires = "1w"

    func reset() {
        audience = "friends"
        waitFor = 2
        expires = "1w"
    }
}

// what muse actually did, step by step. live from the muse_trace table.
// summaries are written server side and never contain a private limit.
struct TracePanel: View {
    @EnvironmentObject var app: AppState
    let planId: String?
    @State private var rows: [MuseTrace] = []
    private let colors: [String: UInt32] = ["understand": 0x0ea5e9, "match": 0x7c3aed, "coordinate": 0xec4899, "create": 0x16a34a, "suggest": 0xf59e0b]

    var body: some View {
        Group {
            if app.traceOn {
                VStack(alignment: .leading, spacing: 8) {
                    Text("muse trace").font(.system(size: 12, weight: .bold)).foregroundStyle(Color(hex: 0xc4b5fd))
                    if rows.isEmpty { Text("no muse calls yet.").font(.system(size: 13)).foregroundStyle(Color(hex: 0x9ca3af)) }
                    ForEach(rows) { r in
                        HStack(alignment: .top, spacing: 8) {
                            Text(r.job).font(.system(size: 11, weight: .bold)).foregroundStyle(.white).frame(width: 78).padding(.vertical, 2)
                                .background(colors[r.job].map { Color(hex: $0) } ?? FB.muted, in: RoundedRectangle(cornerRadius: 6))
                            VStack(alignment: .leading, spacing: 0) {
                                Text(r.summary).font(.system(size: 13)).foregroundStyle(r.ok ? Color(hex: 0xf3f4f6) : Color(hex: 0xfca5a5)).lineLimit(2)
                                Text((r.model == "cache" ? "replayed from cache" : "\(r.model) · \(String(format: "%.1f", Double(r.latencyMs) / 1000))s") + (r.ok ? "" : " · failed")).font(.system(size: 11)).foregroundStyle(Color(hex: 0x9ca3af))
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading).padding(12)
                .background(Color(hex: 0x16131f), in: RoundedRectangle(cornerRadius: UI.cardRadius))
                .accessibilityLabel("muse trace")
            }
        }
        .task(id: "\(app.traceOn)-\(app.version)") { await load() }
        .onTableChange("muse_trace") { Task { await load() } }
    }

    private func load() async {
        guard app.traceOn else { return }
        guard let all: [MuseTrace] = try? await Supa.select("muse_trace", "select=*&order=id.desc&limit=\(planId == nil ? 8 : 40)") else { return }
        rows = planId.map { id in Array(all.filter { $0.planId == id || $0.planId == nil }.prefix(8)) } ?? all
    }
}

// "what if..." is the open counteroffer. "just between us" is the private limit:
// muse plans around it and never repeats it. either one triggers a live re-solve.
struct WhatIf: View {
    @EnvironmentObject var app: AppState
    let planId: String
    let existingLimit: String?
    /// two or three changes that fit this plan. tapping one fills the box, it does not send.
    var suggestions: [String] = []
    let onDone: () -> Void
    let onClose: () -> Void
    @State private var offer = ""
    @State private var limit: String
    @State private var busy = false
    @State private var stream = ""
    @State private var error: String?

    init(planId: String, existingLimit: String?, suggestions: [String] = [], onDone: @escaping () -> Void, onClose: @escaping () -> Void) {
        self.planId = planId
        self.existingLimit = existingLimit
        self.suggestions = suggestions
        self.onDone = onDone
        self.onClose = onClose
        _limit = State(initialValue: existingLimit ?? "")
    }

    var body: some View {
        let o = offer.trimmingCharacters(in: .whitespacesAndNewlines)
        let l = limit.trimmingCharacters(in: .whitespacesAndNewlines)
        let limitChanged = l != (existingLimit ?? "")
        let canSend = !busy && (o.count > 1 || (limitChanged && l.count > 1))
        VStack(alignment: .leading, spacing: 8) {
            Text(Copy.whatIf).font(.system(size: 14, weight: .bold)).foregroundStyle(FB.text)
            field("Sunday instead? Somewhere closer?", $offer, FB.input)
            if !suggestions.isEmpty {
                // stacked, not wrapped: each idea is a full sentence
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(suggestions, id: \.self) { s in
                        let on = offer == s
                        Button { offer = on ? "" : s } label: {
                            Text(s).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(on ? Color.white : FB.blue).multilineTextAlignment(.leading)
                                .padding(.horizontal, 12).padding(.vertical, 8)
                                .background(on ? FB.blue : FB.blueSoft, in: RoundedRectangle(cornerRadius: UI.buttonRadius))
                        }
                        .buttonStyle(FadePress()).disabled(busy)
                    }
                }
                .accessibilityLabel("ideas that fit this plan")
            }
            HStack(spacing: 5) {
                Image(systemName: "lock.fill").font(.system(size: 11)).foregroundStyle(Muse.text)
                Text(Copy.privateLimit).font(.system(size: 14, weight: .bold)).foregroundStyle(Muse.text)
            }
            .padding(.top, 6)
            field("Anything muse should quietly work around", $limit, Muse.soft)
            Text(Copy.privateNote).font(.system(size: 12)).foregroundStyle(FB.muted)

            if busy || !stream.isEmpty { MuseBubble(text: stream, thinking: busy, label: busy ? Copy.solving : nil) }
            if let error { Text("muse couldn't rework it (\(error)). the plan stays as it was.").font(.system(size: 14)).foregroundStyle(FB.red) }

            HStack(spacing: 8) {
                QuietButton(label: "Never mind", disabled: busy, action: onClose)
                GradientButton(label: busy ? "Reworking" : "Ask muse", busy: busy, disabled: !canSend, fill: true) {
                    Task { await send(offer: o, limit: limitChanged ? l : nil) }
                }
            }
            .padding(.top, 6)
        }
    }

    private func field(_ placeholder: String, _ text: Binding<String>, _ fill: Color) -> some View {
        TextField(placeholder, text: text, axis: .vertical).font(.system(size: 16)).foregroundStyle(FB.text).lineLimit(1...4)
            .textInputAutocapitalization(.never).disabled(busy)
            .padding(.horizontal, 12).padding(.vertical, 10).background(fill, in: RoundedRectangle(cornerRadius: 12))
            .onChange(of: text.wrappedValue) { if text.wrappedValue.count > 200 { text.wrappedValue = String(text.wrappedValue.prefix(200)) } }
    }

    private func send(offer: String, limit: String?) async {
        busy = true
        stream = ""
        error = nil
        var streamError: String?
        do {
            let body: [String: Any] = ["counteroffer": offer.isEmpty ? NSNull() : offer, "privateLimit": limit.map { $0.isEmpty ? NSNull() : $0 as Any } ?? NSNull()]
            try await API.stream("/api/plans/\(planId)/whatif", user: app.userId, body: body) { event, data in
                switch event {
                case "delta": stream += data["text"] as? String ?? ""
                case "restart": stream = ""
                case "done": stream = data["note"] as? String ?? stream
                case "error": streamError = data["message"] as? String ?? "muse had trouble"
                default: break
                }
            }
            if let streamError { throw ApiError(message: streamError) }
            busy = false
            onDone()
        } catch let e {
            error = errorText(e)
            busy = false
        }
    }
}

// one plan, as this person is allowed to see it. the starter sees the mix and the
// count. a friend sees their own ask and the count. names appear only once it's on.
struct PlanScreen: View {
    @EnvironmentObject var app: AppState
    let planId: String
    @State private var plan: PlanView?
    @State private var loading = true
    @State private var busy: String?
    @State private var error: String?
    // `-whatif YES` as a launch argument opens the box straight away, for screenshots
    @State private var whatIfOpen = UserDefaults.standard.bool(forKey: "whatif")
    @State private var matchedOpen = true
    @ObservedObject private var choices = DraftChoices.shared
    /// the explicit last step before a draft goes out
    @State private var confirming = false
    @State private var another = false

    var body: some View {
        SubScreen(title: title, trailing: trailing) {
            if let p = plan {
                ScrollView {
                    VStack(alignment: .leading, spacing: UI.gap) {
                        content(p)
                        TracePanel(planId: p.id)
                    }
                    .padding(.horizontal, UI.margin).padding(.top, 12).padding(.bottom, 40)
                }
                .scrollDismissesKeyboard(.interactively)
            } else {
                Text(loading ? "One sec" : "This plan isn't here anymore.").foregroundStyle(FB.muted).padding(24)
            }
        }
        .task(id: "\(app.userId)-\(app.version)") {
            plan = nil
            loading = true
            await load()
        }
        // live: the other phone's answer or a re-solve shows up here within a second or two
        .onTableChange("plans") { Task { await load() } }
    }

    private var title: String {
        guard let p = plan else { return "Plan" }
        if p.role == "starter", p.state == "draft" { return "Your draft" }
        return p.role == "starter" ? "Your plan" : "\(firstName(p.starter.name))'s plan"
    }

    /// the chat once it's on, and the events list
    private var trailing: [(icon: String, label: String, action: () -> Void)] {
        var out: [(icon: String, label: String, action: () -> Void)] = []
        if let thread = plan?.threadId { out.append(("bubble.left.and.bubble.right", "Open the chat", { app.push(.thread(thread)) })) }
        out.append(("calendar", "Events", { app.push(.events) }))
        return out
    }

    private func load() async {
        let user = app.userId
        let p: PlanView? = try? await API.get("/api/plans/\(planId)", user: user)
        guard user == app.userId, !Task.isCancelled else { return }
        plan = p
        loading = false
    }

    private func act(_ name: String, leaveAfter: Bool = false, _ work: @escaping () async throws -> Void) {
        busy = name
        error = nil
        Task {
            do {
                try await work()
                if leaveAfter { app.back() } else { await load() }
            } catch let e {
                error = errorText(e)
                // the plan may have closed while this was open (it expired, or it faded): show what it is now
                await load()
            }
            busy = nil
        }
    }

    private func answer(_ status: String) {
        act(status) { try await API.data("POST", "/api/plans/\(planId)/respond", user: app.userId, body: ["status": status]) }
    }

    /// a different idea for the same thought. muse redoes the draft; the old one is replaced.
    private func tryAnother() {
        another = true
        error = nil
        Task {
            do {
                var newId: String?
                var streamError: String?
                try await API.stream("/api/muse/match", user: app.userId, body: ["planId": planId, "revise": "try a different idea for this, not the same plan"]) { event, data in
                    switch event {
                    case "done": newId = data["planId"] as? String
                    case "error": streamError = data["message"] as? String ?? "muse had trouble"
                    default: break
                    }
                }
                if let streamError { throw ApiError(message: streamError) }
                guard let newId else { throw ApiError(message: "muse didn't finish the plan") }
                another = false
                app.back()
                app.push(.plan(newId))
            } catch let e {
                error = errorText(e)
                another = false
            }
        }
    }

    private func cancel() {
        act("cancel", leaveAfter: true) { try await API.data("DELETE", "/api/plans/\(planId)", user: app.userId) }
    }

    @ViewBuilder private func content(_ p: PlanView) -> some View {
        let starter = p.role == "starter"
        let need = max(0, p.quorum - p.downCount)
        let open = p.state == "proposing"
        let myStatus = p.me?.status
        let who = firstName(p.starter.name)

        // muse stays with you: it made the draft, it watches the signal, it is there when it's on
        if starter, p.state != "faded" {
            HStack(spacing: 12) {
                MuseFace(expression: p.state == "happening" ? .hype : .awake, size: 56)
                VStack(alignment: .leading, spacing: 2) {
                    Text(p.state == "draft" ? "muse made you a move." : p.state == "happening" ? "it's happening." : "signal sent.").font(.system(size: 22, weight: .heavy)).foregroundStyle(FB.text)
                    Text(p.state == "draft" ? "here's what i came up with. nothing has gone to anyone yet." : p.state == "happening" ? "the chat and the event are yours." : "waiting for your people. \(p.downCount) of \(p.quorum) in so far.")
                        .font(.system(size: 14)).foregroundStyle(FB.muted).fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
        }

        PlanSummaryCard(plan: p, detail: true)

        // muse's voice: the pitch for a draft, the personal ask for a friend, the note after a re-solve
        let pitch = starter && p.state == "draft" ? p.pitch : nil
        let ask = !starter && open && myStatus == "pending" && p.museOn ? p.me?.personalAsk : nil
        let note = p.state != "draft" ? p.note : nil
        let raw = !p.museOn ? p.rawText : nil
        if pitch != nil || ask != nil || note != nil || raw != nil {
            VStack(alignment: .leading, spacing: 10) {
                if let pitch {
                    // muse is already at the top of this screen, so its reason is just the words
                    Card(tint: true) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("WHY THIS FITS").font(UI.kicker).tracking(0.3).foregroundStyle(Muse.text)
                            Text(pitch).font(.system(size: 16)).lineSpacing(3).foregroundStyle(FB.text).fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                if let ask { MuseBubble(text: ask) }
                if let raw { Text("\(starter ? "You asked" : "\(who) asked"): \u{201C}\(raw)\u{201D}").font(.system(size: 16)).foregroundStyle(FB.text) }
                if let note { MuseBubble(text: note, label: p.version > 1 ? "small update" : nil) }
            }
        }

        // the count. no names until it's on.
        if open {
            Card {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 10) {
                        HStack(spacing: 6) {
                            ForEach(0..<max(p.quorum, 0), id: \.self) { i in
                                Circle().fill(i < p.downCount ? Muse.start : .clear).frame(width: 14, height: 14).overlay(Circle().stroke(Muse.start, lineWidth: 2))
                            }
                        }
                        Text(need > 0 ? "\(p.downCount) of \(p.quorum) in. \(need) more and it's on." : "That's enough. Making it real.")
                            .font(.system(size: 15, weight: .semibold)).foregroundStyle(FB.text)
                    }
                    fine(starter ? "You'll see who's in once it's on. You never see who passed or who said maybe, and neither does anyone else." : "Your answer stays between you and muse until it's on.")
                }
            }
        }
        if p.state == "faded" { Card { Text(Copy.faded).font(UI.body).foregroundStyle(FB.text) } }

        // what muse found around this plan, on its own page
        if p.state != "faded", let summary = discoverSummary(p) {
            DiscoverSummaryCard(summary: summary) { app.push(.discoverTogether(p.id)) }
        }

        // the mix: starter only
        // a draft is still the starter's to change: who is asked, and what muse planned
        if starter, p.state == "draft" {
            DraftEditor(plan: p, onChanged: { plan = $0 }, onReplaced: { id in
                app.back()
                app.push(.plan(id))
            })
        }
        if starter, let picks = p.picks, !picks.isEmpty, p.state != "happening", p.state != "faded", p.state != "draft" {
            Button { withAnimation(.easeOut(duration: 0.15)) { matchedOpen.toggle() } } label: {
                HStack {
                    SectionTitle("Matched friends")
                    Image(systemName: "chevron.down").font(.system(size: 13, weight: .semibold)).foregroundStyle(FB.muted).rotationEffect(.degrees(matchedOpen ? 0 : -90))
                }
            }
            .buttonStyle(FadePress()).padding(.top, 8)
            if matchedOpen {
                ForEach(picks, id: \.user.id) { pick in
                    Card {
                        HStack(spacing: 12) {
                            Avatar(pick.user, size: 44)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(pick.user.name).font(.system(size: 16, weight: .semibold)).foregroundStyle(FB.text)
                                if let reason = pick.reason { Text("\u{201C}\(reason)\u{201D}").font(.system(size: 14)).foregroundStyle(FB.muted).fixedSize(horizontal: false, vertical: true) }
                            }
                            Spacer(minLength: 0)
                        }
                    }
                }
                if p.state == "draft" { fine("Each of them gets their own quiet ask from muse. None of them sees who else was asked.") }
            }
        }

        // actions
        VStack(alignment: .leading, spacing: 10) {
            if let error { Text(sentenceCase(error)).font(.system(size: 14)).foregroundStyle(FB.red) }

            if starter, p.state == "draft" {
                SectionTitle("Before it goes out").padding(.top, 4)
                OptionRow(label: "Send to", options: [("close", "Close friends"), ("friends", "Friends only"), ("mutual", "Friends of friends")], selection: $choices.audience, disabled: busy != nil)
                OptionRow(label: "Wait for at least", options: (1...5).map { ($0, peopleCount($0)) }, selection: $choices.waitFor, disabled: busy != nil)
                OptionRow(label: "Expires after", options: [("1d", "1 day"), ("3d", "3 days"), ("1w", "1 week"), ("2w", "2 weeks")], selection: $choices.expires, disabled: busy != nil)
                GradientButton(label: Copy.sendIt, icon: "paperplane.fill", big: true, busy: busy == "send", disabled: another) { confirming = true }
                    .confirmationDialog("Send this signal?", isPresented: $confirming, titleVisibility: .visible) {
                        Button("Send signal") {
                            let body: [String: Any] = ["audience": choices.audience, "waitFor": choices.waitFor, "expires": choices.expires]
                            act("send") {
                                try await API.data("POST", "/api/plans/\(planId)/send", user: app.userId, body: body)
                                choices.reset()
                            }
                        }
                        Button("Not yet", role: .cancel) {}
                    } message: {
                        Text("\(audienceLabel(choices.audience)) can see it and join. \(friendCount(p.invited).capitalized) \(p.invited == 1 ? "gets" : "get") a private ask from muse. It's on once \(peopleCount(min(choices.waitFor, max(1, p.invited)))) \(min(choices.waitFor, max(1, p.invited)) == 1 ? "is" : "are") in.")
                    }
                if p.museOn { QuietButton(label: another ? "Muse is thinking of another" : "Try another idea", disabled: another || busy != nil, fill: true) { tryAnother() } }
                QuietButton(label: Copy.notThis, fill: true, outline: true) { cancel() }
                fine("This draft is private. Nothing is shared and nobody is asked until you tap Send signal.")
            }

            if !starter, open, !whatIfOpen {
                if myStatus == "down" {
                    banner("You're in.")
                } else {
                    GradientButton(label: Copy.down, big: true, busy: busy == "down", disabled: p.solving || busy != nil) { answer("down") }
                }
                HStack(spacing: 10) {
                    if myStatus != "maybe" { QuietButton(label: Copy.maybe, disabled: p.solving || busy != nil, fill: true) { answer("maybe") } }
                    if p.museOn { QuietButton(label: Copy.whatIf, disabled: p.solving, fill: true) { whatIfOpen = true } }
                }
                if myStatus != "out" { QuietButton(label: Copy.pass, disabled: busy != nil, fill: true, outline: true) { answer("out") } }
                if myStatus == "maybe" { fine("You said maybe. Only you can see that, and it doesn't count either way.") }
                if myStatus == "out" { fine("You passed. Nobody was told.") }
            }
            if !starter, p.state == "happening", myStatus != "down" {
                GradientButton(label: Copy.down, big: true, busy: busy == "down") { answer("down") }
            }

            if starter, open, !whatIfOpen {
                if p.museOn { QuietButton(label: Copy.whatIf, disabled: p.solving, fill: true) { whatIfOpen = true } }
                QuietButton(label: "Call it off quietly", fill: true, outline: true) { cancel() }
            }

            if open, whatIfOpen {
                Card {
                    WhatIf(planId: p.id, existingLimit: p.me?.privateLimit, suggestions: p.whatIfs ?? [], onDone: {
                        Task {
                            await load()
                            whatIfOpen = false
                        }
                    }, onClose: { whatIfOpen = false })
                }
            }
            if open, !p.museOn { fine("Muse is off for this one, so there's no \u{201C}what if\u{201D} and no quiet re-solve. It's a yes, a maybe or a no.") }

            if p.state == "happening" {
                if let thread = p.threadId {
                    GradientButton(label: "Open the chat", icon: "bubble.left.and.bubble.right.fill", big: true) { app.push(.thread(thread)) }
                } else if p.museOn {
                    fine("Muse is setting up the chat and the event.")
                } else {
                    fine("Enough people said yes. Without muse there's no chat or event made for you. That part is on you.")
                }
                if let event = p.eventId { QuietButton(label: "See the event", fill: true) { app.push(.event(event)) } }
            }

            if starter, p.state == "faded" {
                GradientButton(label: Copy.runItBack, icon: "arrow.clockwise", big: true) {
                    app.handoff = p.rawText ?? p.activity ?? ""
                    cancel()
                }
                QuietButton(label: "Let it go", fill: true, outline: true) { cancel() }
            }
        }
        .padding(.top, 8)
    }

    private func banner(_ t: String) -> some View {
        Text(t).font(.system(size: 16, weight: .bold)).foregroundStyle(Muse.text)
            .frame(maxWidth: .infinity).frame(height: UI.buttonBig).background(Muse.soft, in: RoundedRectangle(cornerRadius: UI.buttonRadius))
    }

    private func fine(_ t: String) -> some View {
        Text(t).font(UI.meta).foregroundStyle(FB.muted).frame(maxWidth: .infinity, alignment: .leading).fixedSize(horizontal: false, vertical: true)
    }
}

// musing. settings. a static preview: the toggles move but nothing is saved yet.
struct MusingSettingsScreen: View {
    @EnvironmentObject var app: AppState
    private static let toggles: [(key: String, label: String, sub: String, on: Bool)] = [
        ("reels", "let muse notice what i'm into", "uses your reels topics to find overlap. friends only ever see a count, never your name.", true),
        ("asks", "let friends' thoughts reach me", "muse can ask you when a friend floats something you'd likely enjoy.", true),
        ("nudge", "day-of nudge", "one quiet heads up the morning of a plan. never a second one.", true),
        ("recap", "offer a recap after", "muse drafts a post for the group. nothing is shared unless everyone in it says yes.", false),
        ("pause", "quiet week", "pause every ask for seven days. nobody is told.", false),
    ]
    @State private var state = Dictionary(uniqueKeysWithValues: toggles.map { ($0.key, $0.on) })

    var body: some View {
        SubScreen(title: "musing. settings") {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: "hammer").font(.system(size: 13)).foregroundStyle(Muse.text)
                        Text("preview. these switches show what you'd control. they don't save in this prototype.").font(.system(size: 13)).foregroundStyle(Muse.text)
                        Spacer(minLength: 0)
                    }
                    .padding(12).background(Muse.soft, in: RoundedRectangle(cornerRadius: 12)).padding(12)
                    CardBox {
                        ForEach(Array(Self.toggles.enumerated()), id: \.element.key) { i, t in
                            Toggle(isOn: Binding(get: { state[t.key] ?? false }, set: { state[t.key] = $0 })) {
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(t.label).font(.system(size: 16, weight: .semibold)).foregroundStyle(FB.text)
                                    Text(t.sub).font(.system(size: 13)).foregroundStyle(FB.muted)
                                }
                            }
                            .tint(Muse.start).padding(.horizontal, 16).padding(.vertical, 12)
                            if i < Self.toggles.count - 1 { Hairline() }
                        }
                    }
                    SectionLabel("what comes after a plan")
                    CardBox {
                        link("bell", "day-of nudge", "what the heads up looks like") { app.push(.nudge) }
                        Hairline()
                        link("photo.on.rectangle", "recap post", "what lands in feed afterwards") { app.push(.recap) }
                    }
                    SectionLabel("what muse never does")
                    CardBox {
                        VStack(alignment: .leading, spacing: 10) {
                            ForEach(["tells anyone you passed on a plan", "repeats something you said was just between us", "says who is behind a friends overlap", "asks someone on your behalf before you tap send"], id: \.self) { line in
                                HStack(spacing: 8) {
                                    Image(systemName: "xmark.circle.fill").font(.system(size: 16)).foregroundStyle(Muse.end)
                                    Text(line).font(.system(size: 15)).foregroundStyle(FB.text)
                                }
                            }
                        }
                        .padding(16)
                    }
                }
                .padding(.bottom, 32)
            }
            .background(FB.bg2)
        }
    }

    private func link(_ icon: String, _ label: String, _ sub: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Circle().fill(Muse.soft).frame(width: 36, height: 36).overlay(Image(systemName: icon).font(.system(size: 15)).foregroundStyle(Muse.text))
                VStack(alignment: .leading, spacing: 1) {
                    Text(label).font(.system(size: 16, weight: .semibold)).foregroundStyle(FB.text)
                    Text(sub).font(.system(size: 13)).foregroundStyle(FB.muted)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(FB.muted)
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
        }
        .buttonStyle(RowPress())
    }
}

// day-of nudge. a static preview of the one notification musing. sends.
struct NudgePreview: View {
    var body: some View {
        SubScreen(title: "day-of nudge") {
            ScrollView {
                VStack(alignment: .leading, spacing: 6) {
                    VStack(spacing: 0) {
                        Text("Sunday, November 15").font(.system(size: 18, weight: .semibold)).foregroundStyle(.white.opacity(0.9))
                        Text("10:30").font(.system(size: 84, weight: .bold)).tracking(-2).foregroundStyle(.white).padding(.bottom, 28)
                        HStack(spacing: 10) {
                            MuseAvatar(size: 38)
                            VStack(alignment: .leading, spacing: 0) {
                                HStack {
                                    Text("musing.").font(.system(size: 13, weight: .semibold)).foregroundStyle(Color(hex: 0x3c3c43))
                                    Spacer()
                                    Text("now").font(.system(size: 13)).foregroundStyle(Color(hex: 0x6b6b70))
                                }
                                Text("thrift run is today").font(.system(size: 15, weight: .bold)).foregroundStyle(.black)
                                Text("around 1, downtown. three of you are in. no need to reply.").font(.system(size: 15)).foregroundStyle(.black)
                            }
                        }
                        .padding(12).background(Color.white.opacity(0.88), in: RoundedRectangle(cornerRadius: 22))
                    }
                    .padding(.top, 36).padding(.horizontal, 14).padding(.bottom, 150).frame(maxWidth: .infinity)
                    .background(LinearGradient(colors: [Color(hex: 0x1f1147), Color(hex: 0x4c1d95), Color(hex: 0x9d174d)], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 28))
                    .padding(12)
                    Group {
                        Text("one nudge, the morning of. it never asks you to confirm again and never follows up.")
                        Text("static preview. notifications aren't sent in this prototype.")
                    }
                    .font(.system(size: 13)).foregroundStyle(FB.muted).padding(.horizontal, 16)
                }
            }
        }
    }
}

// recap post. a static preview of what lands in feed after a plan, with "run it back".
struct RecapPreview: View {
    @EnvironmentObject var app: AppState
    private let crew = ["Maya Okafor", "Alex Rivera", "Jo Lindqvist"]

    var body: some View {
        SubScreen(title: "recap post") {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Text("static preview of the feed post muse drafts after a plan. it only posts if everyone in it says yes.").font(.system(size: 13)).foregroundStyle(FB.muted).padding(16)
                    CardBox {
                        HStack(spacing: 10) {
                            MuseAvatar(size: 40)
                            VStack(alignment: .leading, spacing: 0) {
                                Text("Maya Okafor is with Alex Rivera and Jo Lindqvist").font(.system(size: 15, weight: .semibold)).foregroundStyle(FB.text)
                                Text("2h · made with musing.").font(.system(size: 13)).foregroundStyle(FB.muted)
                            }
                        }
                        .padding(.horizontal, 12).padding(.top, 12)
                        Text("thrift run happened. three people, two shops, one very good jacket.").font(.system(size: 15)).foregroundStyle(FB.text).padding(.horizontal, 12).padding(.vertical, 10)
                        Rectangle().fill(Muse.gradient).aspectRatio(4 / 3, contentMode: .fit)
                            .overlay {
                                VStack(spacing: 8) {
                                    Image(systemName: "tshirt").font(.system(size: 48))
                                    Text("photos the group picked go here").font(.system(size: 13))
                                }
                                .foregroundStyle(.white.opacity(0.9))
                            }
                        HStack(spacing: 0) {
                            HStack(spacing: -8) {
                                ForEach(crew, id: \.self) { n in Avatar(name: n, seed: n, size: 28).overlay(Circle().stroke(Color.white, lineWidth: 2)) }
                            }
                            Text("started as one vague thought").font(.system(size: 13, weight: .semibold)).foregroundStyle(Muse.text).padding(.leading, 8)
                        }
                        .padding(.horizontal, 12).padding(.top, 12)
                        GradientButton(label: Copy.runItBack, icon: "arrow.clockwise") {
                            app.handoff = "thrift run again sometime soon"
                            app.path = [.musing(compose: false)]
                        }
                        .padding(12)
                    }
                }
                .padding(.bottom, 32)
            }
            .background(FB.bg2)
        }
    }
}
