import SwiftUI

private struct CardBox<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 0) { content }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white)
    }
}

// "what's the move?" one vague thought in. muse reads it, then drafts the plan.
// nothing leaves this screen until the starter taps "send it" on the draft.
struct SignalComposer: View {
    // idle -> reading (understand) -> [asking: muse has one question] -> mixing (match) -> plan
    enum Phase { case idle, reading, asking, mixing, error }

    @EnvironmentObject var app: AppState
    let autoFocus: Bool
    let onPlan: (String) -> Void
    @State private var text = ""
    @State private var phase = Phase.idle
    @State private var reply = ""
    @State private var pitch = ""
    @State private var museId: String?
    @State private var understood: Understood?
    @State private var replayed = false
    @State private var error: String?
    @State private var work: Task<Void, Never>?
    /// who the signal is shown to: "close" (close friends), "friends" or "mutual" (friends of friends).
    /// every signal is an invite to someone; "only muse" is no longer a choice.
    @State private var audience = "friends"
    /// how many friends have to be in before it's on
    @State private var waitFor = 2
    @State private var expires = "1w"
    @State private var context: SignalContext?
    @State private var foundLine: String?
    @FocusState private var focused: Bool

    private var busy: Bool { phase == .reading || phase == .mixing }
    private var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var canSend: Bool { trimmed.count >= 2 && !busy }

    private var note: String {
        if !app.settings.museOn { return "Muse is off, so this goes out as typed, to the first few friends on your list." }
        if audience == "muse" { return "Only you and muse see this. Muse drafts a plan, and nothing goes to anyone until you say so." }
        return "\(audience == "mutual" ? "Friends and their friends" : audience == "close" ? "Your close friends" : "Friends") can see this signal and join. Muse drafts the plan, and nobody is asked until you send it."
    }

    var body: some View {
        let museOn = app.settings.museOn
        VStack(alignment: .leading, spacing: UI.gap) {
            VStack(alignment: .leading, spacing: 4) {
                Text(Copy.composerTitle).font(UI.title).foregroundStyle(FB.text)
                Text(Copy.composerSub).font(.system(size: 14)).foregroundStyle(FB.muted)
            }
            if let context {
                HStack(spacing: 6) {
                    Image(systemName: context.kind == "listing" ? "storefront" : context.kind == "event" ? "calendar" : context.kind == "group" ? "person.3" : "play.rectangle").font(.system(size: 12))
                    Text("Starting from \(context.title)").font(.system(size: 13, weight: .semibold)).lineLimit(1)
                    Button { self.context = nil } label: { Image(systemName: "xmark").font(.system(size: 10, weight: .bold)) }.accessibilityLabel("remove")
                }
                .foregroundStyle(Muse.text).padding(.horizontal, 10).padding(.vertical, 6).background(Muse.soft, in: Capsule())
            }
            TextField(Copy.composerPlaceholder, text: $text, axis: .vertical)
                .font(.system(size: 17)).foregroundStyle(FB.text).lineLimit(3...6)
                .textInputAutocapitalization(.never).disabled(busy).focused($focused)
                .onChange(of: text) { if text.count > 280 { text = String(text.prefix(280)) } }
                .padding(UI.cardPad)
                .background(Color.white, in: RoundedRectangle(cornerRadius: UI.cardRadius))
                .overlay(RoundedRectangle(cornerRadius: UI.cardRadius).stroke(focused ? FB.blue.opacity(0.5) : FB.button, lineWidth: 1))
                .accessibilityIdentifier("signal-text")

            OptionRow(label: "Send to", options: [("close", "Close friends"), ("friends", "Friends only"), ("mutual", "Friends of friends")], selection: $audience, disabled: busy)
            OptionRow(label: "Wait for at least", options: (1...5).map { ($0, peopleCount($0)) }, selection: $waitFor, disabled: busy)
            OptionRow(label: "Expires after", options: [("1d", "1 day"), ("3d", "3 days"), ("1w", "1 week"), ("2w", "2 weeks")], selection: $expires, disabled: busy)

            GradientButton(label: phase == .reading ? "Muse is reading" : phase == .mixing ? (museOn ? "Finding your people" : "Sending") : "Send a signal", big: true, busy: busy, disabled: !canSend) { send() }
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "sparkles").font(.system(size: 14, weight: .semibold)).foregroundStyle(Muse.start)
                Text(note).font(.system(size: 13).italic()).foregroundStyle(FB.muted).fixedSize(horizontal: false, vertical: true)
            }

            if museOn, phase != .idle, phase != .error {
                VStack(alignment: .leading, spacing: 10) {
                    MuseBubble(text: reply, thinking: phase == .reading)
                    if let u = understood {
                        Flow(spacing: 6) {
                            tag(u.activity)
                            if let t = u.timeHint, t != "unspecified" { tag(t) }
                            if let v = u.vibe { tag(v) }
                            if replayed { tag("replayed", muted: true) }
                        }
                        .padding(.leading, 40)
                    }
                    if phase == .asking, let q = understood?.clarifyingQuestion {
                        MuseBubble(text: q)
                        HStack(spacing: 8) {
                            Text("Add a little more above and send again, or").font(UI.meta).foregroundStyle(FB.muted).frame(maxWidth: .infinity, alignment: .leading)
                            QuietButton(label: "Go with it") { goAnyway() }
                        }
                        .padding(.leading, 40)
                    }
                    if phase == .mixing {
                        if let foundLine { Text(foundLine).font(.system(size: 12)).foregroundStyle(FB.muted).padding(.leading, 40) }
                        MuseBubble(text: pitch, thinking: true, label: Copy.pitchLead)
                    }
                }
            }
            if phase == .error || phase == .asking { QuietButton(label: "Start over", fill: true, outline: true) { reset() } }
            if phase == .error { Text("That didn't go through (\(error ?? "")). Your thought is still here. Try again in a sec.").font(.system(size: 14)).foregroundStyle(FB.red) }
        }
        .onAppear {
            takeHandoff()
            if autoFocus { focused = true }
        }
        // a thought handed over from the reels card, a recap or muse's suggestion
        .onChange(of: app.handoff) { takeHandoff() }
        .onDisappear { work?.cancel() }
    }

    private func tag(_ t: String, muted: Bool = false) -> some View {
        Text(t).font(.system(size: 13, weight: .semibold)).foregroundStyle(muted ? FB.muted : Muse.text)
            .padding(.horizontal, 10).padding(.vertical, 5).background(muted ? FB.input : Muse.soft, in: Capsule())
    }

    private func takeHandoff() {
        guard let h = app.handoff, phase == .idle else { return }
        text = h
        context = app.handoffContext
        // a thought from a reel is an open invite like any other. the text is there to edit before it goes out.
        app.handoff = nil
        app.handoffContext = nil
    }

    private func reset() {
        work?.cancel()
        text = ""
        reply = ""
        pitch = ""
        museId = nil
        understood = nil
        replayed = false
        error = nil
        context = nil
        foundLine = nil
        phase = .idle
    }

    private func fail(_ e: Error) {
        guard !Task.isCancelled, !(e is CancellationError) else { return }
        error = errorText(e)
        phase = .error
    }

    private func mix(_ museId: String) async throws {
        phase = .mixing
        pitch = ""
        var planId: String?
        var streamError: String?
        try await API.stream("/api/muse/match", user: app.userId, body: ["museId": museId, "audience": audience == "mutual" ? "mutual" : "friends"]) { event, data in
            switch event {
            case "found":
                // what the server searched before muse started choosing
                let n = { (k: String) in data[k] as? Int ?? 0 }
                let parts = [n("events") > 0 ? "\(n("events")) events" : nil, n("groups") > 0 ? "\(n("groups")) groups" : nil, n("listings") > 0 ? "\(n("listings")) listings" : nil].compactMap { $0 }
                foundLine = parts.isEmpty ? nil : "Looking through \(parts.joined(separator: ", ")) and your friends' free time"
            case "delta": pitch += data["text"] as? String ?? ""
            case "restart": pitch = ""
            case "done": planId = data["planId"] as? String
            case "error": streamError = data["message"] as? String ?? "muse had trouble"
            default: break
            }
        }
        if let streamError { throw ApiError(message: streamError) }
        guard let planId else { throw ApiError(message: "muse didn't finish the plan") }
        reset()
        onPlan(planId)
    }

    private func send() {
        guard canSend else { return }
        focused = false
        error = nil
        reply = ""
        understood = nil
        museId = nil
        work?.cancel()
        let thought = trimmed
        let user = app.userId
        var body: [String: Any] = ["text": thought, "audience": audience, "waitFor": waitFor, "expires": expires]
        if let context { body["context"] = ["kind": context.kind, "id": context.id] }
        work = Task {
            do {
                if !app.settings.museOn {
                    // muse off: what's left is a plain poll to the first few friends
                    phase = .mixing
                    let r: PlanIdResponse = try await API.post("/api/plans", user: user, body: body)
                    reset()
                    onPlan(r.planId)
                    return
                }
                phase = .reading
                var done: [String: Any]?
                var streamError: String?
                try await API.stream("/api/muse/understand", user: user, body: body) { event, data in
                    switch event {
                    case "delta": reply += data["text"] as? String ?? ""
                    case "restart": reply = ""
                    case "done": done = data
                    case "error": streamError = data["message"] as? String ?? "muse had trouble"
                    default: break
                    }
                }
                if let streamError { throw ApiError(message: streamError) }
                guard let done, let id = done["museId"] as? String, let raw = done["understood"],
                      let u = try? API.decoder.decode(Understood.self, from: JSONSerialization.data(withJSONObject: raw)) else { throw ApiError(message: "muse didn't answer") }
                reply = u.reply
                understood = u
                museId = id
                replayed = done["source"] as? String == "cache"
                if u.clarifyingQuestion != nil {
                    phase = .asking // muse has one question. the person can answer or skip it.
                    return
                }
                try await mix(id)
            } catch let e { fail(e) }
        }
    }

    private func goAnyway() {
        guard let museId else { return }
        work = Task {
            do { try await mix(museId) } catch let e { fail(e) }
        }
    }
}

// muse suggests: one thought the person could send with a tap. cached per person,
// so opening this screen does not cost a muse call every time.
struct SuggestCard: View {
    @EnvironmentObject var app: AppState
    @State private var suggestion: Suggestion?
    @State private var hidden = false
    @State private var busy = false

    var body: some View {
        Group {
            if !hidden, let s = suggestion {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 5) {
                        Image(systemName: "sparkles").font(.system(size: 12, weight: .semibold)).foregroundStyle(Muse.text)
                        Text("MUSE SUGGESTS").font(UI.kicker).tracking(0.3).foregroundStyle(Muse.text)
                        Spacer()
                        Button { hidden = true } label: { Image(systemName: "xmark").font(.system(size: 13, weight: .semibold)).foregroundStyle(FB.muted).frame(width: 28, height: 24) }
                            .accessibilityLabel("dismiss suggestion")
                    }
                    Text("\u{201C}\(s.suggestion)\u{201D}").font(.system(size: 17, weight: .semibold)).foregroundStyle(FB.text)
                    Text(s.why).font(.system(size: 14)).foregroundStyle(FB.muted)
                    HStack(spacing: 8) {
                        QuietButton(label: "Use this") { app.handoff = s.suggestion }
                        QuietButton(label: busy ? "Thinking" : "Another", disabled: busy) {
                            Task {
                                busy = true
                                // on a failure keep the one we have
                                if let fresh: Suggestion = try? await API.get("/api/muse/suggest?fresh=1", user: app.userId) { suggestion = fresh }
                                busy = false
                            }
                        }
                    }
                    .padding(.top, 4)
                }
                .padding(UI.cardPad)
                .background(Muse.wash, in: RoundedRectangle(cornerRadius: UI.cardRadius))
                .overlay(RoundedRectangle(cornerRadius: UI.cardRadius).stroke(Muse.line, lineWidth: 1))
                .padding(.top, 8)
            }
        }
        .task(id: "\(app.userId)-\(app.version)") {
            suggestion = nil
            let s: Suggestion? = try? await API.get("/api/muse/suggest", user: app.userId)
            guard !Task.isCancelled else { return }
            suggestion = s
        }
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

    private func cancel() {
        act("cancel", leaveAfter: true) { try await API.data("DELETE", "/api/plans/\(planId)", user: app.userId) }
    }

    @ViewBuilder private func content(_ p: PlanView) -> some View {
        let starter = p.role == "starter"
        let need = max(0, p.quorum - p.downCount)
        let open = p.state == "proposing"
        let myStatus = p.me?.status
        let who = firstName(p.starter.name)

        PlanSummaryCard(plan: p, detail: true)

        // muse's voice: the pitch for a draft, the personal ask for a friend, the note after a re-solve
        let pitch = starter && p.state == "draft" ? p.pitch : nil
        let ask = !starter && open && myStatus == "pending" && p.museOn ? p.me?.personalAsk : nil
        let note = p.state != "draft" ? p.note : nil
        let raw = !p.museOn ? p.rawText : nil
        if pitch != nil || ask != nil || note != nil || raw != nil {
            VStack(alignment: .leading, spacing: 10) {
                if let pitch { MuseBubble(text: pitch, label: Copy.pitchLead) }
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
                GradientButton(label: Copy.sendIt, icon: "paperplane.fill", big: true, busy: busy == "send") {
                    act("send") { try await API.data("POST", "/api/plans/\(planId)/send", user: app.userId) }
                }
                QuietButton(label: Copy.notThis, fill: true, outline: true) { cancel() }
                fine("Your signal is already out for friends to see and join. This step sends muse's private ask to each person above. Nobody sees who else was asked.")
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
