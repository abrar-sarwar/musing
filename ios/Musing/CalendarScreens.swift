import SwiftUI

// what the calendar icon opens: this person's plans on a month, styled by where each one
// stands, and their own availability (the weekly free time muse plans from).

// ---------- what this phone has seen ----------

/// which version of each plan this person last opened on this phone. it is what makes a
/// plan "unread" (the red outline, the red dot) and what "what changed" compares against.
/// kept on the device: nothing about what someone has or hasn't looked at leaves it.
enum PlanSeen {
    struct Mark: Codable, Equatable {
        var version: Int
        var state: String
        var when: String?
        var place: String?
    }

    private static func key(_ user: String) -> String { "plan_seen_\(user)" }

    private static func all(_ user: String) -> [String: Mark]? {
        guard let data = UserDefaults.standard.data(forKey: key(user)) else { return nil }
        return try? JSONDecoder().decode([String: Mark].self, from: data)
    }

    private static func save(_ marks: [String: Mark], _ user: String) {
        if let data = try? JSONEncoder().encode(marks) { UserDefaults.standard.set(data, forKey: key(user)) }
    }

    static func mark(of plan: PlanView, user: String) -> Mark? { all(user)?[plan.id] }

    static func see(_ plan: PlanView, user: String) {
        var marks = all(user) ?? [:]
        marks[plan.id] = Mark(version: plan.version, state: plan.state, when: plan.when, place: plan.where)
        save(marks, user)
    }

    /// the first time this phone meets this person's plans, nothing is news: everything is taken as seen
    static func adopt(_ plans: [PlanView], user: String) {
        guard all(user) == nil else { return }
        var marks: [String: Mark] = [:]
        for p in plans { marks[p.id] = Mark(version: p.version, state: p.state, when: p.when, place: p.where) }
        save(marks, user)
    }

    /// new to this person, or changed since they last opened it. a draft they just made themselves is not news.
    static func isUnread(_ plan: PlanView, user: String) -> Bool {
        guard plan.state != "faded" else { return false }
        guard let m = all(user)?[plan.id] else { return !(plan.role == "starter" && plan.state == "draft") }
        return m.version != plan.version || m.state != plan.state
    }

    /// muse reworked it since they last looked
    static func isUpdated(_ plan: PlanView, user: String) -> Bool {
        guard let m = all(user)?[plan.id] else { return false }
        return m.version < plan.version
    }
}

// ---------- how a plan looks, by where it stands ----------

enum PlanLook: Equatable {
    case updated // changed or new since this person last opened it
    case draft
    case sent // out with friends, waiting on answers
    case confirmed
    case past // happened, or didn't land

    static func of(_ p: PlanView, user: String) -> PlanLook {
        if p.state == "faded" || p.completed == true { return .past }
        if PlanSeen.isUnread(p, user: user) { return .updated }
        switch p.state {
        case "draft": return .draft
        case "happening": return .confirmed
        default: return .sent
        }
    }

    var ink: Color {
        switch self {
        case .updated: FB.badge
        case .draft: Color(hex: 0xd97706)
        case .past: FB.muted
        default: FB.blue
        }
    }

    var fill: Color {
        switch self {
        case .confirmed: FB.blueSoft
        case .past: FB.bg2
        default: .white
        }
    }

    var icon: String? {
        switch self {
        case .updated: "bell"
        case .draft: "clock"
        case .confirmed: "checkmark"
        default: nil
        }
    }

    var name: String {
        switch self {
        case .updated: "Updated"
        case .draft: "Draft"
        case .sent: "Waiting on friends"
        case .confirmed: "Confirmed"
        case .past: "Past"
        }
    }

    /// the border: red for news, dashed for a draft, soft blue once it's on, a hairline otherwise
    func border(_ radius: CGFloat = UI.cardRadius) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius)
        switch self {
        case .updated: return AnyView(shape.stroke(FB.badge, lineWidth: 1.5))
        case .draft: return AnyView(shape.stroke(ink, style: StrokeStyle(lineWidth: 1.2, dash: [5, 4])))
        case .confirmed: return AnyView(shape.stroke(FB.blue.opacity(0.25), lineWidth: 1))
        default: return AnyView(shape.stroke(FB.button, lineWidth: 1))
        }
    }
}

// ---------- the calendar ----------

private let weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

/// the next date a plan's day falls on. plans say when in words ("saturday at 1"), so this reads the day out of them.
func planDate(_ p: PlanView, from now: Date = Date()) -> Date? {
    guard let when = p.when?.lowercased() else { return nil }
    let cal = Calendar.current
    guard let idx = weekdayNames.firstIndex(where: { when.contains($0) || when.contains(String($0.prefix(3)) + " ") }) else { return nil }
    let today = cal.startOfDay(for: now)
    let ahead = (idx + 1 - cal.component(.weekday, from: today) + 7) % 7
    return cal.date(byAdding: .day, value: ahead, to: today)
}

struct CalendarScreen: View {
    @EnvironmentObject var app: AppState
    @State private var home: MusingHome?
    @State private var loading = true
    @State private var month = Calendar.current.date(from: Calendar.current.dateComponents([.year, .month], from: Date())) ?? Date()

    private var plans: [(plan: PlanView, date: Date)] {
        var seen = Set<String>()
        return ((home?.asks ?? []) + (home?.mine ?? []))
            .filter { seen.insert($0.id).inserted && $0.state != "faded" }
            .compactMap { p in planDate(p).map { (p, $0) } }
            .sorted { $0.date < $1.date }
    }

    var body: some View {
        let cal = Calendar.current
        SubScreen(title: "Calendar") {
            ScrollView {
                VStack(alignment: .leading, spacing: UI.gap) {
                    Button { app.push(.availability) } label: {
                        HStack {
                            Text("Edit availability").font(.system(size: 15, weight: .semibold)).foregroundStyle(FB.blue)
                            Spacer()
                            Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(FB.blue)
                        }
                        .padding(.horizontal, UI.cardPad).frame(height: UI.buttonBig)
                        .background(FB.blueSoft, in: RoundedRectangle(cornerRadius: UI.buttonRadius))
                    }
                    .buttonStyle(FadePress())

                    HStack {
                        arrow("chevron.left", "Previous month") { step(-1) }
                        Spacer()
                        Text(month.formatted(.dateTime.month(.wide).year())).font(UI.section).foregroundStyle(FB.text)
                        Spacer()
                        arrow("chevron.right", "Next month") { step(1) }
                    }
                    .padding(.top, 4)
                    grid(cal)
                    key

                    let inMonth = plans.filter { cal.isDate($0.date, equalTo: month, toGranularity: .month) }
                    HStack(alignment: .firstTextBaseline) {
                        SectionTitle("Coming up \(month.formatted(.dateTime.month(.wide)))")
                        Button { app.push(.musing(compose: false, tab: .plans)) } label: { Text("All plans").font(.system(size: 14, weight: .semibold)).foregroundStyle(FB.blue) }
                    }
                    .padding(.top, 8)
                    if inMonth.isEmpty { EmptyNote(loading ? "One sec" : "Nothing on the calendar this month.") }
                    ForEach(inMonth, id: \.plan.id) { item in
                        Button { app.push(.plan(item.plan.id)) } label: { PlanSummaryCard(plan: item.plan) }.buttonStyle(FadePress())
                    }
                    Text("Days come from each plan's own day (\u{201C}saturday at 1\u{201D}), shown on the next one coming up.").font(UI.meta).foregroundStyle(FB.muted)
                }
                .padding(.horizontal, UI.margin).padding(.top, 12).padding(.bottom, 40)
            }
        }
        .task(id: "\(app.userId)-\(app.version)") { await load() }
        .onTableChange("plans") { Task { await load() } }
    }

    private func load() async {
        let user = app.userId
        let h: MusingHome? = try? await API.get("/api/musing/home", user: user)
        guard user == app.userId, !Task.isCancelled else { return }
        if let h { home = h }
        loading = false
    }

    private func step(_ by: Int) {
        if let m = Calendar.current.date(byAdding: .month, value: by, to: month) { month = m }
    }

    private func arrow(_ icon: String, _ label: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) { Image(systemName: icon).font(.system(size: 15, weight: .semibold)).foregroundStyle(FB.muted).frame(width: 36, height: 36) }
            .accessibilityLabel(label)
    }

    private func grid(_ cal: Calendar) -> some View {
        let days = cal.range(of: .day, in: .month, for: month)?.count ?? 30
        let lead = cal.component(.weekday, from: month) - 1
        let cells: [Int?] = Array(repeating: nil, count: lead) + (1...days).map { Optional($0) }
        return LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: 6) {
            ForEach(Array(["S", "M", "T", "W", "T", "F", "S"].enumerated()), id: \.offset) { _, d in
                Text(d).font(.system(size: 12, weight: .semibold)).foregroundStyle(FB.muted)
            }
            ForEach(Array(cells.enumerated()), id: \.offset) { _, day in
                if let day, let date = cal.date(byAdding: .day, value: day - 1, to: month) {
                    dayCell(day, date: date, cal)
                } else {
                    Color.clear.frame(height: 40)
                }
            }
        }
    }

    private func dayCell(_ day: Int, date: Date, _ cal: Calendar) -> some View {
        let today = cal.isDateInToday(date)
        let here = plans.filter { cal.isDate($0.date, inSameDayAs: date) }.map { PlanLook.of($0.plan, user: app.userId) }
        // the most pressing thing on that day decides how it looks
        let look = [PlanLook.updated, .confirmed, .sent, .draft].first { here.contains($0) }
        return VStack(spacing: 2) {
            Text("\(day)").font(.system(size: 15, weight: today || look != nil ? .bold : .regular)).foregroundStyle(today ? .white : look?.ink ?? FB.text)
            Circle().fill(look == nil || today ? Color.clear : look == .draft ? Color.clear : look!.ink).frame(width: 5, height: 5)
                .overlay(Circle().stroke(look == .draft && !today ? look!.ink : .clear, lineWidth: 1.2))
        }
        .frame(maxWidth: .infinity).frame(height: 40)
        .background(today ? FB.blue : look == .confirmed ? FB.blueSoft : .clear, in: RoundedRectangle(cornerRadius: 10))
        .overlay { if let look, look != .confirmed, !today { look.border(10) } }
        .padding(.horizontal, 3)
        .accessibilityLabel("\(date.formatted(.dateTime.month().day()))\(look.map { ", \($0.name.lowercased()) plan" } ?? "")")
    }

    private var key: some View {
        Flow(spacing: 12) {
            ForEach([PlanLook.confirmed, .sent, .draft, .updated], id: \.self) { look in
                HStack(spacing: 5) {
                    Circle().fill(look == .draft ? .clear : look.ink).frame(width: 7, height: 7).overlay(Circle().stroke(look.ink, lineWidth: 1.2))
                    Text(look.name).font(.system(size: 12, weight: .semibold)).foregroundStyle(FB.muted)
                }
            }
        }
    }
}

// ---------- availability ----------

struct FreeWindow: Codable, Hashable {
    var day: String // mon, tue, ...
    var start: String // "11:00"
    var end: String
}

private struct WindowsResponse: Decodable { let windows: [FreeWindow] }

private let dayOrder = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
private let dayNames = ["mon": "Mondays", "tue": "Tuesdays", "wed": "Wednesdays", "thu": "Thursdays", "fri": "Fridays", "sat": "Saturdays", "sun": "Sundays"]

/// "18:00" -> "6:00 PM"
private func clock(_ t: String) -> String {
    let parts = t.split(separator: ":").compactMap { Int($0) }
    guard parts.count == 2 else { return t }
    let h = parts[0], m = parts[1]
    return "\((h + 11) % 12 + 1):\(String(format: "%02d", m)) \(h < 12 ? "AM" : "PM")"
}

// this person's weekly free time: the rules muse starts from when it picks a day and time.
// only their own, and only ever saved when they tap save.
struct AvailabilityScreen: View {
    @EnvironmentObject var app: AppState
    @State private var windows: [FreeWindow] = []
    @State private var saved: [FreeWindow] = []
    @State private var loading = true
    @State private var busy = false
    @State private var error: String?
    @State private var adding = false
    @State private var newDay = "sat"
    @State private var newStart = "12:00"
    @State private var newEnd = "17:00"

    private static let times: [String] = (6...23).flatMap { h in ["\(String(format: "%02d", h)):00", "\(String(format: "%02d", h)):30"] }
    private var sorted: [FreeWindow] {
        windows.sorted { (dayOrder.firstIndex(of: $0.day) ?? 9, $0.start) < (dayOrder.firstIndex(of: $1.day) ?? 9, $1.start) }
    }

    var body: some View {
        SubScreen(title: "Availability") {
            ScrollView {
                VStack(alignment: .leading, spacing: UI.gap) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Schedule patterns").font(UI.title).foregroundStyle(FB.text)
                        Text("Rules that muse will consider when it puts a plan together.").font(.system(size: 14)).foregroundStyle(FB.muted)
                    }
                    if loading { EmptyNote("One sec") }
                    if !loading, windows.isEmpty { EmptyNote("No free time saved yet. Add a window so muse has somewhere to start.") }
                    ForEach(sorted, id: \.self) { w in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text("USUALLY FREE").font(UI.kicker).tracking(0.3).foregroundStyle(FB.blue)
                                Spacer()
                                Button { windows.removeAll { $0 == w } } label: { Text("Remove").font(.system(size: 14, weight: .semibold)).foregroundStyle(FB.blue) }
                            }
                            Text(dayNames[w.day] ?? w.day).font(UI.cardTitle).foregroundStyle(FB.text)
                            Text("\(clock(w.start)) \u{2014} \(clock(w.end))").font(.system(size: 16, weight: .semibold)).foregroundStyle(FB.text)
                            Text("Every week").font(UI.meta).foregroundStyle(FB.muted)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading).padding(UI.cardPad)
                        .background(Color.white, in: RoundedRectangle(cornerRadius: UI.cardRadius))
                        .overlay(RoundedRectangle(cornerRadius: UI.cardRadius).stroke(FB.blue.opacity(0.6), lineWidth: 1))
                    }

                    if adding {
                        Card {
                            VStack(alignment: .leading, spacing: UI.gap) {
                                OptionRow(label: "Day", options: dayOrder.map { ($0, dayNames[$0] ?? $0) }, selection: $newDay)
                                OptionRow(label: "From", options: Self.times.map { ($0, clock($0)) }, selection: $newStart)
                                OptionRow(label: "Until", options: Self.times.map { ($0, clock($0)) }, selection: $newEnd)
                                if newStart >= newEnd { Text("The end has to be after the start.").font(UI.meta).foregroundStyle(FB.red) }
                                HStack(spacing: 10) {
                                    QuietButton(label: "Cancel", fill: true, outline: true) { adding = false }
                                    QuietButton(label: "Add window", disabled: newStart >= newEnd, fill: true) {
                                        windows.removeAll { $0.day == newDay && $0.start == newStart }
                                        windows.append(FreeWindow(day: newDay, start: newStart, end: newEnd))
                                        adding = false
                                    }
                                }
                            }
                        }
                    } else {
                        QuietButton(label: "+ Add another window", fill: true) { adding = true }
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 8) {
                            MuseFace(expression: .awake, size: 24)
                            Text("Your rules stay private").font(.system(size: 14, weight: .bold)).foregroundStyle(FB.blue)
                        }
                        Text("Friends see the plan, not your schedule or your reasons. Changing this never moves a confirmed plan.").font(.system(size: 14)).foregroundStyle(FB.text).fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading).padding(UI.cardPad)
                    .background(Muse.wash, in: RoundedRectangle(cornerRadius: UI.cardRadius))

                    if let error { Text(sentenceCase(error)).font(.system(size: 14)).foregroundStyle(FB.red) }
                    GradientButton(label: windows == saved ? "Saved" : "Save availability", big: true, busy: busy, disabled: loading || windows == saved) { save() }
                }
                .padding(.horizontal, UI.margin).padding(.top, 12).padding(.bottom, 40)
            }
        }
        .task(id: "\(app.userId)-\(app.version)") { await load() }
    }

    private func load() async {
        let user = app.userId
        do {
            let r: WindowsResponse = try await API.get("/api/user/availability", user: user)
            guard user == app.userId, !Task.isCancelled else { return }
            windows = r.windows
            saved = r.windows
            error = nil
        } catch let e {
            guard !Task.isCancelled else { return }
            error = errorText(e)
        }
        loading = false
    }

    private func save() {
        busy = true
        error = nil
        let body: [String: Any] = ["windows": windows.map { ["day": $0.day, "start": $0.start, "end": $0.end] }]
        Task {
            do {
                let data = try await API.data("PUT", "/api/user/availability", user: app.userId, body: body)
                let r = try API.decoder.decode(WindowsResponse.self, from: data)
                windows = r.windows
                saved = r.windows
                toast("Availability saved.")
            } catch let e { error = errorText(e) }
            busy = false
        }
    }
}
