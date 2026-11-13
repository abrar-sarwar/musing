import PhotosUI
import SwiftUI
import UIKit

private let feedbackTags: [(id: String, label: String)] = [
    ("great_activity", "Great activity"), ("great_crew", "Great crew"), ("great_place", "Great place"),
    ("good_timing", "Good timing"), ("good_value", "Good value"), ("do_again", "Do again"),
    ("not_my_vibe", "Not my vibe"), ("wrong_crew", "Wrong crew"), ("too_far", "Too far"),
    ("wrong_timing", "Wrong timing"), ("too_expensive", "Too expensive"), ("not_again", "Not again"),
]

struct FeedbackBanner: View {
    @EnvironmentObject var app: AppState
    let eventId: String
    let state: FeedbackState
    var onChanged: (() -> Void)?
    @State private var ratingOpen = false

    var body: some View {
        if state.eligible {
            Button {
                if let id = state.memoryId { app.push(.memory(id)) } else { ratingOpen = true }
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: state.memoryId == nil ? "star.bubble" : "photo.on.rectangle.angled").font(.system(size: 20)).foregroundStyle(Muse.text)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(state.memoryId == nil ? "How was it?" : stars(state.rating ?? 0)).font(.system(size: 16, weight: .bold)).foregroundStyle(FB.text)
                        Text(state.memoryId == nil ? "Your rating and note stay private." : "View memory").font(.system(size: 13.5)).foregroundStyle(FB.muted)
                    }
                    Spacer()
                    Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(FB.muted)
                }
                .padding(14).background(Muse.soft, in: RoundedRectangle(cornerRadius: UI.cardRadius))
            }
            .buttonStyle(FadePress())
            .sheet(isPresented: $ratingOpen) {
                RatingSheet(eventId: eventId) {
                    ratingOpen = false
                    onChanged?()
                }
                .environmentObject(app)
            }
        }
    }
}

private func stars(_ count: Int) -> String { String(repeating: "★", count: max(0, min(5, count))) }

private struct PendingMemoryPhoto: Identifiable {
    let id = UUID()
    let data: Data
    let width: Int
    let height: Int
    var state = "ready"
    var message: String?
    var serverId: String?
}

struct RatingSheet: View {
    @EnvironmentObject var app: AppState
    @Environment(\.dismiss) private var dismiss
    let eventId: String
    var existing: HangoutMemory?
    let onSaved: () -> Void
    @State private var rating: Int
    @State private var tags: Set<String>
    @State private var note: String
    @State private var picker: [PhotosPickerItem] = []
    @State private var pending: [PendingMemoryPhoto] = []
    @State private var uploaded: [MemoryPhoto]
    @State private var activeMemoryId: String?
    @State private var busy = false
    @State private var error: String?

    init(eventId: String, existing: HangoutMemory? = nil, onSaved: @escaping () -> Void) {
        self.eventId = eventId
        self.existing = existing
        self.onSaved = onSaved
        _rating = State(initialValue: existing?.rating ?? 0)
        _tags = State(initialValue: Set(existing?.tags ?? []))
        _note = State(initialValue: existing?.privateNote ?? "")
        _uploaded = State(initialValue: existing?.photos ?? [])
        _activeMemoryId = State(initialValue: existing?.id)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("How was it?").font(.system(size: 24, weight: .bold)).foregroundStyle(FB.text)
                        Text("Only you can see this. It is never shared with friends or Facebook.").font(.system(size: 14)).foregroundStyle(FB.muted)
                        HStack(spacing: 12) {
                            ForEach(1...5, id: \.self) { n in
                                Button { rating = n } label: {
                                    Image(systemName: n <= rating ? "star.fill" : "star").font(.system(size: 31)).foregroundStyle(n <= rating ? Color.yellow : FB.muted)
                                }.buttonStyle(FadePress()).accessibilityLabel("\(n) stars")
                            }
                        }
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        Text("What stood out? · up to 4").font(.system(size: 17, weight: .bold)).foregroundStyle(FB.text)
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 7) {
                            ForEach(feedbackTags, id: \.id) { tag in
                                Button { toggle(tag.id) } label: {
                                    Text(tag.label).font(.system(size: 14, weight: .semibold)).foregroundStyle(tags.contains(tag.id) ? FB.blue : FB.text)
                                        .padding(.horizontal, 12).frame(height: 34).background(tags.contains(tag.id) ? FB.blueSoft : FB.input, in: Capsule())
                                }.buttonStyle(FadePress())
                            }
                        }
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Private note · optional").font(.system(size: 17, weight: .bold)).foregroundStyle(FB.text)
                        TextField("What do you want to remember?", text: $note, axis: .vertical).lineLimit(3...7)
                            .padding(12).background(FB.input, in: RoundedRectangle(cornerRadius: 10))
                            .onChange(of: note) { if note.count > 500 { note = String(note.prefix(500)) } }
                        Text("\(note.count)/500").font(.system(size: 12)).foregroundStyle(FB.muted).frame(maxWidth: .infinity, alignment: .trailing)
                    }
                    photos
                    if let error { Text(error).font(.system(size: 14)).foregroundStyle(FB.red) }
                    Button { save() } label: {
                        Text(busy ? "Saving…" : "Save private memory").font(.system(size: 16, weight: .bold)).foregroundStyle(.white)
                            .frame(maxWidth: .infinity).frame(height: 48).background(rating == 0 ? FB.muted : FB.blue, in: RoundedRectangle(cornerRadius: 10))
                    }.buttonStyle(FadePress()).disabled(rating == 0 || busy)
                    Text("Your rating can change future seeded recommendations. It never changes friend matching, and Muse never reads your note.")
                        .font(.system(size: 12.5)).foregroundStyle(FB.muted)
                }
                .padding(16).padding(.bottom, 24)
            }
            .navigationTitle(existing == nil ? "Rate hangout" : "Edit memory")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
        }
        .onChange(of: picker) { loadPicked() }
    }

    @ViewBuilder private var photos: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Photos · up to 5").font(.system(size: 17, weight: .bold)).foregroundStyle(FB.text)
            Text("Photos are private. Musing removes metadata and limits the long edge to 2048 pixels before upload.").font(.system(size: 13)).foregroundStyle(FB.muted)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(uploaded) { photo in
                        ZStack(alignment: .topTrailing) {
                            AsyncImage(url: photo.url.flatMap(URL.init(string:))) { image in image.resizable().scaledToFill() } placeholder: { FB.input }
                                .frame(width: 92, height: 92).clipShape(RoundedRectangle(cornerRadius: 9))
                            Button { remove(photo) } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.white).shadow(radius: 2).padding(4) }
                        }
                    }
                    ForEach(pending) { photo in
                        ZStack {
                            if let image = UIImage(data: photo.data) { Image(uiImage: image).resizable().scaledToFill() }
                            if photo.state == "uploading" { ProgressView().tint(.white) }
                            if photo.state == "failed" {
                                Button { retry(photo.id) } label: { VStack { Image(systemName: "arrow.clockwise"); Text("Retry").font(.caption) }.foregroundStyle(.white) }
                            }
                        }
                        .frame(width: 92, height: 92).background(FB.input).clipShape(RoundedRectangle(cornerRadius: 9))
                    }
                    if uploaded.count + pending.count < 5 {
                        PhotosPicker(selection: $picker, maxSelectionCount: 5 - uploaded.count - pending.count, matching: .images) {
                            VStack(spacing: 5) { Image(systemName: "plus"); Text("Add").font(.system(size: 13, weight: .semibold)) }
                                .foregroundStyle(FB.blue).frame(width: 92, height: 92).background(FB.blueSoft, in: RoundedRectangle(cornerRadius: 9))
                        }
                    }
                }
            }
        }
    }

    private func toggle(_ id: String) {
        if tags.contains(id) { tags.remove(id) }
        else if tags.count < 4 { tags.insert(id) }
        else { toast("Choose up to four tags.") }
    }

    private func loadPicked() {
        let items = picker
        picker = []
        Task {
            for item in items {
                guard let raw = try? await item.loadTransferable(type: Data.self), let normalized = normalizeJPEG(raw) else {
                    error = "One photo could not be prepared."
                    continue
                }
                if pending.count + uploaded.count < 5 { pending.append(PendingMemoryPhoto(data: normalized.data, width: normalized.width, height: normalized.height)) }
            }
        }
    }

    private func save() {
        busy = true; error = nil
        Task {
            do {
                let saved: MemoryResponse = try await API.put("/api/events/\(eventId)/feedback", user: app.userId, body: ["rating": rating, "tags": Array(tags).sorted(), "note": note])
                activeMemoryId = saved.memory.id
                uploaded = saved.memory.photos
                for id in pending.map(\.id) { await upload(id, memoryId: saved.memory.id) }
                if !pending.contains(where: { $0.state == "failed" }) { onSaved() }
            } catch let e { error = errorText(e) }
            busy = false
        }
    }

    private func upload(_ id: UUID, memoryId: String) async {
        guard let i = pending.firstIndex(where: { $0.id == id }) else { return }
        pending[i].state = "uploading"
        let photo = pending[i]
        do {
            let reserve: PhotoReservation
            if let serverId = photo.serverId {
                reserve = try await API.post("/api/memories/\(memoryId)/photos/\(serverId)/retry", user: app.userId)
            } else {
                reserve = try await API.post("/api/memories/\(memoryId)/photos", user: app.userId, body: ["mimeType": "image/jpeg", "byteSize": photo.data.count, "width": photo.width, "height": photo.height])
                if let at = pending.firstIndex(where: { $0.id == id }) { pending[at].serverId = reserve.photoId }
            }
            try await API.uploadJPEG(photo.data, to: reserve.uploadUrl)
            let result: MemoryResponse = try await API.post("/api/memories/\(memoryId)/photos/\(reserve.photoId)/finalize", user: app.userId)
            uploaded = result.memory.photos
            pending.removeAll { $0.id == id }
        } catch let e {
            if let at = pending.firstIndex(where: { $0.id == id }) { pending[at].state = "failed"; pending[at].message = errorText(e) }
            error = "Your memory was saved, but a photo failed. Tap Retry."
        }
    }

    private func retry(_ id: UUID) {
        guard let memoryId = activeMemoryId else {
            error = "Save the memory again to retry this photo."
            return
        }
        Task { await upload(id, memoryId: memoryId) }
    }

    private func remove(_ photo: MemoryPhoto) {
        guard let memoryId = activeMemoryId else { return }
        Task {
            do {
                try await API.data("DELETE", "/api/memories/\(memoryId)/photos/\(photo.id)", user: app.userId)
                uploaded.removeAll { $0.id == photo.id }
            } catch let e { error = errorText(e) }
        }
    }
}

private func normalizeJPEG(_ raw: Data) -> (data: Data, width: Int, height: Int)? {
    guard let image = UIImage(data: raw) else { return nil }
    let long = max(image.size.width, image.size.height)
    let scale = min(1, 2048 / max(1, long))
    let size = CGSize(width: max(1, floor(image.size.width * scale)), height: max(1, floor(image.size.height * scale)))
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    format.opaque = true
    let rendered = UIGraphicsImageRenderer(size: size, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
    var quality: CGFloat = 0.86
    var data = rendered.jpegData(compressionQuality: quality)
    while (data?.count ?? 0) > 6 * 1024 * 1024 && quality > 0.35 { quality -= 0.1; data = rendered.jpegData(compressionQuality: quality) }
    guard let data, data.count <= 6 * 1024 * 1024 else { return nil }
    return (data, Int(size.width), Int(size.height))
}

struct MemoriesArchive: View {
    @EnvironmentObject var app: AppState
    @State private var memories: [HangoutMemory] = []
    @State private var status = "Loading…"

    var body: some View {
        LazyVStack(alignment: .leading, spacing: 12) {
            if memories.isEmpty { Text(status).foregroundStyle(FB.muted).padding(24) }
            ForEach(memories) { memory in
                Button { app.push(.memory(memory.id)) } label: { MemoryCard(memory: memory) }.buttonStyle(FadePress())
            }
        }
        .padding(14)
        .task(id: app.version) { await load() }
        .onTableChange("events") { Task { await load() } }
    }

    private func load() async {
        do {
            let response: MemoriesResponse = try await API.get("/api/memories", user: app.userId)
            memories = response.memories; status = "No memories yet. Rate a completed hangout to make one."
        } catch let e { status = errorText(e) }
    }
}

private struct MemoryCard: View {
    let memory: HangoutMemory
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let first = memory.photos.first?.url.flatMap(URL.init(string:)) {
                AsyncImage(url: first) { image in image.resizable().scaledToFill() } placeholder: { FB.input }
                    .frame(maxWidth: .infinity).aspectRatio(4 / 3, contentMode: .fit).clipped().clipShape(RoundedRectangle(cornerRadius: 10))
            }
            Text(memory.event.title).font(.system(size: 18, weight: .bold)).foregroundStyle(FB.text)
            Text(stars(memory.rating)).font(.system(size: 17)).foregroundStyle(Color.yellow)
            if let note = memory.privateNote { Text(note).font(.system(size: 15)).foregroundStyle(FB.text).lineLimit(3) }
            Text(formatEventDate(memory.event.startsAt)).font(.system(size: 13)).foregroundStyle(FB.muted)
        }
        .padding(12).background(Color.white, in: RoundedRectangle(cornerRadius: UI.cardRadius)).overlay(RoundedRectangle(cornerRadius: UI.cardRadius).stroke(FB.divider, lineWidth: 0.5))
    }
}

struct MemoryDetailScreen: View {
    @EnvironmentObject var app: AppState
    let memoryId: String
    @State private var memory: HangoutMemory?
    @State private var status = "Loading…"
    @State private var editing = false

    var body: some View {
        SubScreen(title: "Memory") {
            ScrollView {
                if let memory {
                    VStack(alignment: .leading, spacing: 14) {
                        MemoryCard(memory: memory)
                        if !memory.photos.isEmpty {
                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 4) {
                                ForEach(memory.photos) { photo in
                                    AsyncImage(url: photo.url.flatMap(URL.init(string:))) { image in image.resizable().scaledToFill() } placeholder: { FB.input }
                                        .aspectRatio(1, contentMode: .fit).clipped()
                                }
                            }
                        }
                        if let crew = memory.event.crew, !crew.isEmpty {
                            Text("With \(crew.map(\.name).joined(separator: ", "))").font(.system(size: 14)).foregroundStyle(FB.muted)
                        } else {
                            Text("Hosted by \(memory.event.host.name) · \(memory.event.attendeeCount) going").font(.system(size: 14)).foregroundStyle(FB.muted)
                        }
                        Button("Edit rating, note, or photos") { editing = true }.font(.system(size: 16, weight: .bold)).foregroundStyle(FB.blue)
                    }.padding(14)
                } else { Text(status).foregroundStyle(FB.muted).padding(24) }
            }.background(FB.bg2)
        }
        .task(id: memoryId) { await load() }
        .sheet(isPresented: $editing) {
            if let memory { RatingSheet(eventId: memory.eventId, existing: memory) { editing = false; Task { await load() } }.environmentObject(app) }
        }
    }

    private func load() async {
        do { let response: MemoryResponse = try await API.get("/api/memories/\(memoryId)", user: app.userId); memory = response.memory }
        catch let e { status = errorText(e) }
    }
}
