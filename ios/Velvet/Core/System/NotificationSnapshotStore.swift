import Foundation
import WatchConnectivity
import WidgetKit

struct VelvetNotificationSnapshot: Codable, Equatable, Sendable {
    let total: Int
    let messages: Int
    let visits: Int
    let likes: Int
    let events: Int
    let security: Int
    let other: Int
    let updatedAt: Date

    static let empty = VelvetNotificationSnapshot(
        total: 0,
        messages: 0,
        visits: 0,
        likes: 0,
        events: 0,
        security: 0,
        other: 0,
        updatedAt: .now
    )

    var watchContext: [String: Any] {
        [
            "total": total,
            "messages": messages,
            "visits": visits,
            "likes": likes,
            "events": events,
            "security": security,
            "other": other,
            "updatedAt": updatedAt.timeIntervalSince1970
        ]
    }
}

enum VelvetNotificationSnapshotStore {
    static let appGroup = "group.com.velvetapplication.app"
    static let storageKey = "velvet.notification.snapshot.v1"
    static let widgetKind = "VelvetNotificationWidget"

    @MainActor
    static func persist(feed: NotificationFeed, unreadMessages: Int) {
        let unread = feed.notifications.filter { $0.readAt == nil }

        func count(_ values: Set<String>) -> Int {
            unread.reduce(0) { total, notification in
                total + (values.contains(notification.eventType.lowercased()) ? 1 : 0)
            }
        }

        let messageNotifications = count(["messages", "message"])
        let visits = count(["profile_views", "views", "profile_view"])
        let likes = count(["reactions", "likes", "photo_reaction"])
        let events = count(["events", "event", "registrations", "registration"])
        let security = count(["security", "screenshot", "screen_recording"])
        let knownNotificationCount = messageNotifications + visits + likes + events + security
        let other = max(0, feed.unreadCount - knownNotificationCount)
        let messages = max(unreadMessages, messageNotifications)

        let snapshot = VelvetNotificationSnapshot(
            total: messages + visits + likes + events + security + other,
            messages: messages,
            visits: visits,
            likes: likes,
            events: events,
            security: security,
            other: other,
            updatedAt: .now
        )

        write(snapshot)
        WidgetCenter.shared.reloadTimelines(ofKind: widgetKind)
        WatchNotificationBridge.shared.send(snapshot)
    }

    @MainActor
    static func clear() {
        write(.empty)
        WidgetCenter.shared.reloadTimelines(ofKind: widgetKind)
        WatchNotificationBridge.shared.send(.empty)
    }

    private static func write(_ snapshot: VelvetNotificationSnapshot) {
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        UserDefaults(suiteName: appGroup)?.set(data, forKey: storageKey)
    }
}

final class WatchNotificationBridge: NSObject, WCSessionDelegate {
    static let shared = WatchNotificationBridge()

    private var pendingContext: [String: Any]?

    private override init() {
        super.init()
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func send(_ snapshot: VelvetNotificationSnapshot) {
        guard WCSession.isSupported() else { return }
        let context = snapshot.watchContext
        let session = WCSession.default

        guard session.activationState == .activated else {
            pendingContext = context
            session.activate()
            return
        }

        do {
            try session.updateApplicationContext(context)
            pendingContext = nil
        } catch {
            pendingContext = context
        }
    }

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        guard activationState == .activated, let pendingContext else { return }
        try? session.updateApplicationContext(pendingContext)
        self.pendingContext = nil
    }

    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }
}
