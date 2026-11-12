import AVFoundation
import SwiftUI
import UserNotifications

extension Notification.Name {
    static let openLink = Notification.Name("musing.openLink")
}

// real ios notifications: lock screen, home screen, or over another app.
//
// this prototype has no push server (push needs a paid apple developer account). instead
// the app stays awake in the background by playing silence, keeps its realtime socket to
// the laptop open, and posts a local notification when something new arrives for the
// person this phone is. it works while the app is in the background or the phone is
// locked. it stops if the app is swiped away in the app switcher.
@MainActor
final class Notifier: NSObject, UNUserNotificationCenterDelegate {
    static let shared = Notifier()

    private var user: String?
    /// everything already known to this person, so only new things notify
    private var seen: Set<String> = []
    private var ready = false
    private var pending: Task<Void, Never>?
    private var observers: [NSObjectProtocol] = []
    private var silence: AVAudioPlayer?
    private var pendingLink: URL?

    func takePendingLink() -> URL? {
        defer { pendingLink = nil }
        return pendingLink
    }

    /// start (or restart, on an account switch) watching for this person.
    func watch(user: String) async {
        if observers.isEmpty { setUp() }
        self.user = user
        ready = false
        seen = []
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
        keepAwake()
        // whatever exists right now is the baseline. nothing old notifies.
        let first = await current(for: user)
        guard self.user == user else { return }
        if let first { seen = Set(first.map(\.id)); ready = true }
    }

    private func setUp() {
        UNUserNotificationCenter.current().delegate = self
        let nc = NotificationCenter.default
        observers.append(nc.addObserver(forName: .tableChanged, object: nil, queue: .main) { [weak self] note in
            guard let table = note.object as? String, table == "plans" || table == "thread_pings" else { return }
            Task { @MainActor in self?.changed() }
        })
        observers.append(nc.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.keepAwake() }
        })
        observers.append(nc.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { _ in
            UNUserNotificationCenter.current().setBadgeCount(0)
            UNUserNotificationCenter.current().removeAllDeliveredNotifications()
        })
        observers.append(nc.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            // a call or siri stops the silence. start it again when they end.
            let ended = (note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt) == AVAudioSession.InterruptionType.ended.rawValue
            if ended { Task { @MainActor in self?.keepAwake() } }
        })
    }

    // several rows change in a burst when a plan moves. wait for it to settle, then look once.
    private func changed() {
        pending?.cancel()
        pending = Task {
            try? await Task.sleep(for: .milliseconds(700))
            guard !Task.isCancelled, let user else { return }
            guard let items = await current(for: user), self.user == user else { return }
            guard ready else { seen = Set(items.map(\.id)); ready = true; return }
            let fresh = items.filter { !seen.contains($0.id) }
            seen.formUnion(items.map(\.id))
            // with the app open, the screens already update live
            guard UIApplication.shared.applicationState != .active else { return }
            for (i, item) in fresh.enumerated() { post(item, badge: i + 1) }
        }
    }

    private struct Item {
        let id: String
        let title: String
        let body: String
        let link: String
    }

    /// what this person could be told about right now. the api server decides what they may see.
    private func current(for user: String) async -> [Item]? {
        async let homeTask: MusingHome? = try? API.get("/api/musing/home", user: user)
        async let threadsTask: ThreadList? = try? API.get("/api/threads", user: user)
        let (home, threads) = await (homeTask, threadsTask)
        if home == nil && threads == nil { return nil }
        var items: [Item] = []
        // the same rows the notifications tab shows, so the two never disagree
        for row in musingRows(home, me: user) where !row.id.hasSuffix("-draft") {
            guard case .plan(let planId)? = row.go else { continue }
            items.append(Item(id: row.id, title: "musing.", body: row.parts.map(\.t).joined(), link: "musing://plan/\(planId)"))
        }
        for t in threads?.threads ?? [] {
            guard let last = t.last, last.senderId != user, !last.pending else { continue }
            let text = (last.body ?? "sent a plan").trimmingCharacters(in: .whitespacesAndNewlines)
            items.append(Item(id: "msg-\(last.id)", title: t.title, body: last.senderId == nil ? "muse: \(text)" : text, link: "musing://messages/\(t.id)"))
        }
        return items
    }

    private func post(_ item: Item, badge: Int) {
        let content = UNMutableNotificationContent()
        content.title = item.title
        content.body = item.body
        content.sound = .default
        content.badge = NSNumber(value: badge)
        content.userInfo = ["link": item.link]
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: item.id, content: content, trigger: nil))
    }

    // ---- staying awake ----

    /// loops one second of silence. it mixes with other audio, so music keeps playing.
    private func keepAwake() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, options: [.mixWithOthers])
        try? session.setActive(true)
        if silence == nil {
            silence = try? AVAudioPlayer(data: Self.silentWav())
            silence?.numberOfLoops = -1
            silence?.volume = 0
        }
        if silence?.isPlaying != true { silence?.play() }
    }

    private static func silentWav() -> Data {
        let rate: UInt32 = 8000, samples: UInt32 = 8000
        var d = Data()
        func u32(_ v: UInt32) { withUnsafeBytes(of: v.littleEndian) { d.append(contentsOf: $0) } }
        func u16(_ v: UInt16) { withUnsafeBytes(of: v.littleEndian) { d.append(contentsOf: $0) } }
        d.append(contentsOf: Array("RIFF".utf8)); u32(36 + samples * 2); d.append(contentsOf: Array("WAVEfmt ".utf8))
        u32(16); u16(1); u16(1); u32(rate); u32(rate * 2); u16(2); u16(16)
        d.append(contentsOf: Array("data".utf8)); u32(samples * 2)
        d.append(Data(count: Int(samples * 2)))
        return d
    }

    // ---- delegate ----

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        guard let link = response.notification.request.content.userInfo["link"] as? String, let url = URL(string: link) else { return }
        await MainActor.run {
            pendingLink = url
            NotificationCenter.default.post(name: .openLink, object: nil)
        }
    }
}
