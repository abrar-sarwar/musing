import SwiftUI

// muse as a small living character at the bottom of "send a signal". three moods:
// musing (idle: ideas float out of it), mewing (it is working on what you sent) and
// mewed (a real plan came back). every mood follows the composer and the plan data;
// nothing here runs on a timer that pretends work happened. no sparkles, no particles:
// the character's face and movement carry it.

/// what the composer is doing right now, shared with the companion
@MainActor
final class MuseMood: ObservableObject {
    enum Stage: Equatable { case idle, reading, asking, checking, writing, sending, error }
    @Published var stage = Stage.idle
    /// the keyboard is up on the thought box: the form comes first, muse steps aside
    @Published var typing = false
    /// a plan this screen just made. the companion loads it and shows what it really is.
    @Published var freshPlanId: String?
    /// muse has a plan to show or is waiting on one: the screen scrolls it into view
    @Published var hasNews = false
}

enum MuseState: Equatable { case musing, mewing, waiting, mewed, error }

// ---------- the face ----------

private struct Curve: Shape {
    /// positive bends down in the middle (a smile), negative bends up (closed happy eyes, a frown)
    var bend: CGFloat
    var animatableData: CGFloat {
        get { bend }
        set { bend = newValue }
    }

    func path(in r: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: r.minX, y: r.midY - bend * r.height / 2))
        p.addQuadCurve(to: CGPoint(x: r.maxX, y: r.midY - bend * r.height / 2), control: CGPoint(x: r.midX, y: r.midY + bend * r.height * 1.5))
        return p
    }
}

/// muse's own mark (the lavender to pink circle) with a face instead of a glyph
struct MuseFace: View {
    let state: MuseState
    var size: CGFloat = 96
    var blink = false

    var body: some View {
        let ink = Color.white
        let line = max(2.5, size * 0.035)
        ZStack {
            Circle().fill(Muse.gradient)
            // a little brighter when it has something to show
            Circle().fill(Color.white.opacity(state == .mewed ? 0.14 : 0))
            HStack(spacing: size * 0.2) {
                eye(ink, line)
                eye(ink, line)
            }
            .offset(y: -size * 0.07)
            mouth(ink, line).offset(y: size * 0.17)
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .shadow(color: Muse.start.opacity(state == .mewed ? 0.38 : 0.26), radius: size * 0.16, y: size * 0.07)
        .animation(.easeInOut(duration: 0.22), value: state)
    }

    @ViewBuilder private func eye(_ ink: Color, _ line: CGFloat) -> some View {
        switch state {
        case .mewed:
            // closed and smiling
            Curve(bend: -0.9).stroke(ink, style: StrokeStyle(lineWidth: line, lineCap: .round)).frame(width: size * 0.15, height: size * 0.07)
        case .mewing:
            // narrowed in concentration
            Capsule().fill(ink).frame(width: size * 0.15, height: line)
        default:
            Capsule().fill(ink).frame(width: size * 0.085, height: blink ? line : size * (state == .waiting ? 0.1 : 0.15))
                .frame(height: size * 0.15)
        }
    }

    @ViewBuilder private func mouth(_ ink: Color, _ line: CGFloat) -> some View {
        let stroke = StrokeStyle(lineWidth: line, lineCap: .round)
        switch state {
        case .mewed: Curve(bend: 1).stroke(ink, style: stroke).frame(width: size * 0.3, height: size * 0.1)
        case .mewing: Capsule().fill(ink).frame(width: size * 0.1, height: line)
        case .error: Curve(bend: -0.6).stroke(ink, style: stroke).frame(width: size * 0.16, height: size * 0.06)
        default: Curve(bend: 0.7).stroke(ink, style: stroke).frame(width: size * 0.18, height: size * 0.07)
        }
    }
}

// ---------- the ideas that float out ----------

struct MuseIdea: Equatable {
    let label: String
    /// what goes in the thought box when it is tapped
    let fill: String
}

private struct Bubble: Identifiable {
    let id = UUID()
    let idea: MuseIdea
    let side: CGFloat // -1 left, 1 right
    let born: Date
    let reach: CGFloat // how far out it travels
    let rise: CGFloat // how far up
    let life: Double
}

private let defaultIdeas: [MuseIdea] = [
    "coffee run?", "boba later?", "thrift trip?", "anyone down to hoop?", "movie night?", "food spot?", "study sesh?", "game night?",
].map { MuseIdea(label: $0, fill: $0) }

// ---------- the companion ----------

struct MuseCompanion: View {
    @EnvironmentObject var app: AppState
    @ObservedObject var mood: MuseMood
    /// the musing. home for this person, already loaded by the screen. plans in it are shaped by the server.
    let home: MusingHome?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var bubbles: [Bubble] = []
    @State private var fadeFrom: Date?
    @State private var nextIdea = 0
    @State private var nextSide: CGFloat = -1
    @State private var freshPlan: PlanView?
    @State private var dismissed: Set<String> = []
    @State private var squash: CGFloat = 1
    @State private var hop: CGFloat = 0
    @State private var cardShown = false
    @State private var suggestion: Suggestion?

    private var avatar: CGFloat { UIScreen.main.bounds.width < 380 ? 84 : 96 }

    /// the plan to talk about: the one just made here, else the newest live one from the last day
    private var plan: PlanView? {
        let mine = home?.mine ?? []
        if let id = mood.freshPlanId, !dismissed.contains(id) {
            if let live = mine.first(where: { $0.id == id }) { return live }
            if let freshPlan, freshPlan.id == id { return freshPlan }
        }
        return mine.first { p in
            guard !dismissed.contains(p.id), p.state != "faded", p.completed != true else { return false }
            return parseDate(p.updatedAt).map { Date().timeIntervalSince($0) < 86400 } ?? false
        }
    }

    private var state: MuseState {
        switch mood.stage {
        case .error: return .error
        case .reading, .checking, .writing, .sending: return .mewing
        case .asking: return .waiting
        case .idle: break
        }
        guard let plan else { return .musing }
        return plan.state == "proposing" ? .waiting : .mewed
    }

    private var status: String {
        switch mood.stage {
        case .reading: return "muse is mewing..."
        case .checking: return "checking who's down..."
        case .writing: return "putting it together..."
        case .sending: return "sending it out..."
        case .asking: return "muse has one question for you."
        case .error: return "that didn't go through."
        case .idle: break
        }
        switch state {
        case .mewed: return "mewed."
        case .waiting: return "signal sent. waiting for your people..."
        default: return "muse is musing..."
        }
    }

    /// ideas drawn from what this person is into and what is in the catalog, then the stock ones
    private var ideas: [MuseIdea] {
        var seen = Set<String>()
        var out: [MuseIdea] = []
        let topics = (app.me?.interests ?? []) + (app.catalog?.events ?? []).flatMap { $0.tags ?? [] }
        for t in topics {
            let topic = t.lowercased().replacingOccurrences(of: "_", with: " ").replacingOccurrences(of: "-", with: " ")
            guard topic.count >= 3, topic.count <= 18, seen.insert(topic).inserted else { continue }
            out.append(MuseIdea(label: "\(topic)?", fill: "anyone down for \(topic)?"))
            if out.count >= 8 { break }
        }
        // one of this person's own, then a stock one, so both kinds keep coming
        var mixed: [MuseIdea] = []
        for i in 0..<max(out.count, defaultIdeas.count) {
            if i < defaultIdeas.count { mixed.append(defaultIdeas[i]) }
            if i < out.count { mixed.append(out[i]) }
        }
        return mixed
    }

    private var floating: Bool { state == .musing && !reduceMotion && !mood.typing }

    var body: some View {
        VStack(spacing: 10) {
            if cardShown, let plan, state == .mewed { planCard(plan).transition(.move(edge: .bottom).combined(with: .opacity)) }

            TimelineView(.animation(minimumInterval: 1.0 / 30, paused: reduceMotion || mood.typing)) { ctx in
                let now = ctx.date
                let t = now.timeIntervalSinceReferenceDate
                ZStack {
                    ForEach(bubbles) { bubbleView($0, now: now) }
                    MuseFace(state: state, size: avatar, blink: !reduceMotion && t.truncatingRemainder(dividingBy: 4.2) < 0.13)
                        .scaleEffect(x: 2 - squash, y: squash)
                        .scaleEffect(reduceMotion ? 1 : breathe(t))
                        .rotationEffect(.degrees(reduceMotion || state != .mewing ? 0 : sin(t * 2.4) * 4))
                        .offset(y: (reduceMotion ? 0 : drift(t)) + hop)
                        .accessibilityHidden(true)
                }
                // room above for the ideas only while they are floating
                .frame(maxWidth: .infinity).frame(height: avatar + (state == .musing ? 64 : 14), alignment: .bottom)
            }

            Text(status)
                .font(state == .mewed ? .system(size: 22, weight: .heavy) : .system(size: 14, weight: .medium))
                .foregroundStyle(state == .mewed ? FB.text : state == .error ? FB.red : FB.muted)
                .multilineTextAlignment(.center)
                .id(status).transition(.opacity)
                .accessibilityAddTraits(.updatesFrequently)

            below
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 20).padding(.bottom, 8)
        .animation(.easeInOut(duration: 0.25), value: status)
        // the form comes first while the keyboard is up
        .opacity(mood.typing ? 0 : 1).frame(height: mood.typing ? 0 : nil).clipped()
        .task(id: floating) { await float() }
        .task(id: mood.freshPlanId) { await loadFresh() }
        .task(id: "\(app.userId)-\(app.version)") {
            dismissed = []
            suggestion = nil
            if app.catalog == nil { await app.loadCatalog() }
            guard app.settings.museOn else { return }
            // cached per person on the server, so this is not a muse call every time
            let s: Suggestion? = try? await API.get("/api/muse/suggest", user: app.userId)
            if !Task.isCancelled { suggestion = s }
        }
        .onChange(of: state) { old, new in react(from: old, to: new) }
        .onAppear { cardShown = state == .mewed } // coming back to a plan that exists: show it, no celebration
        .onChange(of: plan?.id, initial: true) { mood.hasNews = plan != nil }
    }

    // ---- what sits under the status line ----

    @ViewBuilder private var below: some View {
        switch state {
        case .waiting:
            if mood.stage == .idle, let plan {
                Button { app.push(.plan(plan.id)) } label: {
                    Text("\(sentenceCase(plan.activity ?? "Your plan")) · \(plan.downCount) of \(plan.quorum) in").font(.system(size: 14, weight: .semibold)).foregroundStyle(FB.blue)
                        .padding(.horizontal, 14).frame(height: 34).background(FB.blueSoft, in: Capsule())
                }
                .buttonStyle(FadePress())
            }
        case .error:
            Text("Your thought is still up there. Tap Send a signal to try again.").font(UI.meta).foregroundStyle(FB.muted).multilineTextAlignment(.center)
        case .musing:
            if reduceMotion {
                // no floating: the same ideas, standing still
                Flow(spacing: 6) { ForEach(Array(ideas.prefix(4).enumerated()), id: \.offset) { _, idea in chip(idea) } }
            }
            if let s = suggestion {
                Button { app.handoff = s.suggestion } label: {
                    Text("muse suggests: \u{201C}\(s.suggestion)\u{201D}").font(UI.meta).foregroundStyle(Muse.text).multilineTextAlignment(.center).lineLimit(2)
                }
                .buttonStyle(FadePress()).accessibilityHint("fills the thought box")
            }
        default: EmptyView()
        }
    }

    private func chip(_ idea: MuseIdea) -> some View {
        Button { app.handoff = idea.fill } label: {
            Text(idea.label).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Muse.text).lineLimit(1)
                .padding(.horizontal, 12).frame(height: 32)
                .background(Color.white, in: Capsule())
                .overlay(Capsule().stroke(Muse.line, lineWidth: 1))
                .shadow(color: Muse.start.opacity(0.12), radius: 6, y: 2)
        }
        .buttonStyle(FadePress())
        .accessibilityHint("fills the thought box")
    }

    // ---- motion ----

    private func drift(_ t: Double) -> CGFloat {
        switch state {
        case .mewing: sin(t * 3.2) * 2
        case .mewed, .error: 0
        default: sin(t * 1.6) * 5
        }
    }

    private func breathe(_ t: Double) -> CGFloat {
        switch state {
        case .mewing: 1 + sin(t * 4.2) * 0.022
        case .error: 1
        default: 1 + sin(t * 2.1) * 0.014
        }
    }

    /// a bubble starts at the edge of the avatar, grows as it leaves, drifts out and up, then fades
    private func bubbleView(_ b: Bubble, now: Date) -> some View {
        let p = min(1, max(0, now.timeIntervalSince(b.born) / b.life))
        let out = 1 - pow(1 - p, 2.2) // quick away from muse, slowing as it floats
        // it leaves from muse's side, a little above the middle
        let x = b.side * (avatar * 0.36 + out * b.reach)
        let y = -avatar * 0.3 - out * b.rise - CGFloat(sin(p * .pi * 2)) * 3
        let grow = min(1, p / 0.12)
        let scale = 0.85 + 0.15 * (1 - pow(1 - grow, 3)) + (grow < 1 ? 0 : 0.02 * CGFloat(sin(p * 9)))
        var alpha = p < 0.08 ? p / 0.08 : p > 0.72 ? max(0, 1 - (p - 0.72) / 0.28) : 1
        if let fadeFrom { alpha *= max(0, 1 - now.timeIntervalSince(fadeFrom) / 0.35) }
        return chip(b.idea)
            .scaleEffect(scale, anchor: b.side < 0 ? .trailing : .leading)
            .opacity(alpha)
            .offset(x: x, y: y)
            .allowsHitTesting(alpha > 0.4)
            .zIndex(-1)
    }

    private func float() async {
        guard floating else {
            // whatever is in the air fades out instead of vanishing
            if !bubbles.isEmpty {
                fadeFrom = Date()
                try? await Task.sleep(for: .milliseconds(400))
                if !Task.isCancelled || !floating { bubbles = [] }
            }
            return
        }
        fadeFrom = nil
        while !Task.isCancelled {
            let now = Date()
            bubbles.removeAll { now.timeIntervalSince($0.born) >= $0.life }
            let all = ideas
            if bubbles.count < 4, !all.isEmpty {
                let idea = all[nextIdea % all.count]
                nextIdea += 1
                // long ones stay closer so they never leave the screen
                let room = max(20, UIScreen.main.bounds.width / 2 - avatar * 0.42 - CGFloat(idea.label.count) * 7.4 - 44)
                // each side takes turns between a low path and a high one, so two on one side never sit on each other
                let high = (nextIdea / 2) % 2 == 0
                bubbles.append(Bubble(idea: idea, side: nextSide, born: now, reach: min(room, .random(in: 40...80)), rise: high ? .random(in: 52...66) : .random(in: 10...22), life: .random(in: 3.2...4)))
                nextSide = -nextSide
            }
            try? await Task.sleep(for: .milliseconds(Int.random(in: 1200...1800)))
        }
    }

    private func react(from old: MuseState, to new: MuseState) {
        if new == .mewing, old != .mewing, !reduceMotion {
            // received: a small squash, then back to shape
            withAnimation(.easeIn(duration: 0.12)) { squash = 0.9 }
            withAnimation(.spring(response: 0.34, dampingFraction: 0.45).delay(0.12)) { squash = 1 }
        }
        if new == .mewed, old != .mewed {
            Task {
                // a beat of stillness, then the hop and the card
                try? await Task.sleep(for: .milliseconds(200))
                guard state == .mewed else { return }
                if !reduceMotion {
                    withAnimation(.easeOut(duration: 0.16)) { hop = -16 }
                    withAnimation(.spring(response: 0.42, dampingFraction: 0.42).delay(0.16)) { hop = 0 }
                }
                withAnimation(.spring(response: 0.5, dampingFraction: 0.78)) { cardShown = true }
            }
        }
        if new != .mewed { withAnimation(.easeOut(duration: 0.2)) { cardShown = false } }
    }

    // ---- the plan that came back ----

    private func loadFresh() async {
        guard let id = mood.freshPlanId else { return }
        let user = app.userId
        let p: PlanView? = try? await API.get("/api/plans/\(id)", user: user)
        guard user == app.userId, !Task.isCancelled else { return }
        freshPlan = p
    }

    /// a compact preview of the real plan. a draft says so: nothing has gone to anyone yet.
    private func planCard(_ p: PlanView) -> some View {
        let draft = p.state == "draft"
        let name = sentenceCase(p.activity ?? "Your plan")
        let people = draft ? "\(friendCount(p.invited)) muse would ask" : "\(friendCount(p.downCount)) \(p.downCount == 1 ? "is" : "are") in"
        return Card(tint: true) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(draft ? "MUSE DRAFT · NOT SENT" : "CONFIRMED").font(UI.kicker).tracking(0.3).foregroundStyle(Muse.text)
                    Spacer(minLength: 0)
                    Button {
                        dismissed.insert(p.id)
                        if mood.freshPlanId == p.id { mood.freshPlanId = nil }
                    } label: { Image(systemName: "xmark").font(.system(size: 12, weight: .bold)).foregroundStyle(FB.muted).frame(width: 28, height: 24) }
                        .accessibilityLabel("dismiss")
                }
                Text(draft ? "\(name), drafted." : "\(name) is happening.").font(UI.cardTitle).foregroundStyle(FB.text).fixedSize(horizontal: false, vertical: true)
                Text([p.when.map(sentenceCase), people].compactMap { $0 }.joined(separator: " · ")).font(UI.body).foregroundStyle(FB.muted)
                GradientButton(label: draft ? "Review draft" : "View plan", fill: true) { app.push(.plan(p.id)) }.padding(.top, 6)
            }
        }
    }
}
