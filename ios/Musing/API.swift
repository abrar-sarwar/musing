import Foundation

// server addresses. written into the bundle at build time from ios/.env, plus this
// mac's lan ip so a physical phone can reach the laptop (localhost is the phone).
enum Config {
    static let hostOverrideKey = "server_host"

    private static let values: [String: String] = {
        guard let url = Bundle.main.url(forResource: "config", withExtension: "env"), let text = try? String(contentsOf: url, encoding: .utf8) else { return [:] }
        var out: [String: String] = [:]
        for line in text.split(separator: "\n") {
            guard let eq = line.firstIndex(of: "=") else { continue }
            out[String(line[..<eq]).trimmingCharacters(in: .whitespaces)] = String(line[line.index(after: eq)...]).trimmingCharacters(in: .whitespaces)
        }
        return out
    }()

    static var devHost: String? {
        if let o = UserDefaults.standard.string(forKey: hostOverrideKey), !o.isEmpty { return o }
        #if targetEnvironment(simulator)
        return nil
        #else
        let h = values["DEV_HOST"] ?? ""
        return h.isEmpty ? nil : h
        #endif
    }

    private static func resolve(_ url: String) -> String {
        guard let host = devHost else { return url }
        return url.replacingOccurrences(of: "//localhost", with: "//\(host)").replacingOccurrences(of: "//127.0.0.1", with: "//\(host)")
    }

    static var apiURL: String { resolve(values["API_URL"] ?? "http://localhost:3000") }
    static var supabaseURL: String { resolve(values["SUPABASE_URL"] ?? "http://localhost:56321") }
    static var supabaseKey: String { values["SUPABASE_ANON_KEY"] ?? "" }
}

struct ApiError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

func errorText(_ e: Error) -> String {
    (e as? LocalizedError)?.errorDescription ?? e.localizedDescription
}

// every write and every muse call goes through the api server, as the acting user.
enum API {
    static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }()

    private static func request(_ method: String, _ path: String, user: String, body: [String: Any]? = nil) -> URLRequest {
        var req = URLRequest(url: URL(string: Config.apiURL + path)!)
        req.httpMethod = method
        req.setValue(user, forHTTPHeaderField: "x-musing-user")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "content-type")
            req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        }
        return req
    }

    private static func failure(_ data: Data, _ status: Int) -> ApiError {
        if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let msg = obj["error"] as? String { return ApiError(message: msg) }
        let text = String(data: data, encoding: .utf8) ?? ""
        return ApiError(message: text.isEmpty || text.count > 200 ? "http \(status)" : text)
    }

    @discardableResult
    static func data(_ method: String, _ path: String, user: String, body: [String: Any]? = nil) async throws -> Data {
        let (data, resp) = try await URLSession.shared.data(for: request(method, path, user: user, body: body))
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else { throw failure(data, status) }
        return data
    }

    static func get<T: Decodable>(_ path: String, user: String) async throws -> T {
        try decoder.decode(T.self, from: try await data("GET", path, user: user))
    }

    static func post<T: Decodable>(_ path: String, user: String, body: [String: Any]? = nil) async throws -> T {
        try decoder.decode(T.self, from: try await data("POST", path, user: user, body: body))
    }

    // server paths like "/api/posters/<id>" need the api host in front
    static func absoluteURL(_ pathOrURL: String) -> URL? {
        URL(string: pathOrURL.hasPrefix("/") ? Config.apiURL + pathOrURL : pathOrURL)
    }

    // server-sent events. the server writes "event: x\ndata: <one line of json>\n\n",
    // so each data line completes an event. calls onEvent until the stream closes.
    static func stream(_ path: String, user: String, body: [String: Any], onEvent: @MainActor (String, [String: Any]) -> Void) async throws {
        var req = request("POST", path, user: user, body: body)
        req.setValue("text/event-stream", forHTTPHeaderField: "accept")
        req.timeoutInterval = 180
        let (bytes, resp) = try await URLSession.shared.bytes(for: req)
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            var data = Data()
            for try await b in bytes { data.append(b) }
            throw failure(data, status)
        }
        var event = "message"
        for try await line in bytes.lines {
            if line.hasPrefix("event:") {
                event = line.dropFirst(6).trimmingCharacters(in: .whitespaces)
            } else if line.hasPrefix("data:") {
                let raw = line.dropFirst(5).trimmingCharacters(in: .whitespaces)
                let obj = (try? JSONSerialization.jsonObject(with: Data(raw.utf8))) as? [String: Any] ?? ["text": raw]
                await onEvent(event, obj)
                event = "message"
            }
        }
    }
}

// supabase with the anon key: reads + realtime only.
enum Supa {
    static func select<T: Decodable>(_ table: String, _ query: String) async throws -> [T] {
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed.subtracting(CharacterSet(charactersIn: "{}"))) ?? query
        var req = URLRequest(url: URL(string: "\(Config.supabaseURL)/rest/v1/\(table)?\(encoded)")!)
        req.setValue(Config.supabaseKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(Config.supabaseKey)", forHTTPHeaderField: "authorization")
        let (data, resp) = try await URLSession.shared.data(for: req)
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            throw ApiError(message: (obj?["message"] as? String) ?? "http \(status)")
        }
        return try API.decoder.decode([T].self, from: data)
    }
}

extension Notification.Name {
    static let tableChanged = Notification.Name("musing.tableChanged")
}

// one websocket to supabase realtime. posts the table name whenever a row changes.
// the payload is ignored on purpose: screens refetch through the api server, which
// decides what this person may see.
final class Realtime {
    static let shared = Realtime()
    private static let tables = ["plans", "events", "messages", "muse_trace", "app_settings"]
    private var task: URLSessionWebSocketTask?
    private var ref = 0

    func start() {
        guard task == nil else { return }
        connect()
    }

    private func connect() {
        guard var comps = URLComponents(string: Config.supabaseURL + "/realtime/v1/websocket") else { return }
        comps.scheme = comps.scheme == "https" ? "wss" : "ws"
        comps.queryItems = [URLQueryItem(name: "apikey", value: Config.supabaseKey), URLQueryItem(name: "vsn", value: "1.0.0")]
        guard let url = comps.url else { return }
        let t = URLSession.shared.webSocketTask(with: url)
        task = t
        t.resume()
        let changes = Self.tables.map { ["event": "*", "schema": "public", "table": $0] }
        send(t, topic: "realtime:musing-app", event: "phx_join", payload: ["config": ["broadcast": ["self": false], "presence": ["key": ""], "postgres_changes": changes]])
        receive(t)
        heartbeat(t)
    }

    private func send(_ t: URLSessionWebSocketTask, topic: String, event: String, payload: [String: Any]) {
        ref += 1
        let msg: [String: Any] = ["topic": topic, "event": event, "payload": payload, "ref": String(ref)]
        guard let data = try? JSONSerialization.data(withJSONObject: msg), let text = String(data: data, encoding: .utf8) else { return }
        t.send(.string(text)) { _ in }
    }

    private func receive(_ t: URLSessionWebSocketTask) {
        t.receive { [weak self] result in
            DispatchQueue.main.async {
                guard let self, t === self.task else { return }
                switch result {
                case .failure:
                    self.task = nil
                    DispatchQueue.main.asyncAfter(deadline: .now() + 3) { if self.task == nil { self.connect() } }
                case .success(let message):
                    if case .string(let text) = message,
                       let obj = (try? JSONSerialization.jsonObject(with: Data(text.utf8))) as? [String: Any],
                       obj["event"] as? String == "postgres_changes",
                       let payload = obj["payload"] as? [String: Any],
                       let data = payload["data"] as? [String: Any],
                       let table = data["table"] as? String {
                        NotificationCenter.default.post(name: .tableChanged, object: table)
                    }
                    self.receive(t)
                }
            }
        }
    }

    private func heartbeat(_ t: URLSessionWebSocketTask) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 25) { [weak self] in
            guard let self, t === self.task else { return }
            self.send(t, topic: "phoenix", event: "heartbeat", payload: [:])
            self.heartbeat(t)
        }
    }
}
