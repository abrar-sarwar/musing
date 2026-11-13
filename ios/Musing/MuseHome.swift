import SwiftUI

// "what's the move?": the muse screen. muse is the screen. asleep and dreaming up ideas
// when you arrive, awake when you start typing, mewing while it drafts, and "mewed."
// when a real draft comes back, at which point you are taken to the draft to review.
// nothing here sends a signal: a prompt only ever makes a private draft.

/// where one visit to muse is. the last three happen on the draft's own screen (PlanScreen).
enum MuseFlow: Equatable {
    case idle // muse is musing: asleep, dreaming ideas
    case composing // the person is typing: muse is awake and listening
    case mewing // drafting, for real
    case asking // muse needs one thing before it can draft
    case mewed // a draft came back
    case failed // it didn't go through: the prompt is kept, retry is offered
    case draftReview, signalConfirmation, signalSent
}

struct MuseThought: Identifiable, Equatable {
    let id = UUID()
    let text: String
    /// what goes in the prompt box when it is tapped. nil for a thought that is just muse talking.
    var fill: String?
}

/// one drafting run, start to finish. owns the only path that calls muse from this screen.
@MainActor
final class MuseSession: ObservableObject {
    @Published var flow = MuseFlow.idle
    @Published var text = ""
    /// where the thought started, when it started somewhere else (a reel, a listing, an event)
    @Published var context: SignalContext?
    /// what muse is actually doing right now, newest last. only things that really happened.
    @Published var progress: [MuseThought] = []
    @Published var question: String?
    @Published var error: String?
    @Published var planId: String?

    private var run = 0 // a newer prompt makes every older answer stale
    private var work: Task<Void, Never>?
    private var lastPrompt = ""
    private var pendingMuse: String?

    var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }
    var canSend: Bool { trimmed.count >= 2 && flow != .mewing && flow != .mewed }

    func typing(_ on: Bool) {
        if on, flow == .idle { flow = .composing }
        if !on, flow == .composing, trimmed.isEmpty { flow = .idle }
    }

    func cancel() {
        run += 1
        work?.cancel()
        if flow == .mewing { flow = trimmed.isEmpty ? .idle : .composing }
    }

    func reset() {
        run += 1
        work?.cancel()
        text = ""
        context = nil
        progress = []
        question = nil
        error = nil
        planId = nil
        pendingMuse = nil
        flow = .idle
    }

    private func say(_ t: String) {
        if progress.last?.text != t { progress.append(MuseThought(text: t)) }
    }

    /// the send arrow, or return on the keyboard. one tap, one draft: a second tap while mewing does nothing.
    func submit(app: AppState) {
        guard canSend else { return }
        // answering muse's question adds to what was said, it does not replace it
        let prompt = flow == .asking && !lastPrompt.isEmpty ? "\(lastPrompt). \(trimmed)" : trimmed
        start(prompt, app: app)
    }

    func retry(app: AppState) {
        guard flow == .failed, !lastPrompt.isEmpty else { return }
        start(lastPrompt, app: app)
    }

    /// muse asked something and the person would rather it just went ahead
    func goWithIt(app: AppState) {
        guard flow == .asking, let museId = pendingMuse else { return }
        run += 1
        let mine = run
        flow = .mewing
        question = nil
        let user = app.userId
        work = Task { await self.guarded(mine) { try await self.mix(museId, user: user, mine: mine) } }
    }

    private func start(_ prompt: String, app: AppState) {
        run += 1
        let mine = run
        work?.cancel()
        lastPrompt = String(prompt.prefix(280))
        text = ""
        progress = []
        question = nil
        error = nil
        planId = nil
        pendingMuse = nil
        flow = .mewing
        let user = app.userId
        let museOn = app.settings.museOn
        let ctx = context
        work = Task {
            await self.guarded(mine) {
                guard museOn else { throw ApiError(message: "muse is switched off right now, so there's nothing to draft") }
                self.say("reading what you said...")
                // private while it is a draft: nobody sees this until the person sends it from the draft
                var body: [String: Any] = ["text": self.lastPrompt, "audience": "muse"]
                if let ctx { body["context"] = ["kind": ctx.kind, "id": ctx.id] }
                var done: [String: Any]?
                var streamError: String?
                try await API.stream("/api/muse/understand", user: user, body: body) { event, data in
                    switch event {
                    case "done": done = data
                    case "error": streamError = data["message"] as? String ?? "muse had trouble"
                    default: break
                    }
                }
                guard mine == self.run else { return }
                if let streamError { throw ApiError(message: streamError) }
                guard let done, let id = done["museId"] as? String, let raw = done["understood"],
                      let u = try? API.decoder.decode(Understood.self, from: JSONSerialization.data(withJSONObject: raw)) else { throw ApiError(message: "muse didn't answer") }
                // muse's own first reaction, in its words
                self.say(u.reply)
                if let q = u.clarifyingQuestion {
                    self.pendingMuse = id
                    self.question = q
                    self.flow = .asking
                    return
                }
                try await self.mix(id, user: user, mine: mine)
            }
        }
    }

    private func mix(_ museId: String, user: String, mine: Int) async throws {
        var newPlan: String?
        var streamError: String?
        var writing = false
        try await API.stream("/api/muse/match", user: user, body: ["museId": museId]) { event, data in
            guard mine == self.run else { return }
            switch event {
            case "found":
                // what the server really searched before muse started choosing
                let n = { (k: String) in data[k] as? Int ?? 0 }
                let parts = [n("events") > 0 ? "\(n("events")) events" : nil, n("groups") > 0 ? "\(n("groups")) groups" : nil, n("listings") > 0 ? "\(n("listings")) listings" : nil].compactMap { $0 }
                self.say(parts.isEmpty ? "checking when your friends are free..." : "looking through \(parts.joined(separator: ", "))...")
            case "delta":
                if !writing {
                    writing = true
                    self.say("putting something together...")
                }
            case "done": newPlan = data["planId"] as? String
            case "error": streamError = data["message"] as? String ?? "muse had trouble"
            default: break
            }
        }
        guard mine == run else { return }
        if let streamError { throw ApiError(message: streamError) }
        guard let newPlan else { throw ApiError(message: "muse didn't finish the plan") }
        planId = newPlan
        flow = .mewed
    }

    private func guarded(_ mine: Int, _ body: @escaping () async throws -> Void) async {
        do { try await body() } catch let e {
            guard mine == run, !(e is CancellationError), !Task.isCancelled else { return }
            error = errorText(e)
            text = lastPrompt // the prompt is never lost
            flow = .failed
        }
    }
}

/// a thought drifting beside muse while it sleeps
private struct Dream: Identifiable {
    let id = UUID()
    let thought: MuseThought
    let side: CGFloat
    let born: Date
    let lift: CGFloat
    let life: Double
}

// ---------- the screen ----------

struct MuseHome: View {
    @EnvironmentObject var app: AppState
    @ObservedObject var session: MuseSession
    let home: MusingHome?
    let autoFocus: Bool
    /// a draft is ready: go to its own screen
    let onDraft: (String) -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @FocusState private var focused: Bool

    @State private var dreams: [Dream] = []
    @State private var nextDream = 0
    @State private var nextSide: CGFloat = -1
    @State private var absorbFrom: Date?
    @State private var hop: CGFloat = 0
    @State private var squash: CGFloat = 1
    @State private var beat = MuseExpression.hype // the two faces of "mewed."
    @State private var mewedShown = false
    @State private var leaving = false
    @State private var reelTopics: [String] = []

    private var expression: MuseExpression {
        switch session.flow {
        case .idle: .asleep
        case .mewing: .thinking
        case .mewed: beat
        case .failed: .sad
        default: .awake
        }
    }

    private var status: String {
        switch session.flow {
        case .idle: "muse is musing..."
        case .composing: "muse is listening..."
        case .mewing: "muse is mewing..."
        case .asking: "muse needs one thing first."
        case .mewed: "mewed."
        case .failed: "that didn't go through."
        default: ""
        }
    }

    /// what muse dreams about: things from this person's own feed and the catalog first, then the stock ones
    private var ideas: [MuseThought] {
        var mine: [MuseThought] = []
        for t in reelTopics.prefix(3) { mine.append(MuseThought(text: "more \(t), like that reel?", fill: "something with \(t)")) }
        for ev in (app.catalog?.events ?? []).prefix(40) where ev.title.count <= 26 {
            mine.append(MuseThought(text: "\(ev.title.lowercased())?", fill: "wanna go to \(ev.title.lowercased()) with friends"))
            if mine.count >= 7 { break }
        }
        for g in (app.catalog?.groups ?? []).prefix(20) where g.name.count <= 24 {
            mine.append(MuseThought(text: "something with \(g.name.lowercased())?", fill: "do something with people from \(g.name.lowercased())"))
            if mine.count >= 9 { break }
        }
        if !(home?.friendSignals ?? []).isEmpty { mine.append(MuseThought(text: "your friends might be into this...", fill: nil)) }
        let stock: [MuseThought] = [
            MuseThought(text: "late night food run?", fill: "late night food run"),
            MuseThought(text: "the new boba spot nearby?", fill: "try the new boba spot nearby"),
            MuseThought(text: "thrift shopping this weekend?", fill: "thrift shopping this weekend"),
            MuseThought(text: "taco bell run?", fill: "taco bell run with whoever's around"),
            MuseThought(text: "anyone down for a road trip?", fill: "anyone down for a road trip"),
            MuseThought(text: "something on campus tonight?", fill: "find something on campus tonight"),
            MuseThought(text: "what about a spontaneous adventure?", fill: "a spontaneous adventure"),
            MuseThought(text: "find something to do together?", fill: "find something to do together"),
        ]
        var out: [MuseThought] = []
        for i in 0..<max(mine.count, stock.count) {
            if i < stock.count { out.append(stock[i]) }
            if i < mine.count { out.append(mine[i]) }
        }
        return out
    }

    private var starters: [String] {
        var out = ["find something to do tonight", "get my friends together", "plan a weekend adventure", "do something spontaneous"]
        if let topic = app.me?.interests.first { out.insert("something with \(topic.lowercased())", at: 1) }
        return out
    }

    private var dreaming: Bool { session.flow == .idle && !reduceMotion }

    var body: some View {
        GeometryReader { geo in
            let tight = geo.size.height < 430 // the keyboard is up, or a small phone
            let muse: CGFloat = tight ? 92 : min(170, geo.size.width * 0.42)
            VStack(spacing: 0) {
                if !tight {
                    VStack(spacing: 4) {
                        Text("what's the move?").font(.system(size: 28, weight: .heavy)).foregroundStyle(FB.text)
                        Text("got something in mind? muse can help make it happen.").font(.system(size: 15)).foregroundStyle(FB.muted).multilineTextAlignment(.center)
                    }
                    .padding(.horizontal, UI.margin).padding(.top, 10)
                }
                Spacer(minLength: 4)
                stage(muse: muse, width: geo.size.width)
                caption.padding(.top, tight ? 4 : 12)
                Spacer(minLength: 4)
                if !tight { underMuse.padding(.bottom, 6) }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .opacity(leaving ? 0 : 1)
        }
        .background(LinearGradient(colors: [Color(hex: 0xfffdf8), Color(hex: 0xf7f2ff)], startPoint: .top, endPoint: .bottom))
        .safeAreaInset(edge: .bottom, spacing: 0) { composer }
        .task(id: dreaming) { await dream() }
        .task(id: "\(app.userId)-\(app.version)") {
            reelTopics = []
            if app.catalog == nil { await app.loadCatalog() }
            // what this person has been watching: their own row only
            let rows: [TopicRow]? = try? await Supa.select("reels_topics", "select=topic&user_id=eq.\(app.userId)&order=score.desc&limit=4")
            if !Task.isCancelled { reelTopics = (rows ?? []).map(\.topic) }
        }
        .onChange(of: focused) { session.typing(focused) }
        .onChange(of: session.text) {
            if session.text.count > 280 { session.text = String(session.text.prefix(280)) }
            if !session.trimmed.isEmpty { session.typing(true) }
        }
        .onChange(of: session.flow) { old, new in react(from: old, to: new) }
        .onAppear {
            if autoFocus, session.flow == .idle || session.flow == .composing { focused = true }
        }
        .onDisappear { session.cancel() }
    }

    // ---- muse and the thoughts around it ----

    private func stage(muse: CGFloat, width: CGFloat) -> some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30, paused: reduceMotion)) { ctx in
            let now = ctx.date
            let t = now.timeIntervalSinceReferenceDate
            ZStack {
                if session.flow == .mewing || session.flow == .asking, let last = session.progress.last {
                    // one real line at a time, above muse
                    thoughtBubble(last.text).frame(maxWidth: width * 0.62)
                        .offset(y: -muse * 0.72)
                        .id(last.id).transition(.opacity.combined(with: .scale(scale: 0.92)))
                }
                ForEach(dreams) { dreamView($0, now: now, muse: muse, width: width) }
                MuseFace(expression: expression, size: muse, blink: !reduceMotion && t.truncatingRemainder(dividingBy: 4.6) < 0.14)
                    .scaleEffect(x: 2 - squash, y: squash, anchor: .bottom)
                    .scaleEffect(reduceMotion ? 1 : breathe(t))
                    .rotationEffect(.degrees(reduceMotion ? 0 : tilt(t)))
                    .offset(x: reduceMotion ? 0 : sway(t), y: hop)
                    .shadow(color: Color(hex: 0xc9b28a).opacity(0.3), radius: muse * 0.1, y: muse * 0.06)
            }
            .frame(maxWidth: .infinity).frame(height: muse * 1.5)
            .animation(.easeInOut(duration: 0.3), value: session.progress.last?.id)
        }
    }

    private func sway(_ t: Double) -> CGFloat {
        switch session.flow {
        case .idle: sin(t * 0.9) * 3
        case .mewing: sin(t * 2.6) * 2.5
        case .composing, .asking: sin(t * 1.2) * 2
        default: 0
        }
    }

    private func tilt(_ t: Double) -> Double {
        switch session.flow {
        case .idle: sin(t * 0.7) * 3.5
        case .mewing: sin(t * 1.9) * 5
        case .composing, .asking: sin(t * 1.1) * 2
        default: 0
        }
    }

    private func breathe(_ t: Double) -> CGFloat {
        switch session.flow {
        case .idle: 1 + sin(t * 1.5) * 0.02 // slow, asleep
        case .mewing: 1 + sin(t * 4) * 0.025 // squish and expand
        case .mewed, .failed: 1
        default: 1 + sin(t * 2) * 0.012
        }
    }

    private func thoughtBubble(_ text: String) -> some View {
        Text(text).font(.system(size: 14, weight: .medium)).foregroundStyle(Color(hex: 0x5b4a3a)).multilineTextAlignment(.center).lineLimit(3)
            .padding(.horizontal, 13).padding(.vertical, 8)
            .background(Color.white, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(hex: 0xeadfca), lineWidth: 1))
            .shadow(color: Color(hex: 0xc9b28a).opacity(0.16), radius: 8, y: 3)
    }

    /// a dream drifts out a little from muse's side, stays, and fades. when muse wakes to work, they are drawn back in.
    private func dreamView(_ d: Dream, now: Date, muse: CGFloat, width: CGFloat) -> some View {
        let p = min(1, max(0, now.timeIntervalSince(d.born) / d.life))
        let out = 1 - pow(1 - min(1, p / 0.35), 2)
        let room = max(70, (width - muse) / 2 - 6) // the strip beside muse
        var x = d.side * (muse * 0.5 + room * 0.5 - 4 + out * 6)
        var y = -d.lift - out * 8 - CGFloat(sin(p * .pi * 2)) * 2
        var alpha = p < 0.12 ? p / 0.12 : p > 0.78 ? max(0, 1 - (p - 0.78) / 0.22) : 1
        var scale = 0.9 + 0.1 * out
        if let absorbFrom {
            // pulled into the head: it is getting serious
            let k = min(1, max(0, now.timeIntervalSince(absorbFrom) / 0.45))
            let pull = k * k
            x *= 1 - pull
            y = y * (1 - pull) - muse * 0.1 * pull
            scale *= 1 - 0.75 * pull
            alpha *= 1 - pull
        }
        return Button { if let fill = d.thought.fill { session.text = fill } } label: { thoughtBubble(d.thought.text).frame(width: room - 6) }
            .buttonStyle(FadePress())
            .scaleEffect(scale).opacity(alpha).offset(x: x, y: y)
            .allowsHitTesting(alpha > 0.5 && d.thought.fill != nil)
            .accessibilityHint("puts this idea in the box")
    }

    private func dream() async {
        guard dreaming else {
            guard !dreams.isEmpty else { return }
            absorbFrom = Date()
            try? await Task.sleep(for: .milliseconds(480))
            dreams = []
            absorbFrom = nil
            return
        }
        absorbFrom = nil
        try? await Task.sleep(for: .milliseconds(700))
        while !Task.isCancelled {
            let now = Date()
            dreams.removeAll { now.timeIntervalSince($0.born) >= $0.life }
            let all = ideas
            // one on each side at most, so it reads as a quiet train of thought
            if !all.isEmpty, !dreams.contains(where: { $0.side == nextSide }) {
                dreams.append(Dream(thought: all[nextDream % all.count], side: nextSide, born: now, lift: nextSide < 0 ? 50 : -6, life: 4.4))
                nextDream += 1
                nextSide = -nextSide
            }
            try? await Task.sleep(for: .milliseconds(2300))
        }
    }

    private func react(from old: MuseFlow, to new: MuseFlow) {
        if new == .mewing, old != .mewing, !reduceMotion {
            // heard you: a small bounce, then down to work
            withAnimation(.easeOut(duration: 0.14)) { hop = -14 }
            withAnimation(.spring(response: 0.36, dampingFraction: 0.5).delay(0.14)) { hop = 0 }
            withAnimation(.easeIn(duration: 0.12).delay(0.3)) { squash = 0.92 }
            withAnimation(.spring(response: 0.32, dampingFraction: 0.5).delay(0.42)) { squash = 1 }
        }
        if new == .mewed {
            focused = false
            beat = .hype
            mewedShown = false
            Task {
                // let's go... then the straight face, and the word
                if !reduceMotion {
                    withAnimation(.easeOut(duration: 0.15)) { hop = -22 }
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.42).delay(0.15)) { hop = 0 }
                }
                try? await Task.sleep(for: .milliseconds(reduceMotion ? 250 : 520))
                beat = .serious
                withAnimation(.spring(response: 0.34, dampingFraction: 0.62)) { mewedShown = true }
                try? await Task.sleep(for: .milliseconds(reduceMotion ? 450 : 850))
                guard session.flow == .mewed, let id = session.planId else { return }
                withAnimation(.easeIn(duration: 0.2)) { leaving = true }
                try? await Task.sleep(for: .milliseconds(180))
                onDraft(id)
                // tidy up behind the push, so coming back finds muse asleep again
                try? await Task.sleep(for: .milliseconds(500))
                session.reset()
                leaving = false
                mewedShown = false
            }
        }
    }

    // ---- under muse ----

    @ViewBuilder private var caption: some View {
        if session.flow == .mewed {
            Text("mewed.").font(.system(size: 34, weight: .heavy)).foregroundStyle(FB.text)
                .scaleEffect(mewedShown ? 1 : 0.6).opacity(mewedShown ? 1 : 0)
        } else {
            Text(status).font(.system(size: 15, weight: .medium)).foregroundStyle(session.flow == .failed ? FB.red : FB.muted)
                .id(status).transition(.opacity).animation(.easeInOut(duration: 0.25), value: status)
                .accessibilityAddTraits(.updatesFrequently)
        }
    }

    @ViewBuilder private var underMuse: some View {
        switch session.flow {
        case .idle, .composing:
            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    ForEach(starters, id: \.self) { s in
                        Button { session.text = s } label: {
                            Text(s).font(.system(size: 14, weight: .medium)).foregroundStyle(Color(hex: 0x5b4a3a))
                                .padding(.horizontal, 14).frame(height: 38)
                                .background(Color.white, in: Capsule()).overlay(Capsule().stroke(Color(hex: 0xeadfca), lineWidth: 1))
                        }
                        .buttonStyle(FadePress()).accessibilityHint("puts this in the box. it does not send.")
                    }
                }
                .padding(.horizontal, UI.margin)
            }
            .scrollIndicators(.hidden)
        case .asking:
            VStack(spacing: 10) {
                if let q = session.question { Text(q).font(.system(size: 17, weight: .semibold)).foregroundStyle(FB.text).multilineTextAlignment(.center).padding(.horizontal, 24) }
                QuietButton(label: "Just go with it") { session.goWithIt(app: app) }
            }
        case .failed:
            VStack(spacing: 10) {
                Text("\(sentenceCase(session.error ?? "Something went wrong")). Your words are still in the box.").font(UI.meta).foregroundStyle(FB.muted).multilineTextAlignment(.center).padding(.horizontal, 24)
                QuietButton(label: "Try again") { session.retry(app: app) }
            }
        default: EmptyView()
        }
    }

    // ---- the prompt box ----

    private var composer: some View {
        let busy = session.flow == .mewing || session.flow == .mewed
        return VStack(alignment: .leading, spacing: 8) {
            if let context = session.context {
                HStack(spacing: 6) {
                    Text("starting from \(context.title)").font(.system(size: 13, weight: .semibold)).lineLimit(1)
                    Button { session.context = nil } label: { Image(systemName: "xmark").font(.system(size: 10, weight: .bold)) }.accessibilityLabel("remove")
                }
                .foregroundStyle(Muse.text).padding(.horizontal, 10).padding(.vertical, 6).background(Muse.soft, in: Capsule())
            }
            HStack(alignment: .bottom, spacing: 8) {
                TextField(session.flow == .asking ? "tell muse a little more..." : "what are we getting into?", text: $session.text, axis: .vertical)
                    .font(.system(size: 17)).foregroundStyle(FB.text).lineLimit(1...4)
                    .textInputAutocapitalization(.never).submitLabel(.send).focused($focused).disabled(busy)
                    // return sends, the way a message box does
                    .onChange(of: session.text) {
                        if session.text.hasSuffix("\n") {
                            session.text = session.text.trimmingCharacters(in: .newlines)
                            session.submit(app: app)
                        }
                    }
                    .padding(.vertical, 12)
                    .accessibilityIdentifier("signal-text")
                Button { session.submit(app: app) } label: {
                    Image(systemName: "arrow.up").font(.system(size: 16, weight: .bold)).foregroundStyle(.white)
                        .frame(width: 36, height: 36).background(Muse.entryGradient, in: Circle())
                        .opacity(session.canSend ? 1 : 0.35)
                }
                .disabled(!session.canSend).padding(.bottom, 5)
                .accessibilityLabel("send to muse")
            }
            .padding(.leading, 18).padding(.trailing, 7)
            .background(Color.white, in: RoundedRectangle(cornerRadius: 26))
            .overlay(RoundedRectangle(cornerRadius: 26).stroke(focused ? Muse.line : Color(hex: 0xeadfca), lineWidth: 1.2))
            .shadow(color: Color(hex: 0xc9b28a).opacity(0.18), radius: 14, y: 4)
            Text("only you and muse see this. nothing goes to anyone until you send the draft.").font(.system(size: 12)).foregroundStyle(FB.muted)
                .frame(maxWidth: .infinity, alignment: .center)
        }
        .padding(.horizontal, UI.margin).padding(.top, 8).padding(.bottom, 10)
    }
}
