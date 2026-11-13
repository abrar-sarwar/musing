import SwiftUI

// muse, drawn: a small cream plush creature, shown as its face inside the fluffy hood
// (the way a contact photo would crop it). two black dot eyes, a small curved smile,
// rosy cheeks. it is drawn rather than a picture so the face can change: asleep and
// dreaming, awake, thinking hard, thrilled, serious. no glyphs, no sparkles.

enum MuseExpression: Equatable {
    case asleep // idle: dreaming
    case awake // listening, or just being there
    case thinking // mewing: working on what you said
    case hype // the "let's go" beat when a plan lands
    case serious // right after: "mewed."
    case sad // something didn't go through
}

private enum Plush {
    static let fur = Color(hex: 0xf1e4cc)
    static let furLight = Color(hex: 0xfaf2e2)
    static let furShade = Color(hex: 0xdcc9a8)
    static let skin = Color(hex: 0xfbe3cc)
    static let skinShade = Color(hex: 0xf4d0b0)
    static let ink = Color(hex: 0x1d1a17)
    static let cheek = Color(hex: 0xf59b9b)
    static let mouth = Color(hex: 0x7a3b3b)
}

/// a line that bends: positive sags in the middle (a smile), negative arches (closed happy eyes, a frown)
private struct Bend: Shape {
    var amount: CGFloat
    var animatableData: CGFloat {
        get { amount }
        set { amount = newValue }
    }

    func path(in r: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: r.minX, y: r.midY - amount * r.height / 2))
        p.addQuadCurve(to: CGPoint(x: r.maxX, y: r.midY - amount * r.height / 2), control: CGPoint(x: r.midX, y: r.midY + amount * r.height * 1.5))
        return p
    }
}

struct MuseFace: View {
    var expression: MuseExpression = .awake
    var size: CGFloat = 96
    /// eyes shut for a moment. ignored when they are already closed.
    var blink = false

    var body: some View {
        let s = size
        ZStack {
            // the hood: a soft round of fur with tufts around the edge
            ForEach(0..<18, id: \.self) { i in
                let a = Double(i) / 18 * 2 * .pi
                Circle().fill(Plush.fur)
                    .frame(width: s * 0.26, height: s * 0.26)
                    .offset(x: CGFloat(cos(a)) * s * 0.37, y: CGFloat(sin(a)) * s * 0.37)
            }
            Circle().fill(RadialGradient(colors: [Plush.furLight, Plush.fur, Plush.furShade], center: UnitPoint(x: 0.4, y: 0.3), startRadius: s * 0.05, endRadius: s * 0.62))
                .frame(width: s * 0.9, height: s * 0.9)
            // the face inside it
            Ellipse().fill(LinearGradient(colors: [Plush.skin, Plush.skinShade], startPoint: .top, endPoint: .bottom))
                .frame(width: s * 0.64, height: s * 0.52)
                .overlay(Ellipse().stroke(Plush.furShade.opacity(0.55), lineWidth: s * 0.02).blur(radius: s * 0.012))
                .offset(y: s * 0.02)
            // cheeks
            HStack(spacing: s * 0.3) {
                Circle().fill(Plush.cheek).frame(width: s * 0.13, height: s * 0.13)
                Circle().fill(Plush.cheek).frame(width: s * 0.13, height: s * 0.13)
            }
            .blur(radius: s * 0.03).opacity(expression == .hype ? 0.75 : 0.5).offset(y: s * 0.1)
            HStack(spacing: s * 0.2) {
                eye(s, left: true)
                eye(s, left: false)
            }
            .offset(y: -s * 0.005)
            mouth(s).offset(y: s * 0.115)
        }
        .frame(width: s, height: s)
        .animation(.easeInOut(duration: 0.2), value: expression)
        .accessibilityHidden(true)
    }

    @ViewBuilder private func eye(_ s: CGFloat, left: Bool) -> some View {
        let line = StrokeStyle(lineWidth: max(1.6, s * 0.026), lineCap: .round)
        Group {
            switch expression {
            case .asleep:
                // shut, resting
                Bend(amount: 0.8).stroke(Plush.ink, style: line).frame(width: s * 0.1, height: s * 0.035)
            case .hype:
                // squeezed shut with joy
                Bend(amount: -0.9).stroke(Plush.ink, style: line).frame(width: s * 0.11, height: s * 0.05)
            case .thinking:
                // half closed: concentrating
                Capsule().fill(Plush.ink).frame(width: s * 0.085, height: blink ? s * 0.02 : s * 0.04)
            case .serious:
                // level, a little narrowed, tipped in like a small frown of effort
                Capsule().fill(Plush.ink).frame(width: s * 0.1, height: s * 0.036).rotationEffect(.degrees(left ? 10 : -10))
            default:
                if blink {
                    Capsule().fill(Plush.ink).frame(width: s * 0.085, height: s * 0.02)
                } else {
                    Circle().fill(Plush.ink).frame(width: s * 0.085, height: s * 0.085)
                        .overlay(Circle().fill(Color.white.opacity(0.9)).frame(width: s * 0.026, height: s * 0.026).offset(x: -s * 0.014, y: -s * 0.016))
                }
            }
        }
        .frame(width: s * 0.11, height: s * 0.09)
    }

    @ViewBuilder private func mouth(_ s: CGFloat) -> some View {
        let line = StrokeStyle(lineWidth: max(1.5, s * 0.024), lineCap: .round)
        switch expression {
        case .asleep: Capsule().fill(Plush.ink).frame(width: s * 0.035, height: s * 0.022)
        case .thinking: Circle().stroke(Plush.ink, lineWidth: max(1.5, s * 0.022)).frame(width: s * 0.045, height: s * 0.045)
        case .hype:
            // wide open
            UnevenRoundedRectangle(topLeadingRadius: s * 0.02, bottomLeadingRadius: s * 0.08, bottomTrailingRadius: s * 0.08, topTrailingRadius: s * 0.02)
                .fill(Plush.mouth).frame(width: s * 0.15, height: s * 0.1)
        case .serious: Capsule().fill(Plush.ink).frame(width: s * 0.09, height: max(1.5, s * 0.024))
        case .sad: Bend(amount: -0.7).stroke(Plush.ink, style: line).frame(width: s * 0.09, height: s * 0.035)
        case .awake: Bend(amount: 0.8).stroke(Plush.ink, style: line).frame(width: s * 0.1, height: s * 0.04)
        }
    }
}
