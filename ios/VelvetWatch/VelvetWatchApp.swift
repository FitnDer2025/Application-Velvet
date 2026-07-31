import SwiftUI
import WatchConnectivity

private struct VelvetWatchSnapshot: Codable, Equatable {
    let total: Int
    let messages: Int
    let visits: Int
    let likes: Int
    let events: Int
    let security: Int
    let other: Int
    let updatedAt: Date

    static let empty = VelvetWatchSnapshot(
        total: 0,
        messages: 0,
        visits: 0,
        likes: 0,
        events: 0,
        security: 0,
        other: 0,
        updatedAt: .now
    )

    init(context: [String: Any]) {
        total = context["total"] as? Int ?? 0
        messages = context["messages"] as? Int ?? 0
        visits = context["visits"] as? Int ?? 0
        likes = context["likes"] as? Int ?? 0
        events = context["events"] as? Int ?? 0
        security = context["security"] as? Int ?? 0
        other = context["other"] as? Int ?? 0
        updatedAt = Date(
            timeIntervalSince1970: context["updatedAt"] as? TimeInterval ?? Date.now.timeIntervalSince1970
        )
    }
}

private final class VelvetWatchModel: NSObject, ObservableObject, WCSessionDelegate {
    static let appGroup = "group.com.velvetapplication.watch"
    static let storageKey = "velvet.watch.notification.snapshot.v1"

    @Published private(set) var snapshot: VelvetWatchSnapshot

    override init() {
        if let data = UserDefaults(suiteName: Self.appGroup)?.data(forKey: Self.storageKey),
           let value = try? JSONDecoder().decode(VelvetWatchSnapshot.self, from: data) {
            snapshot = value
        } else {
            snapshot = .empty
        }
        super.init()

        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        guard activationState == .activated else { return }
        apply(session.applicationContext)
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        apply(applicationContext)
    }

    private func apply(_ context: [String: Any]) {
        guard !context.isEmpty else { return }
        let value = VelvetWatchSnapshot(context: context)
        if let data = try? JSONEncoder().encode(value) {
            UserDefaults(suiteName: Self.appGroup)?.set(data, forKey: Self.storageKey)
        }
        DispatchQueue.main.async {
            self.snapshot = value
        }
    }
}

@main
struct VelvetWatchApp: App {
    @StateObject private var model = VelvetWatchModel()

    var body: some Scene {
        WindowGroup {
            VelvetWatchDashboard(snapshot: model.snapshot)
        }
    }
}

private struct VelvetWatchDashboard: View {
    let snapshot: VelvetWatchSnapshot

    private let gold = Color(red: 0.84, green: 0.70, blue: 0.43)

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                HStack(spacing: 7) {
                    ZStack {
                        Circle().stroke(gold.opacity(0.75), lineWidth: 1)
                        Text("V")
                            .font(.system(size: 14, weight: .medium, design: .serif))
                            .foregroundStyle(gold)
                    }
                    .frame(width: 28, height: 28)

                    Text("VELVET")
                        .font(.system(size: 12, weight: .bold))
                        .tracking(2)
                    Spacer()
                }

                VStack(spacing: 1) {
                    Text("\(snapshot.total)")
                        .font(.system(size: 48, weight: .light, design: .rounded))
                        .foregroundStyle(.white)
                        .contentTransition(.numericText())
                    Text(snapshot.total == 1 ? "activité non lue" : "activités non lues")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 6)

                counter("message.fill", "Messages", snapshot.messages)
                counter("eye.fill", "Visites", snapshot.visits)
                counter("heart.fill", "Likes", snapshot.likes)
                counter("calendar", "Sorties", snapshot.events)

                if snapshot.security > 0 {
                    counter("shield.fill", "Sécurité", snapshot.security)
                }

                Text("Mis à jour \(snapshot.updatedAt, style: .relative)")
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(.tertiary)
                    .padding(.top, 2)
            }
            .padding(.horizontal, 8)
            .padding(.bottom, 12)
        }
        .containerBackground(
            LinearGradient(
                colors: [Color.black, Color(red: 0.18, green: 0.05, blue: 0.10)],
                startPoint: .top,
                endPoint: .bottom
            ),
            for: .navigation
        )
    }

    private func counter(_ icon: String, _ title: String, _ value: Int) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(gold)
                .frame(width: 24)
            Text(title)
                .font(.system(size: 13, weight: .medium))
            Spacer()
            Text("\(value)")
                .font(.system(size: 16, weight: .bold, design: .rounded))
        }
        .padding(.horizontal, 11)
        .frame(height: 38)
        .background(.white.opacity(0.055))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}
