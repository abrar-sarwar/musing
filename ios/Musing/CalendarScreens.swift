import SwiftUI

// what the calendar icon opens: this person's plans on a month, styled by where each one
// stands, and their own availability (the weekly free time muse plans from).

// ---------- what this phone has seen ----------

/// which version of each plan this person last opened on this phone. it is what makes a
/// plan "updated" (the red outline, the bell, the red dot) and what "what changed" compares against.
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

    /// someone else's "what if" changed it since this person last opened it. that is the only
    /// thing that makes a plan news: not a new plan, not an answer, not a change they asked for.
    /// a plan's version only moves when a "what if" changes it, and every plan starts at 1.
    static func isUpdated(_ plan: PlanView, user: String) -> Bool {
        guard plan.state != "faded", plan.completed != true, plan.revisedByMe != true else { return false }
        return (all(user)?[plan.id]?.version ?? 1) < plan.version
    }
}

// ---------- how a plan looks, by where it stands ----------

enum PlanLook: Equatable {
    case updated // someone else's "what if" changed it since this person last opened it
    case draft
    case sent // out with friends, waiting on answers
    case confirmed
    case past // happened, or didn't land

    static func of(_ p: PlanView, user: String) -> PlanLook {
        if p.state == "faded" || p.completed == true { return .past }
        if PlanSeen.isUpdated(p, user: user) { return .updated }
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
    /// the day tapped on the grid. its plans are lifted above the month's list.
    @State private var picked: Date?

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

                    let onPicked = picked.map { day in plans.filter { cal.isDate($0.date, inSameDayAs: day) } } ?? []
                    if let picked, !onPicked.isEmpty {
                        HStack(alignment: .firstTextBaseline) {
                            SectionTitle(picked.formatted(.dateTime.weekday(.wide).month(.wide).day()))
                            Button { withAnimation(.easeOut(duration: 0.15)) { self.picked = nil } } label: { Text("Clear").font(.system(size: 14, weight: .semibold)).foregroundStyle(FB.blue) }
                        }
                        .padding(.top, 8)
                        ForEach(onPicked, id: \.plan.id) { item in
                            Button { app.push(.plan(item.plan.id)) } label: { PlanSummaryCard(plan: item.plan) }.buttonStyle(FadePress())
                        }
                    }

                    // the picked day's plans are already shown above, so the month's list carries the rest
                    let inMonth = plans.filter { item in cal.isDate(item.date, equalTo: month, toGranularity: .month) && !onPicked.contains { $0.plan.id == item.plan.id } }
                    HStack(alignment: .firstTextBaseline) {
                        SectionTitle("Coming up \(month.formatted(.dateTime.month(.wide)))")
                        Button { app.push(.musing(compose: false, tab: .plans)) } label: { Text("All plans").font(.system(size: 14, weight: .semibold)).foregroundStyle(FB.blue) }
                    }
                    .padding(.top, 8)
                    if inMonth.isEmpty { EmptyNote(loading ? "One sec" : onPicked.isEmpty ? "Nothing on the calendar this month." : "Nothing else this month.") }
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
        picked = nil
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
        let chosen = picked.map { cal.isDate($0, inSameDayAs: date) } ?? false
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
        // the tapped day wears a solid ring in its own status colour
        .overlay { if chosen { RoundedRectangle(cornerRadius: 12).stroke(look?.ink ?? FB.blue, lineWidth: 2).padding(-3) } }
        .padding(.horizontal, 3)
        .contentShape(Rectangle())
        // only a day with a plan on it does anything. tapping it again puts the list back.
        .onTapGesture {
            guard !here.isEmpty else { return }
            withAnimation(.easeOut(duration: 0.15)) { picked = chosen ? nil : date }
        }
        .accessibilityLabel("\(date.formatted(.dateTime.month().day()))\(look.map { ", \($0.name.lowercased()) plan" } ?? "")")
        .accessibilityAddTraits(here.isEmpty ? [] : .isButton)
        .accessibilityHint(here.isEmpty ? "" : "Shows this day's plans first")
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

/// one line of this person's schedule, as muse read it from their description or as they edited it
struct ScheduleRule: Codable, Hashable, Identifiable {
    var id: String
    var kind: String // free | ask | busy
    var days: [String] // mon, tue, ... empty = every day inside its dates
    var start: String? // "18:00". both nil = all day, or no hours given
    var end: String?
    var from: String? // "2026-11-21", the first day it holds
    var until: String? // the last day it holds
    var note: String?
}

private struct ScheduleResponse: Decodable { let rules: [ScheduleRule] }

private let dayOrder = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
private let dayNames = ["mon": "Mondays", "tue": "Tuesdays", "wed": "Wednesdays", "thu": "Thursdays", "fri": "Fridays", "sat": "Saturdays", "sun": "Sundays"]
private let askOrange = Color(hex: 0xde933d)

/// "18:00" -> "6:00 PM"
private func clock(_ t: String) -> String {
    let parts = t.split(separator: ":").compactMap { Int($0) }
    guard parts.count == 2 else { return t }
    let h = parts[0], m = parts[1]
    return "\((h + 11) % 12 + 1):\(String(format: "%02d", m)) \(h < 12 ? "AM" : "PM")"
}

private let isoDay: DateFormatter = {
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian)
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "yyyy-MM-dd"
    return f
}()

/// "2026-11-21" -> "Nov 21" (with the year when it isn't this one)
private func shortDate(_ iso: String) -> String {
    guard let d = isoDay.date(from: iso) else { return iso }
    let thisYear = Calendar.current.component(.year, from: d) == Calendar.current.component(.year, from: Date())
    return d.formatted(thisYear ? .dateTime.month(.abbreviated).day() : .dateTime.month(.abbreviated).day().year())
}

private extension ScheduleRule {
    var label: String { kind == "free" ? "USUALLY FREE" : kind == "ask" ? "ASK EACH TIME" : "UNAVAILABLE" }
    var ink: Color { kind == "free" ? FB.blue : kind == "ask" ? askOrange : FB.muted }

    /// "Tuesdays & Thursdays", "Some Saturdays", or the dates when it isn't a weekly pattern
    var title: String {
        let names = dayOrder.filter(days.contains).compactMap { dayNames[$0] }
        if names.isEmpty { return dates ?? "Any day" }
        let joined = names.count <= 2 ? names.joined(separator: " & ") : names.dropLast().joined(separator: ", ") + " & " + (names.last ?? "")
        return kind == "ask" ? "Some \(joined)" : joined
    }

    var hours: String? {
        if let start, let end { return "\(clock(start)) \u{2014} \(clock(end))" }
        return kind == "ask" ? nil : "All day"
    }

    /// "Nov 21 - Indefinite", "Now - Dec 31", "Nov 27–29"
    var dates: String? {
        switch (from, until) {
        case (nil, nil): return nil
        case let (f?, nil): return "\(shortDate(f)) - Indefinite"
        case let (nil, u?): return "Now - \(shortDate(u))"
        case let (f?, u?):
            if f == u { return shortDate(f) }
            // the same month reads as one stretch: "Nov 27–29"
            if f.prefix(7) == u.prefix(7), let d = isoDay.date(from: f), let last = Int(u.suffix(2)) {
                return "\(d.formatted(.dateTime.month(.abbreviated).day()))\u{2013}\(last)"
            }
            return "\(shortDate(f)) - \(shortDate(u))"
        }
    }

    /// the small last line: the dates for a weekly rule, muse's note for one with no hours
    var footnote: String? {
        if kind == "ask", hours == nil { return note ?? "No hours or pattern given. Check when a plan comes up." }
        if days.isEmpty { return note }
        return dates ?? "Every week"
    }
}

private struct RuleCard: View {
    let rule: ScheduleRule
    let edit: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(alignment: .top, spacing: 8) {
                Text(rule.label).font(UI.kicker).tracking(0.3).foregroundStyle(rule.ink)
                Spacer(minLength: 0)
                Button(action: edit) { Text("Edit").font(.system(size: 14, weight: .semibold)).foregroundStyle(FB.blue).padding(.leading, 12).padding(.bottom, 4).contentShape(Rectangle()) }
                    .accessibilityLabel("Edit \(rule.title)")
            }
            Text(rule.title).font(UI.cardTitle).foregroundStyle(FB.text).fixedSize(horizontal: false, vertical: true)
            if let hours = rule.hours { Text(hours).font(.system(size: 16, weight: .semibold)).foregroundStyle(FB.text) }
            if let foot = rule.footnote { Text(foot).font(UI.meta).foregroundStyle(FB.muted).fixedSize(horizontal: false, vertical: true) }
        }
        .frame(maxWidth: .infinity, alignment: .leading).padding(UI.cardPad)
        .background(rule.kind == "busy" ? Color(hex: 0xf5f6f8) : Color.white, in: RoundedRectangle(cornerRadius: UI.cardRadius))
        .overlay { if rule.kind != "busy" { RoundedRectangle(cornerRadius: UI.cardRadius).stroke(rule.ink, lineWidth: 1) } }
    }
}

// this person's schedule patterns: the rules muse starts from when it picks a day and time.
// they come from describing your schedule to muse. a rule is only ever typed in by hand
// through its own Edit.
struct AvailabilityScreen: View {
    @EnvironmentObject var app: AppState
    @State private var rules: [ScheduleRule] = []
    @State private var loading = true
    @State private var error: String?
    @State private var editing: ScheduleRule?

    var body: some View {
        SubScreen(title: "Availability", trailing: [("calendar", "Calendar", { app.back() })]) {
            VStack(spacing: 0) {
                ScrollView {
                    VStack(alignment: .leading, spacing: UI.gap) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Schedule patterns").font(UI.title).foregroundStyle(FB.text)
                            Text("Rules that muse will consider when it puts a plan together.").font(UI.meta).foregroundStyle(FB.muted)
                        }
                        if loading, rules.isEmpty { EmptyNote("One sec") }
                        if !loading, rules.isEmpty, error == nil { EmptyNote("No schedule yet. Describe when you're free and muse turns it into a few rules.") }
                        if let error { Text(sentenceCase(error)).font(.system(size: 14)).foregroundStyle(FB.red) }
                        ForEach(rules) { r in RuleCard(rule: r) { editing = r } }
                        if !rules.isEmpty {
                            Text("Friends see the plan, never your schedule or your reasons. Changing a rule doesn't move a confirmed plan.").font(UI.meta).foregroundStyle(FB.muted).fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .padding(.horizontal, UI.margin).padding(.top, 12).padding(.bottom, 24)
                }
                GradientButton(label: "Describe availability to Muse", big: true) { app.push(.describeAvailability) }
                    .padding(UI.margin)
                    .background(Color.white)
                    .accessibilityIdentifier("describe-availability")
            }
        }
        // also when coming back from describing: the rules muse just read are there
        .onAppear { Task { await load() } }
        .onChange(of: "\(app.userId)-\(app.version)") { Task { await load() } }
        .sheet(item: $editing) { r in
            RuleEditor(rule: r) { changed in await save(replacing: r.id, with: changed) }
                .presentationDetents([.large])
        }
    }

    private func load() async {
        let user = app.userId
        do {
            let r: ScheduleResponse = try await API.get("/api/user/availability", user: user)
            guard user == app.userId else { return }
            rules = r.rules
            error = nil
        } catch let e {
            guard user == app.userId else { return }
            error = errorText(e)
        }
        loading = false
    }

    /// save one rule's edit (or, with nil, its removal). returns what went wrong, if anything.
    private func save(replacing id: String, with changed: ScheduleRule?) async -> String? {
        let next = rules.compactMap { $0.id == id ? changed : $0 }
        do {
            let body = try JSONSerialization.jsonObject(with: JSONEncoder().encode(["rules": next])) as? [String: Any] ?? [:]
            let data = try await API.data("PUT", "/api/user/availability", user: app.userId, body: body)
            rules = try API.decoder.decode(ScheduleResponse.self, from: data).rules
            toast(changed == nil ? "Rule removed." : "Rule saved.")
            return nil
        } catch let e { return errorText(e) }
    }
}

/// the one place a rule is entered by hand: Edit on its card
private struct RuleEditor: View {
    @Environment(\.dismiss) private var dismiss
    let original: ScheduleRule
    let save: (ScheduleRule?) async -> String?
    @State private var kind: String
    @State private var days: Set<String>
    @State private var allDay: Bool
    @State private var start: Date
    @State private var end: Date
    @State private var hasFrom: Bool
    @State private var from: Date
    @State private var hasUntil: Bool
    @State private var until: Date
    @State private var busy = false
    @State private var error: String?
    @State private var confirmRemove = false

    private static func time(_ t: String?, fallback: Int) -> Date {
        let parts = (t ?? "").split(separator: ":").compactMap { Int($0) }
        return Calendar.current.date(bySettingHour: parts.count == 2 ? parts[0] : fallback, minute: parts.count == 2 ? parts[1] : 0, second: 0, of: Date()) ?? Date()
    }

    private static func hhmm(_ d: Date) -> String {
        let c = Calendar.current.dateComponents([.hour, .minute], from: d)
        return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
    }

    init(rule: ScheduleRule, save: @escaping (ScheduleRule?) async -> String?) {
        original = rule
        self.save = save
        _kind = State(initialValue: rule.kind)
        _days = State(initialValue: Set(rule.days))
        _allDay = State(initialValue: rule.start == nil || rule.end == nil)
        _start = State(initialValue: Self.time(rule.start, fallback: 18))
        _end = State(initialValue: Self.time(rule.end, fallback: 22))
        _hasFrom = State(initialValue: rule.from != nil)
        _from = State(initialValue: rule.from.flatMap { isoDay.date(from: $0) } ?? Date())
        _hasUntil = State(initialValue: rule.until != nil)
        _until = State(initialValue: rule.until.flatMap { isoDay.date(from: $0) } ?? Date())
    }

    private var edited: ScheduleRule {
        var r = original
        r.kind = kind
        r.days = dayOrder.filter(days.contains)
        r.start = allDay ? nil : Self.hhmm(start)
        r.end = allDay ? nil : Self.hhmm(end)
        r.from = hasFrom ? isoDay.string(from: from) : nil
        r.until = hasUntil ? isoDay.string(from: until) : nil
        // muse's note described the rule as it was. once the hours are set by hand it no longer fits.
        if !allDay { r.note = nil }
        return r
    }

    private var problem: String? {
        let r = edited
        if let s = r.start, let e = r.end, s >= e { return "The end has to be after the start." }
        if let f = r.from, let u = r.until, f > u { return "The last day has to be after the first." }
        if r.days.isEmpty, r.from == nil, r.until == nil { return "Pick a day of the week, or set a date." }
        return nil
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button("Cancel") { dismiss() }.font(.system(size: 16)).foregroundStyle(FB.blue)
                Spacer()
                Text("Edit rule").font(.system(size: 17, weight: .semibold)).foregroundStyle(FB.text)
                Spacer()
                Button("Cancel") {}.font(.system(size: 16)).hidden()
            }
            .padding(.horizontal, UI.margin).frame(height: 52)
            Hairline()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    field("This time is") {
                        HStack(spacing: 8) {
                            ForEach([("free", "Usually free"), ("ask", "Ask each time"), ("busy", "Unavailable")], id: \.0) { k in
                                chip(k.1, on: kind == k.0) { kind = k.0 }
                            }
                        }
                    }
                    field("Repeats on") {
                        HStack(spacing: 6) {
                            ForEach(dayOrder, id: \.self) { d in
                                chip(String((dayNames[d] ?? d).prefix(3)), on: days.contains(d)) { if !days.insert(d).inserted { days.remove(d) } }
                            }
                        }
                        Text("Leave these off for a stretch of dates, like a trip.").font(UI.meta).foregroundStyle(FB.muted)
                    }
                    field("Hours") {
                        Toggle(kind == "ask" ? "No set hours" : "All day", isOn: $allDay).font(UI.body).tint(FB.blue)
                        if !allDay {
                            DatePicker("From", selection: $start, displayedComponents: .hourAndMinute).font(UI.body)
                            DatePicker("Until", selection: $end, displayedComponents: .hourAndMinute).font(UI.body)
                        }
                    }
                    field("Dates") {
                        Toggle("Starts on a date", isOn: $hasFrom).font(UI.body).tint(FB.blue)
                        if hasFrom { DatePicker("First day", selection: $from, displayedComponents: .date).font(UI.body) }
                        Toggle("Ends on a date", isOn: $hasUntil).font(UI.body).tint(FB.blue)
                        if hasUntil { DatePicker("Last day", selection: $until, displayedComponents: .date).font(UI.body) }
                    }
                    if let shown = error ?? problem { Text(sentenceCase(shown)).font(.system(size: 14)).foregroundStyle(FB.red).fixedSize(horizontal: false, vertical: true) }
                    GradientButton(label: "Save rule", big: true, busy: busy, disabled: problem != nil || edited == original) { commit(edited) }
                    Button { confirmRemove = true } label: {
                        Text("Remove rule").font(.system(size: 15, weight: .semibold)).foregroundStyle(FB.red).frame(maxWidth: .infinity).frame(height: UI.button)
                    }
                    .disabled(busy)
                }
                .padding(UI.margin)
            }
        }
        .background(Color.white)
        .confirmationDialog("Remove this rule?", isPresented: $confirmRemove, titleVisibility: .visible) {
            Button("Remove rule", role: .destructive) { commit(nil) }
        } message: {
            Text("Muse stops planning around it. Plans already confirmed don't move.")
        }
    }

    private func commit(_ rule: ScheduleRule?) {
        busy = true
        error = nil
        Task {
            if let failed = await save(rule) { error = failed } else { dismiss() }
            busy = false
        }
    }

    private func field(_ label: String, @ViewBuilder _ content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(label.uppercased()).font(UI.kicker).tracking(0.3).foregroundStyle(FB.muted)
            content()
        }
    }

    private func chip(_ label: String, on: Bool, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(on ? FB.blue : FB.muted).lineLimit(1).minimumScaleFactor(0.8)
                .frame(maxWidth: .infinity).frame(height: 36)
                .background(on ? FB.blueSoft : FB.button, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(on ? FB.blue.opacity(0.5) : .clear, lineWidth: 1))
        }
        .buttonStyle(FadePress())
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

// "describe when you're free": say it in your own words, however complicated, and muse
// reads it into rules. nothing is saved until Submit description is tapped.
struct DescribeAvailabilityScreen: View {
    @EnvironmentObject var app: AppState
    @State private var text = ""
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focused: Bool
    private let example = "After Nov 20, I\u{2019}ll be usually free Tuesdays and Thursdays, 6\u{2013}10 PM. Some Saturdays work, but not every week. I\u{2019}m also away Nov 27\u{2013}29."

    private var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        SubScreen(title: "Availability") {
            ScrollView {
                VStack(alignment: .leading, spacing: UI.gap) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Describe when you\u{2019}re free").font(UI.title).foregroundStyle(FB.text)
                        Text("Give Muse any routines, unsure days, exceptions, anything - no matter how complicated.").font(.system(size: 14)).lineSpacing(3).foregroundStyle(FB.muted).fixedSize(horizontal: false, vertical: true)
                    }
                    TextField(example, text: $text, axis: .vertical)
                        .font(.system(size: 15)).lineSpacing(3).foregroundStyle(FB.text).lineLimit(5...12)
                        .disabled(busy).focused($focused)
                        .onChange(of: text) { if text.count > 1000 { text = String(text.prefix(1000)) } }
                        .padding(12)
                        .background(Color.white, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(focused ? FB.blue.opacity(0.5) : FB.button, lineWidth: 1))
                        .accessibilityIdentifier("availability-text")
                    GradientButton(label: busy ? "Muse is reading" : "Submit description", big: true, busy: busy, disabled: trimmed.isEmpty) { submit() }
                    if let error { Text(sentenceCase(error)).font(.system(size: 14)).foregroundStyle(FB.red).fixedSize(horizontal: false, vertical: true) }
                    HStack(alignment: .center, spacing: 10) {
                        MuseFace(expression: .awake, size: 22)
                        Text("Muse will learn and analyze schedule patterns based on your description. It adds to the rules you already have, and stays private to you.").font(.system(size: 13).italic()).foregroundStyle(FB.muted).fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(.horizontal, UI.margin).padding(.top, 12).padding(.bottom, 40)
            }
        }
        .onAppear { focused = true }
    }

    private func submit() {
        busy = true
        error = nil
        focused = false
        let user = app.userId
        Task {
            do {
                try await API.data("POST", "/api/user/availability/describe", user: user, body: ["text": trimmed])
                toast("Muse updated your schedule patterns.")
                app.back()
            } catch let e { error = errorText(e) }
            busy = false
        }
    }
}
