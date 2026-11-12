import SwiftUI

private struct CardBox<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 0) { content }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white)
    }
}

// the musing. surface: asks that reached you, the composer, your plans, your past thoughts.
struct MusingScreen: View {
    @EnvironmentObject var app: AppState
    let compose: Bool
    @State private var home: MusingHome?
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        SubScreen(title: Copy.brand) {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Text("one vague thought. a real plan with friends. nobody has to ask.").font(.system(size: 15, weight: .medium)).foregroundStyle(Muse.text)
                        .padding(.horizontal, 16).padding(.vertical, 12)

                    SignalComposer(autoFocus: compose) { app.push(.plan($0)) }
                    if app.settings.museOn { SuggestCard() }

                    if let asks = home?.asks, !asks.isEmpty {
                        SectionLabel("for you")
                        CardBox { ForEach(asks) { PlanRow(plan: $0) } }
                    }
                    if let mine = home?.mine, !mine.isEmpty {
                        SectionLabel("your plans")
                        CardBox { ForEach(mine) { PlanRow(plan: $0) } }
                    }

                    SectionLabel("things you floated")
                    CardBox {
                        let muses = home?.muses ?? []
                        ForEach(Array(muses.enumerated()), id: \.element.id) { i, m in
                            Button { app.handoff = m.rawText } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(m.rawText).font(.system(size: 15)).foregroundStyle(FB.text).multilineTextAlignment(.leading)
                                    Text("\(timeAgo(m.createdAt).lowercased())\(m.understood.map { " · \($0.activity)" } ?? "") · tap to \(Copy.runItBack)").font(.system(size: 12)).foregroundStyle(FB.muted)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 16).padding(.vertical, 12)
                            }
                            .buttonStyle(RowPress())
                            if i < muses.count - 1 { Hairline() }
                        }
                        if !loading && muses.isEmpty {
                            Text(error.map { "couldn't load (\($0))" } ?? "nothing yet. that's fine.").foregroundStyle(FB.muted).padding(16)
                        }
                    }
                    TracePanel(planId: nil)
                }
                .padding(.bottom, 32)
            }
            .scrollDismissesKeyboard(.interactively)
            .refreshable { await load() }
            .background(FB.bg2)
        }
        .task(id: "\(app.userId)-\(app.version)") {
            home = nil
            loading = true
            await load()
        }
        // any plan change anywhere: refetch. the server decides what this person may see.
        .onTableChange("plans") { Task { await load() } }
    }

    private func load() async {
        let user = app.userId
        do {
            let h: MusingHome = try await API.get("/api/musing/home", user: user)
            guard user == app.userId, !Task.isCancelled else { return }
            home = h
            error = nil
        } catch let e {
            guard user == app.userId, !Task.isCancelled else { return }
            error = errorText(e)
        }
        loading = false
    }
}

func planStatusLine(_ p: PlanView) -> String {
    if p.solving { return Copy.solving }
    switch p.state {
    case "draft": return "draft · only you can see this"
    case "happening": return Copy.happening
    case "faded": return "didn't land this time"
    default: break
    }
    let need = max(0, p.quorum - p.downCount)
    if p.role == "member", p.me?.status == "down" { return need > 0 ? "you're in · \(need) more and it's on" : "you're in" }
    return "\(p.downCount) of \(p.quorum) in so far"
}

// one plan in a list. for a friend it leads with the ask, for the starter with the status.
struct PlanRow: View {
    @EnvironmentObject var app: AppState
    let plan: PlanView

    var body: some View {
        let mine = plan.role == "starter"
        let waitingOnMe = !mine && plan.me?.status == "pending" && plan.state == "proposing"
        Button { app.push(.plan(plan.id)) } label: {
            HStack(spacing: 12) {
                if plan.state == "happening" {
                    Circle().fill(Muse.gradient).frame(width: 40, height: 40).overlay(Image(systemName: "checkmark").font(.system(size: 16, weight: .bold)).foregroundStyle(.white))
                } else if mine {
                    Circle().fill(Muse.soft).frame(width: 40, height: 40).overlay(Image(systemName: "sparkles").font(.system(size: 15, weight: .semibold)).foregroundStyle(Muse.text))
                } else {
                    Avatar(plan.starter, size: 40)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(mine ? (plan.activity ?? "") : "\(firstName(plan.starter.name).lowercased()) · \(plan.activity ?? "")").font(.system(size: 16, weight: .semibold)).foregroundStyle(FB.text).lineLimit(1)
                    Text([plan.when, planStatusLine(plan)].compactMap { $0 }.joined(separator: " · ")).font(.system(size: 13)).foregroundStyle(FB.muted).lineLimit(1)
                }
                Spacer(minLength: 0)
                if waitingOnMe { Circle().fill(Muse.end).frame(width: 10, height: 10) } else { Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(FB.muted) }
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
        }
        .buttonStyle(RowPress())
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
    @State private var pickerOpen = false
    @State private var context: SignalContext?
    @State private var foundLine: String?
    @FocusState private var focused: Bool

    private var busy: Bool { phase == .reading || phase == .mixing }
    private var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var canSend: Bool { trimmed.count >= 2 && !busy }

    var body: some View {
        let museOn = app.settings.museOn
        VStack(alignment: .leading, spacing: 10) {
            if let context {
                HStack(spacing: 6) {
                    Image(systemName: context.kind == "listing" ? "storefront" : context.kind == "event" ? "calendar" : context.kind == "group" ? "person.3" : "play.rectangle").font(.system(size: 12))
                    Text("starting from \(context.title)").font(.system(size: 13, weight: .semibold)).lineLimit(1)
                    Button { self.context = nil } label: { Image(systemName: "xmark").font(.system(size: 10, weight: .bold)) }.accessibilityLabel("remove")
                }
                .foregroundStyle(Muse.text).padding(.horizontal, 10).padding(.vertical, 6).background(Muse.soft, in: Capsule())
            }
            TextField(Copy.composerPlaceholder, text: $text, axis: .vertical)
                .font(.system(size: 19)).foregroundStyle(FB.text).lineLimit(2...6)
                .textInputAutocapitalization(.never).disabled(busy).focused($focused)
                .onChange(of: text) { if text.count > 280 { text = String(text.prefix(280)) } }
            HStack(spacing: 8) {
                if museOn {
                    Button { pickerOpen = true } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "person.2").font(.system(size: 12))
                            Text("just friends").font(.system(size: 13))
                            Image(systemName: "chevron.down").font(.system(size: 10))
                        }
                        .foregroundStyle(FB.muted).padding(.horizontal, 10).padding(.vertical, 7).background(FB.input, in: Capsule())
                    }
                    .accessibilityLabel("who muse can ask: just friends")
                } else {
                    Text("muse is off · plain poll").font(.system(size: 13)).foregroundStyle(FB.muted)
                }
                Spacer(minLength: 0)
                if phase == .error || phase == .asking { QuietButton(label: "start over") { reset() } }
                GradientButton(label: phase == .reading ? "muse is reading" : phase == .mixing ? (museOn ? "finding your people" : "sending") : museOn ? "send it to muse" : "ask the poll", icon: "arrow.up", busy: busy, disabled: !canSend) { send() }
            }
            Text(museOn ? "only you and muse see this. nothing goes to anyone until you say so." : "without muse this goes out as typed, to the first few friends on your list.").font(.system(size: 12)).foregroundStyle(FB.muted)

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
                            Text("add a little more above and send again, or").font(.system(size: 13)).foregroundStyle(FB.muted).frame(maxWidth: .infinity, alignment: .leading)
                            QuietButton(label: "go with it") { goAnyway() }
                        }
                        .padding(.leading, 40)
                    }
                    if phase == .mixing {
                        if let foundLine { Text(foundLine).font(.system(size: 12)).foregroundStyle(FB.muted).padding(.leading, 40) }
                        MuseBubble(text: pitch, thinking: true, label: Copy.pitchLead)
                    }
                }
                .padding(.top, 4)
            }
            if phase == .error { Text("that didn't go through (\(error ?? "")). your thought is still here. try again in a sec.").font(.system(size: 14)).foregroundStyle(FB.red) }
        }
        .padding(14)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal, 12)
        .onAppear {
            takeHandoff()
            if autoFocus { focused = true }
        }
        // a thought handed over from the reels card, a recap or muse's suggestion
        .onChange(of: app.handoff) { takeHandoff() }
        .onDisappear { work?.cancel() }
        .sheet(isPresented: $pickerOpen) { VisibilitySheet().presentationDetents([.height(330)]) }
    }

    private func tag(_ t: String, muted: Bool = false) -> some View {
        Text(t).font(.system(size: 13, weight: .semibold)).foregroundStyle(muted ? FB.muted : Muse.text)
            .padding(.horizontal, 10).padding(.vertical, 5).background(muted ? FB.input : Muse.soft, in: Capsule())
    }

    private func takeHandoff() {
        guard let h = app.handoff, phase == .idle else { return }
        text = h
        context = app.handoffContext
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
        try await API.stream("/api/muse/match", user: app.userId, body: ["museId": museId]) { event, data in
            switch event {
            case "found":
                // what the server searched before muse started choosing
                let n = { (k: String) in data[k] as? Int ?? 0 }
                let parts = [n("events") > 0 ? "\(n("events")) events" : nil, n("groups") > 0 ? "\(n("groups")) groups" : nil, n("listings") > 0 ? "\(n("listings")) listings" : nil].compactMap { $0 }
                foundLine = parts.isEmpty ? nil : "looking through \(parts.joined(separator: ", ")) and your friends' free time"
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
        var body: [String: Any] = ["text": thought]
        if let context { body["context"] = ["kind": context.kind, "id": context.id] }
        work = Task {
            do {
                if !app.settings.museOn {
                    // muse off: what's left is a plain poll to the first few friends
                    phase = .mixing
                    let r: PlanIdResponse = try await API.post("/api/plans", user: user, body: ["text": thought])
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

// who muse may ask. only "just friends" is wired in this prototype.
struct VisibilitySheet: View {
    @Environment(\.dismiss) private var dismiss
    private let options: [(label: String, sub: String, icon: String, ready: Bool)] = [
        ("just friends", "muse picks from your friends. only the few it asks ever know.", "person.2", true),
        ("close friends", "a shorter list you choose. soon.", "heart", false),
        ("friends of friends", "one hop out, for bigger plans. soon.", "point.3.connected.trianglepath.dotted", false),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("who can muse ask?").font(.system(size: 18, weight: .bold)).foregroundStyle(FB.text).padding(.bottom, 6)
            ForEach(options, id: \.label) { o in
                Button { if o.ready { dismiss() } } label: {
                    HStack(spacing: 12) {
                        Circle().fill(Muse.soft).frame(width: 36, height: 36).overlay(Image(systemName: o.icon).font(.system(size: 15)).foregroundStyle(o.ready ? Muse.text : FB.muted))
                        VStack(alignment: .leading, spacing: 0) {
                            Text(o.label).font(.system(size: 16, weight: .semibold)).foregroundStyle(FB.text)
                            Text(o.sub).font(.system(size: 13)).foregroundStyle(FB.muted).multilineTextAlignment(.leading)
                        }
                        Spacer(minLength: 0)
                        if o.ready { Image(systemName: "checkmark.circle.fill").font(.system(size: 20)).foregroundStyle(Muse.text) }
                    }
                    .padding(.vertical, 10).opacity(o.ready ? 1 : 0.45)
                }
                .buttonStyle(FadePress()).disabled(!o.ready)
            }
            Spacer(minLength: 0)
        }
        .padding(20)
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
                        Text("muse suggests").font(.system(size: 12, weight: .bold)).foregroundStyle(Muse.text)
                        Spacer()
                        Button { hidden = true } label: { Image(systemName: "xmark").font(.system(size: 13, weight: .semibold)).foregroundStyle(FB.muted).frame(width: 28, height: 24) }
                            .accessibilityLabel("dismiss suggestion")
                    }
                    Text("\u{201C}\(s.suggestion)\u{201D}").font(.system(size: 17, weight: .semibold)).foregroundStyle(FB.text)
                    Text(s.why).font(.system(size: 14)).foregroundStyle(FB.muted)
                    HStack(spacing: 8) {
                        QuietButton(label: "use this") { app.handoff = s.suggestion }
                        QuietButton(label: busy ? "thinking" : "another", disabled: busy) {
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
                .padding(14)
                .background(Color.white, in: RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Muse.soft, lineWidth: 1))
                .padding(.horizontal, 12).padding(.top, 10)
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
                .background(Color(hex: 0x16131f), in: RoundedRectangle(cornerRadius: 14)).padding(12)
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
    let onDone: () -> Void
    let onClose: () -> Void
    @State private var offer = ""
    @State private var limit: String
    @State private var busy = false
    @State private var stream = ""
    @State private var error: String?

    init(planId: String, existingLimit: String?, onDone: @escaping () -> Void, onClose: @escaping () -> Void) {
        self.planId = planId
        self.existingLimit = existingLimit
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
            field("sunday instead? somewhere closer?", $offer, FB.input)
            HStack(spacing: 5) {
                Image(systemName: "lock.fill").font(.system(size: 11)).foregroundStyle(Muse.text)
                Text(Copy.privateLimit).font(.system(size: 14, weight: .bold)).foregroundStyle(Muse.text)
            }
            .padding(.top, 6)
            field("anything muse should quietly work around", $limit, Muse.soft)
            Text(Copy.privateNote).font(.system(size: 12)).foregroundStyle(FB.muted)

            if busy || !stream.isEmpty { MuseBubble(text: stream, thinking: busy, label: busy ? Copy.solving : nil) }
            if let error { Text("muse couldn't rework it (\(error)). the plan stays as it was.").font(.system(size: 14)).foregroundStyle(FB.red) }

            HStack(spacing: 8) {
                QuietButton(label: "never mind", disabled: busy, action: onClose)
                GradientButton(label: busy ? "reworking" : "ask muse", busy: busy, disabled: !canSend, fill: true) {
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
    @State private var whatIfOpen = false

    var body: some View {
        SubScreen(title: plan == nil ? "plan" : Copy.brand) {
            if let p = plan {
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        content(p)
                        TracePanel(planId: p.id)
                    }
                    .padding(.bottom, 40)
                }
                .scrollDismissesKeyboard(.interactively)
                .background(FB.bg2)
            } else {
                Text(loading ? "one sec" : "this plan isn't here anymore.").foregroundStyle(FB.muted).padding(24)
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
            } catch let e { error = errorText(e) }
            busy = nil
        }
    }

    private func answer(_ status: String) {
        act(status) { try await API.data("POST", "/api/plans/\(planId)/respond", user: app.userId, body: ["status": status]) }
    }

    private func cancel() {
        act("cancel", leaveAfter: true) { try await API.data("DELETE", "/api/plans/\(planId)", user: app.userId) }
    }

    private func kicker(_ p: PlanView) -> String {
        switch p.state {
        case "draft": "draft · only you can see this"
        case "happening": Copy.happening
        case "faded": "didn't land"
        default: p.role == "starter" ? "out with your people" : "from \(firstName(p.starter.name).lowercased()), via muse"
        }
    }

    @ViewBuilder private func content(_ p: PlanView) -> some View {
        let starter = p.role == "starter"
        let need = max(0, p.quorum - p.downCount)
        let open = p.state == "proposing"
        let myStatus = p.me?.status
        let who = firstName(p.starter.name).lowercased()

        // the plan itself
        VStack(alignment: .leading, spacing: 5) {
            Text(kicker(p)).font(.system(size: 12.5, weight: .bold)).foregroundStyle(Muse.text)
            Text(p.activity ?? "").font(.system(size: 26, weight: .heavy)).tracking(-0.5).foregroundStyle(FB.text).padding(.bottom, 2)
            if let when = p.when { Label(when, systemImage: "clock").font(.system(size: 16)).foregroundStyle(FB.text) }
            if let place = p.`where` { Label(place, systemImage: "mappin.and.ellipse").font(.system(size: 16)).foregroundStyle(FB.text) }
        }
        .frame(maxWidth: .infinity, alignment: .leading).padding(16)
        .background(Muse.softer, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Muse.line, lineWidth: 1))
        .padding(12)

        if p.solving {
            HStack(spacing: 8) {
                ProgressView().controlSize(.small).tint(Muse.text)
                Text(Copy.solving).font(.system(size: 14, weight: .semibold)).foregroundStyle(Muse.text)
                Spacer()
            }
            .padding(10).background(Muse.soft, in: RoundedRectangle(cornerRadius: 12)).padding(.horizontal, 12).padding(.bottom, 8)
        }

        VStack(alignment: .leading, spacing: 12) {
            // muse's voice: the pitch for a draft, the personal ask for a friend, the note after a re-solve
            if starter, p.state == "draft", let pitch = p.pitch { MuseBubble(text: pitch, label: Copy.pitchLead) }
            if !starter, open, myStatus == "pending", p.museOn, let ask = p.me?.personalAsk { MuseBubble(text: ask) }
            if !p.museOn, let raw = p.rawText {
                Text("\(starter ? "you asked" : "\(who) asked"): \u{201C}\(raw)\u{201D}").font(.system(size: 16)).foregroundStyle(FB.text)
            }
            if let note = p.note, p.state != "draft" { MuseBubble(text: note, label: p.version > 1 ? "small update" : nil) }

            // the count. no names until it's on.
            if open || p.state == "happening" {
                HStack(spacing: 10) {
                    HStack(spacing: 6) {
                        ForEach(0..<max(p.quorum, 0), id: \.self) { i in
                            Circle().fill(i < p.downCount ? Muse.start : .clear).frame(width: 14, height: 14).overlay(Circle().stroke(Muse.start, lineWidth: 2))
                        }
                    }
                    Text(p.state == "happening" ? "\(p.downCount) in, plus \(starter ? "you" : who)" : need > 0 ? "\(p.downCount) of \(p.quorum) in. \(need) more and it's on." : "that's enough. making it real.")
                        .font(.system(size: 15, weight: .semibold)).foregroundStyle(FB.text)
                }
            }
            if open { fine(starter ? "you'll see who's in once it's on. you never see who passed, and neither does anyone else." : "your answer stays between you and muse until it's on.") }
            if p.state == "faded" { Text(Copy.faded).font(.system(size: 16)).foregroundStyle(FB.text) }
            if let going = p.going {
                Flow(spacing: 8) {
                    ForEach(going) { u in
                        HStack(spacing: 6) {
                            Avatar(u, size: 26)
                            Text(firstName(u.name).lowercased()).font(.system(size: 14, weight: .semibold)).foregroundStyle(FB.text)
                        }
                        .padding(3).padding(.trailing, 9).background(FB.input, in: Capsule())
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading).padding(14)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 16)).padding(.horizontal, 12)

        // what muse found around this plan. catalog records only, every one tappable.
        if let found = p.opportunities, !found.isEmpty, p.state != "faded" {
            SectionLabel("muse found a move")
            FoundSection(found: found)
        }

        // the mix: starter only
        if starter, let picks = p.picks, p.state != "happening", p.state != "faded" {
            SectionLabel(p.state == "draft" ? "who muse would ask" : "who muse asked")
            CardBox {
                ForEach(Array(picks.enumerated()), id: \.element.user.id) { i, pick in
                    HStack(spacing: 12) {
                        Avatar(pick.user, size: 40)
                        VStack(alignment: .leading, spacing: 0) {
                            Text(pick.user.name).font(.system(size: 15, weight: .semibold)).foregroundStyle(FB.text)
                            if let reason = pick.reason { Text(reason).font(.system(size: 13)).foregroundStyle(FB.muted) }
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    if i < picks.count - 1 { Hairline() }
                }
            }
            if p.state == "draft" { fine("each of them gets their own quiet ask from muse. none of them sees who else was asked.").padding(.horizontal, 16).padding(.top, 8) }
        }

        // actions
        VStack(alignment: .leading, spacing: 10) {
            if let error { Text(error).font(.system(size: 14)).foregroundStyle(FB.red) }

            if starter, p.state == "draft" {
                GradientButton(label: Copy.sendIt, icon: "paperplane.fill", big: true, busy: busy == "send") {
                    act("send") { try await API.data("POST", "/api/plans/\(planId)/send", user: app.userId) }
                }
                QuietButton(label: Copy.notThis, fill: true) { cancel() }
            }

            if !starter, open, !whatIfOpen {
                if myStatus != "down" { GradientButton(label: Copy.down, icon: "checkmark", big: true, busy: busy == "down", disabled: p.solving) { answer("down") } }
                if myStatus == "down" { Text("you're in.").font(.system(size: 17, weight: .bold)).foregroundStyle(Muse.text).frame(maxWidth: .infinity).padding(.vertical, 6) }
                if p.museOn { QuietButton(label: Copy.whatIf, disabled: p.solving, fill: true) { whatIfOpen = true } }
                if myStatus != "out" {
                    QuietButton(label: myStatus == "down" ? "actually, not this time" : Copy.pass, disabled: busy != nil, fill: true) { answer("out") }
                } else {
                    fine("you passed. nobody was told.")
                }
            }
            if !starter, p.state == "happening", myStatus != "down" {
                GradientButton(label: Copy.down, icon: "checkmark", big: true, busy: busy == "down") { answer("down") }
            }

            if starter, open, !whatIfOpen {
                if p.museOn { QuietButton(label: Copy.whatIf, disabled: p.solving, fill: true) { whatIfOpen = true } }
                QuietButton(label: "call it off quietly", fill: true) { cancel() }
            }

            if open, whatIfOpen {
                WhatIf(planId: p.id, existingLimit: p.me?.privateLimit, onDone: {
                    Task {
                        await load()
                        whatIfOpen = false
                    }
                }, onClose: { whatIfOpen = false })
                    .padding(14).background(Color.white, in: RoundedRectangle(cornerRadius: 16))
            }
            if open, !p.museOn { fine("muse is off for this one, so there's no \u{201C}what if\u{201D} and no quiet re-solve. it's a yes or a no.") }

            if p.state == "happening" {
                if let thread = p.threadId {
                    GradientButton(label: "open the chat", icon: "bubble.left.and.bubble.right.fill", big: true) { app.push(.thread(thread)) }
                } else if p.museOn {
                    fine("muse is setting up the chat and the event.")
                } else {
                    fine("enough people said yes. without muse there's no chat or event made for you. that part is on you.")
                }
                if let event = p.eventId { QuietButton(label: "see the event", fill: true) { app.push(.event(event)) } }
            }

            if starter, p.state == "faded" {
                GradientButton(label: Copy.runItBack, icon: "arrow.clockwise", big: true) {
                    app.handoff = p.rawText ?? p.activity ?? ""
                    cancel()
                }
                QuietButton(label: "let it go", fill: true) { cancel() }
            }
        }
        .padding(12)
    }

    private func fine(_ t: String) -> some View {
        Text(t).font(.system(size: 13)).foregroundStyle(FB.muted).frame(maxWidth: .infinity, alignment: .leading)
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
