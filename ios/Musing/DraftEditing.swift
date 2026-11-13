import SwiftUI

// a draft is the starter's to change before anything goes out: take someone off, add a
// friend muse did not pick, or tell muse in plain words what to change and let it redo
// the plan. nobody is asked, told or notified by anything on this card.
struct DraftEditor: View {
    @EnvironmentObject var app: AppState
    let plan: PlanView
    /// the same draft with a different set of people
    let onChanged: (PlanView) -> Void
    /// muse redid the plan: the old draft is gone and this is the new one
    let onReplaced: (String) -> Void

    /// the friends this signal reaches who aren't on the draft yet, from the server
    @State private var people: [AddablePerson]?
    @State private var search = ""
    @State private var loadError: String?
    @State private var adding = true
    @State private var busy: String?
    @State private var error: String?
    @State private var ask = ""
    @State private var redoing = false
    @State private var museLine = ""
    @FocusState private var focused: Bool

    private var picks: [PlanView.Pick] { plan.picks ?? [] }
    private var skipped: [PlanView.Pick] { plan.skipped ?? [] }
    /// the server searches (any part of a name, or an interest). muse's own picks that were left off are listed above.
    private var addable: [AddablePerson] {
        let off = Set(skipped.map(\.user.id))
        return (people ?? []).filter { !off.contains($0.id) }
    }
    private var trimmed: String { ask.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        VStack(alignment: .leading, spacing: UI.gap) {
            SectionTitle("Who gets asked").padding(.top, 8)
            ForEach(picks, id: \.user.id) { pick in
                Card {
                    HStack(spacing: 12) {
                        Avatar(pick.user, size: 44)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(pick.user.name).font(.system(size: 16, weight: .semibold)).foregroundStyle(FB.text)
                            if let reason = pick.reason { Text("\u{201C}\(reason)\u{201D}").font(.system(size: 14)).foregroundStyle(FB.muted).fixedSize(horizontal: false, vertical: true) }
                        }
                        Spacer(minLength: 0)
                        if picks.count > 1 {
                            Button { change(["remove": pick.user.id], name: pick.user.id) } label: {
                                Image(systemName: "xmark").font(.system(size: 12, weight: .bold)).foregroundStyle(FB.muted)
                                    .frame(width: 30, height: 30).background(FB.input, in: Circle())
                            }
                            .buttonStyle(FadePress()).disabled(busy != nil || redoing)
                            .accessibilityLabel("Take \(firstName(pick.user.name)) off")
                        }
                    }
                }
                .opacity(busy == pick.user.id ? 0.5 : 1)
            }
            // muse's picks the starter left off: one tap asks them after all, with muse's own ask
            ForEach(skipped, id: \.user.id) { pick in
                Card {
                    HStack(spacing: 12) {
                        Avatar(pick.user, size: 44).opacity(0.5)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(pick.user.name).font(.system(size: 16, weight: .semibold)).foregroundStyle(FB.muted)
                            Text("Not asking").font(.system(size: 14)).foregroundStyle(FB.muted)
                        }
                        Spacer(minLength: 0)
                        Button { change(["add": pick.user.id], name: pick.user.id) } label: {
                            Text("Ask").font(.system(size: 14, weight: .bold)).foregroundStyle(FB.blue)
                                .padding(.horizontal, 12).frame(height: 30).background(FB.blueSoft, in: Capsule())
                        }
                        .buttonStyle(FadePress()).disabled(busy != nil || redoing)
                        .accessibilityLabel("Ask \(firstName(pick.user.name)) after all")
                    }
                }
                .opacity(busy == pick.user.id ? 0.5 : 1)
            }

            if adding {
                Card {
                    VStack(alignment: .leading, spacing: 0) {
                        // a scrollable row of friends to tap, then the search for anyone further down the list
                        if !addable.isEmpty {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 14) {
                                    ForEach(addable) { friend in
                                        Button { change(["add": friend.id], name: friend.id) } label: {
                                            VStack(spacing: 4) {
                                                Avatar(friend.person, size: 52).overlay(alignment: .bottomTrailing) {
                                                    Image(systemName: "plus.circle.fill").font(.system(size: 18)).foregroundStyle(Muse.start).background(Circle().fill(Color.white))
                                                }
                                                Text(firstName(friend.name)).font(.system(size: 12, weight: .semibold)).foregroundStyle(FB.text).lineLimit(1)
                                            }
                                            .frame(width: 64)
                                        }
                                        .buttonStyle(FadePress()).disabled(busy != nil || redoing)
                                        .accessibilityLabel("Add \(friend.name)")
                                    }
                                }
                            }
                            .padding(.bottom, 10)
                        }
                        TextField("Search your friends", text: $search)
                            .font(.system(size: 15)).textInputAutocapitalization(.never).autocorrectionDisabled()
                            .padding(.horizontal, 12).frame(height: 38).background(FB.input, in: RoundedRectangle(cornerRadius: 8))
                            .padding(.bottom, 6)
                            .accessibilityIdentifier("draft-friend-search")
                        if addable.isEmpty {
                            Text(loadError ?? (people == nil ? "Loading your friends" : search.isEmpty ? "Everyone this signal reaches is already here." : "No friend matches that.")).font(.system(size: 14)).foregroundStyle(loadError == nil ? FB.muted : FB.red)
                        }
                        ForEach(search.isEmpty ? [] : addable) { friend in
                            Button { change(["add": friend.id], name: friend.id) } label: {
                                HStack(spacing: 10) {
                                    Avatar(friend.person, size: 34)
                                    VStack(alignment: .leading, spacing: 1) {
                                        Text(friend.name).font(.system(size: 15, weight: .semibold)).foregroundStyle(FB.text)
                                        if !friend.interests.isEmpty { Text(friend.interests.prefix(3).joined(separator: ", ")).font(.system(size: 13)).foregroundStyle(FB.muted).lineLimit(1) }
                                    }
                                    Spacer(minLength: 0)
                                    Image(systemName: "plus.circle.fill").font(.system(size: 20)).foregroundStyle(Muse.start)
                                }
                                .padding(.vertical, 6)
                            }
                            .buttonStyle(FadePress()).disabled(busy != nil || redoing)
                            .accessibilityLabel("Add \(friend.name)")
                        }
                    }
                }
            }
            QuietButton(label: adding ? "Done adding" : "Add a friend", fill: true) { withAnimation(.easeOut(duration: 0.15)) { adding.toggle() } }
            Text("Muse suggested these people. Take anyone off, ask them again, or add your own friends from the people this signal reaches. Each one gets a private ask, and none of them sees who else was asked.")
                .font(UI.meta).foregroundStyle(FB.muted).fixedSize(horizontal: false, vertical: true)

            if plan.museOn {
                SectionTitle("Change the plan").padding(.top, 8)
                TextField("Tell muse what to change, like \u{201C}make it sunday\u{201D} or \u{201C}somewhere cheaper\u{201D}", text: $ask, axis: .vertical)
                    .font(.system(size: 16)).foregroundStyle(FB.text).lineLimit(2...4)
                    .textInputAutocapitalization(.never).disabled(redoing).focused($focused)
                    .onChange(of: ask) { if ask.count > 200 { ask = String(ask.prefix(200)) } }
                    .padding(UI.cardPad)
                    .background(Color.white, in: RoundedRectangle(cornerRadius: UI.cardRadius))
                    .overlay(RoundedRectangle(cornerRadius: UI.cardRadius).stroke(focused ? FB.blue.opacity(0.5) : FB.button, lineWidth: 1))
                    .accessibilityIdentifier("draft-change-text")
                if redoing, !museLine.isEmpty {
                    Text(museLine).font(.system(size: 15)).foregroundStyle(Muse.text).fixedSize(horizontal: false, vertical: true)
                }
                QuietButton(label: redoing ? "Muse is redoing it" : "Ask muse to redo it", disabled: trimmed.count < 2 || redoing || busy != nil, fill: true) { redo() }
            }
            if let error { Text(sentenceCase(error)).font(.system(size: 14)).foregroundStyle(FB.red) }
        }
        // refetched as the search changes and whenever who is asked changes, so the list never offers
        // someone already on it. a failure is shown, never mistaken for "no friends match".
        .task(id: "\(app.userId):\(search):\(picks.map(\.user.id).joined(separator: ","))") {
            if !search.isEmpty { try? await Task.sleep(for: .milliseconds(250)) }
            guard !Task.isCancelled else { return }
            let q = search.trimmingCharacters(in: .whitespaces).addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
            do {
                let list: AddableList = try await API.get("/api/plans/\(plan.id)/picks?q=\(q)", user: app.userId)
                guard !Task.isCancelled else { return }
                people = list.people
                loadError = nil
            } catch let e {
                guard !Task.isCancelled else { return }
                loadError = "Couldn't load your friends (\(errorText(e)))."
            }
        }
    }

    private func change(_ body: [String: Any], name: String) {
        busy = name
        error = nil
        Task {
            do {
                let p: PlanView = try await API.post("/api/plans/\(plan.id)/picks", user: app.userId, body: body)
                onChanged(p)
            } catch let e {
                error = errorText(e)
            }
            busy = nil
        }
    }

    // muse redoes the draft with the change in mind. the old draft is replaced by the new one.
    private func redo() {
        focused = false
        redoing = true
        error = nil
        museLine = ""
        Task {
            do {
                var newId: String?
                var streamError: String?
                try await API.stream("/api/muse/match", user: app.userId, body: ["planId": plan.id, "revise": trimmed]) { event, data in
                    switch event {
                    case "delta": museLine += data["text"] as? String ?? ""
                    case "restart": museLine = ""
                    case "done": newId = data["planId"] as? String
                    case "error": streamError = data["message"] as? String ?? "muse had trouble"
                    default: break
                    }
                }
                if let streamError { throw ApiError(message: streamError) }
                guard let newId else { throw ApiError(message: "muse didn't finish the plan") }
                redoing = false
                onReplaced(newId)
            } catch let e {
                error = errorText(e)
                redoing = false
            }
        }
    }
}
