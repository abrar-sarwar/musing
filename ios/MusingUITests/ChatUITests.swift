import XCTest

// drives the real app in the simulator. these tests need:
//   - the local server and supabase running
//   - a plan chat that maya and alex are both in, passed as TEST_RUNNER_MUSING_THREAD=<thread id>
//   - for the vote test, an open proposal in that chat
// they make one real muse call (the food question).
final class ChatUITests: XCTestCase {
    private var thread: String { ProcessInfo.processInfo.environment["MUSING_THREAD"] ?? "" }

    override func setUpWithError() throws {
        continueAfterFailure = false
        try XCTSkipIf(thread.isEmpty, "set TEST_RUNNER_MUSING_THREAD to a plan chat's id")
    }

    private func launch(as user: String) -> XCUIApplication {
        let app = XCUIApplication()
        // launch arguments land in UserDefaults: pick the person, skip the account prompt, open the chat
        app.launchArguments = ["-musing_user", user, "-musing_account_chosen", "YES", "-open", "messages/\(thread)"]
        app.launch()
        return app
    }

    private func composer(_ app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: "chat-composer").firstMatch
    }

    private func text(_ app: XCUIApplication, containing s: String) -> XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] %@", s)).firstMatch
    }

    private func send(_ app: XCUIApplication, _ message: String) {
        let field = composer(app)
        field.tap()
        field.typeText(message)
        XCTAssertTrue(app.keyboards.firstMatch.exists, "the keyboard is up while typing")
        let button = app.buttons["Send"]
        XCTAssertTrue(button.isHittable, "the send button stays above the keyboard")
        button.tap()
    }

    private func museTexts(_ app: XCUIApplication) -> Int {
        app.staticTexts.matching(identifier: "muse-text").count
    }

    private func waitForMuse(_ app: XCUIApplication, moreThan before: Int, timeout: TimeInterval) -> Bool {
        let more = NSPredicate { _, _ in self.museTexts(app) > before }
        return XCTWaiter().wait(for: [XCTNSPredicateExpectation(predicate: more, object: nil)], timeout: timeout) == .completed
    }

    /// posts as someone else straight to the server, the way a second phone would
    private func post(as user: String, _ body: String) {
        var req = URLRequest(url: URL(string: "http://localhost:3000/api/threads/\(thread)/messages")!)
        req.httpMethod = "POST"
        req.setValue(user, forHTTPHeaderField: "x-musing-user")
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["body": body, "clientId": UUID().uuidString])
        let done = expectation(description: "posted")
        URLSession.shared.dataTask(with: req) { _, resp, _ in
            XCTAssertEqual((resp as? HTTPURLResponse)?.statusCode, 200)
            done.fulfill()
        }.resume()
        wait(for: [done], timeout: 10)
    }

    func testA_composerChipsMuseMuteAndLiveUpdates() {
        let app = launch(as: "maya")
        XCTAssertTrue(composer(app).waitForExistence(timeout: 20), "the chat opens with a composer")
        XCTAssertTrue(text(app, containing: "an AI co-planner").exists, "muse is labelled as an AI in the header")

        // 1. type and send a normal message
        let stamp = String(Int(Date().timeIntervalSince1970) % 100000)
        send(app, "ui test hello \(stamp)")
        XCTAssertTrue(text(app, containing: "ui test hello \(stamp)").waitForExistence(timeout: 8), "the sent message shows up")

        // 2. a message from another phone arrives without touching the screen
        post(as: "alex", "from alex \(stamp)")
        XCTAssertTrue(text(app, containing: "from alex \(stamp)").waitForExistence(timeout: 10), "another member's message arrives live")

        // 3. action chips
        var before = museTexts(app)
        app.buttons["recap the plan"].tap()
        XCTAssertTrue(waitForMuse(app, moreThan: before, timeout: 8), "recap answers")
        XCTAssertTrue(text(app, containing: "are in.").exists)
        before = museTexts(app)
        app.buttons["show our finds"].tap()
        XCTAssertTrue(waitForMuse(app, moreThan: before, timeout: 8), "finds answers")

        // 4. a finds card opens the listing and back returns to the chat
        let listing = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "denim jacket"))
        XCTAssertTrue(listing.firstMatch.waitForExistence(timeout: 5))
        listing.element(boundBy: listing.count - 1).tap()
        XCTAssertTrue(app.staticTexts["Marketplace"].waitForExistence(timeout: 6), "the listing screen opens")
        app.buttons["Back"].tap()
        XCTAssertTrue(composer(app).waitForExistence(timeout: 6), "back returns to the chat")

        // 5. @muse with a question the plan already answers (routed, no model call)
        before = museTexts(app)
        send(app, "@muse what time are we meeting?")
        XCTAssertTrue(waitForMuse(app, moreThan: before, timeout: 8), "muse answers the time question quickly")

        // 6. mute: muse stops answering, people keep talking
        app.buttons["Mute muse"].tap()
        XCTAssertTrue(app.buttons["Unmute muse"].waitForExistence(timeout: 6))
        XCTAssertTrue(text(app, containing: "muse is muted here").exists)
        XCTAssertFalse(app.buttons["recap the plan"].exists, "the muse actions go away when muted")
        before = museTexts(app)
        send(app, "@muse still there \(stamp)")
        XCTAssertTrue(text(app, containing: "still there \(stamp)").waitForExistence(timeout: 8), "a message still sends while muse is muted")
        XCTAssertFalse(waitForMuse(app, moreThan: before, timeout: 4), "muse stays quiet while muted")
        app.buttons["Unmute muse"].tap()
        XCTAssertTrue(app.buttons["Mute muse"].waitForExistence(timeout: 6))

        // 7. background, a message arrives, foreground: it is there
        XCUIDevice.shared.press(.home)
        post(as: "alex", "while you were away \(stamp)")
        app.activate()
        XCTAssertTrue(text(app, containing: "while you were away \(stamp)").waitForExistence(timeout: 12), "a message sent while backgrounded shows after returning")

        // 8. a real muse call: typing indicator, then a streamed answer
        before = museTexts(app)
        send(app, "@muse any food ideas for after?")
        let typing = app.descendants(matching: .any).matching(identifier: "muse-typing").firstMatch
        let sawTyping = typing.waitForExistence(timeout: 10)
        XCTAssertTrue(waitForMuse(app, moreThan: before, timeout: 75), "muse answers the food question")
        XCTAssertTrue(sawTyping, "a typing indicator showed while muse was working")
        XCTAssertFalse(typing.exists, "no typing indicator is left behind")
    }

    func testB_voteButtons() {
        let app = launch(as: "alex")
        XCTAssertTrue(composer(app).waitForExistence(timeout: 20))
        let agree = app.buttons["agree"]
        XCTAssertTrue(agree.waitForExistence(timeout: 10), "an open proposal shows vote buttons")
        XCTAssertTrue(app.buttons["keep it as is"].exists)
        agree.tap()
        XCTAssertTrue(text(app, containing: "everyone agreed").waitForExistence(timeout: 10), "the card settles once everyone going has agreed")
        XCTAssertFalse(agree.exists, "the vote buttons are gone once it is settled")
        XCTAssertTrue(text(app, containing: "everyone's in. it's now").waitForExistence(timeout: 10), "muse posts the one update")
    }
}
