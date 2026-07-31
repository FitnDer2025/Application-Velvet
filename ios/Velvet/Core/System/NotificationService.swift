import Foundation
import UIKit
import UserNotifications

extension Notification.Name {
    static let velvetNotificationRoute = Notification.Name("velvet.notification.route")
}

struct VelvetNotificationRoute: Codable, Equatable, Sendable {
    enum Destination: String, Codable, Sendable {
        case notifications
        case messages
        case events
        case maps
        case profile
    }

    let destination: Destination
    let conversationID: UUID?
    let profileID: UUID?
    let eventID: UUID?

    static let notifications = VelvetNotificationRoute(
        destination: .notifications,
        conversationID: nil,
        profileID: nil,
        eventID: nil
    )

    init(
        destination: Destination,
        conversationID: UUID? = nil,
        profileID: UUID? = nil,
        eventID: UUID? = nil
    ) {
        self.destination = destination
        self.conversationID = conversationID
        self.profileID = profileID
        self.eventID = eventID
    }

    init(userInfo: [AnyHashable: Any]) {
        let rawRoute = Self.string(
            userInfo["route"] ?? userInfo["event_type"] ?? userInfo["eventType"]
        ).lowercased()

        let conversationID = Self.uuid(
            userInfo["conversationId"]
                ?? userInfo["conversation_id"]
                ?? (rawRoute.contains("message") ? userInfo["entity_id"] : nil)
        )
        let profileID = Self.uuid(
            userInfo["senderProfileId"]
                ?? userInfo["sender_profile_id"]
                ?? userInfo["actorProfileId"]
                ?? userInfo["actor_profile_id"]
                ?? userInfo["profileId"]
                ?? userInfo["profile_id"]
        )
        let eventID = Self.uuid(
            userInfo["eventId"]
                ?? userInfo["event_id"]
                ?? (rawRoute.contains("event") ? userInfo["entity_id"] : nil)
        )

        let destination: Destination
        switch rawRoute {
        case "messages", "message", "conversations": destination = .messages
        case "events", "event", "registrations", "registration": destination = .events
        case "maps", "map", "location": destination = .maps
        case "profile", "likes", "reactions", "recommendations", "profile_views", "views", "security":
            destination = .profile
        default: destination = .notifications
        }

        self.init(
            destination: destination,
            conversationID: conversationID,
            profileID: profileID,
            eventID: eventID
        )
    }

    init?(url: URL) {
        guard url.scheme?.lowercased() == "velvet" else { return nil }
        let target = [url.host, url.pathComponents.dropFirst().first]
            .compactMap { $0 }
            .first(where: { !$0.isEmpty })?
            .lowercased() ?? "notifications"
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let values = Dictionary(
            uniqueKeysWithValues: (components?.queryItems ?? []).map { ($0.name, $0.value ?? "") }
        )

        switch target {
        case "messages", "message", "conversations":
            self.init(
                destination: .messages,
                conversationID: Self.uuid(values["conversationId"] ?? values["conversation_id"]),
                profileID: Self.uuid(values["profileId"] ?? values["profile_id"])
            )
        case "events", "event":
            self.init(
                destination: .events,
                eventID: Self.uuid(values["eventId"] ?? values["event_id"])
            )
        case "maps", "map":
            self.init(destination: .maps)
        case "profile":
            self.init(
                destination: .profile,
                profileID: Self.uuid(values["profileId"] ?? values["profile_id"])
            )
        default:
            self = .notifications
        }
    }

    private static func string(_ value: Any?) -> String {
        switch value {
        case let value as String: value
        case let value as NSString: value as String
        default: ""
        }
    }

    private static func uuid(_ value: Any?) -> UUID? {
        if let value = value as? UUID { return value }
        let text = string(value)
        return UUID(uuidString: text)
    }
}

enum NotificationService {
    private static let tokenKey = "velvet.apns.token"
    private static let deviceIDKey = "velvet.apns.device-id"
    private static let pendingRouteKey = "velvet.apns.pending-route.v2"

    @MainActor
    static func requestAuthorization() async throws -> Bool {
        registerCategories()
        let granted = try await UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .badge, .sound]
        )
        if granted {
            UIApplication.shared.registerForRemoteNotifications()
        }
        return granted
    }

    static func authorizationStatus() async -> UNAuthorizationStatus {
        await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }

    @MainActor
    static func registerIfAuthorized() async {
        let status = await authorizationStatus()
        guard status == .authorized || status == .provisional else { return }
        registerCategories()
        UIApplication.shared.registerForRemoteNotifications()
    }

    @MainActor
    static func disable() async {
        UIApplication.shared.unregisterForRemoteNotifications()
        await detachCurrentDevice()
        try? await UNUserNotificationCenter.current().setBadgeCount(0)
        VelvetNotificationSnapshotStore.clear()
    }

    @MainActor
    static func detachCurrentDevice() async {
        guard let token = UserDefaults.standard.string(forKey: tokenKey) else { return }
        try? await SessionService().unregisterPushDevice(token: token)
        UserDefaults.standard.removeObject(forKey: tokenKey)
    }

    @MainActor
    static func openSystemSettings() {
        guard let url = URL(string: UIApplication.openNotificationSettingsURLString) else {
            return
        }
        UIApplication.shared.open(url)
    }

    static func registerCategories() {
        let openMessage = UNNotificationAction(
            identifier: "VELVET_OPEN_MESSAGE",
            title: "Ouvrir la conversation",
            options: [.foreground]
        )
        let openEvent = UNNotificationAction(
            identifier: "VELVET_OPEN_EVENT",
            title: "Voir la sortie",
            options: [.foreground]
        )
        let messageCategory = UNNotificationCategory(
            identifier: "VELVET_MESSAGE",
            actions: [openMessage],
            intentIdentifiers: []
        )
        let eventCategory = UNNotificationCategory(
            identifier: "VELVET_EVENT",
            actions: [openEvent],
            intentIdentifiers: []
        )
        UNUserNotificationCenter.current().setNotificationCategories([
            messageCategory,
            eventCategory
        ])
    }

    static func handleDeviceToken(_ data: Data) {
        let token = data.map { String(format: "%02x", $0) }.joined()
        UserDefaults.standard.set(token, forKey: tokenKey)

        #if DEBUG
        print("Velvet APNs device token (sandbox): \(token)")
        #endif

        Task {
            try? await SessionService().registerPushDevice(
                token: token,
                deviceID: deviceID,
                environment: pushEnvironment,
                bundleID: Bundle.main.bundleIdentifier ?? "com.velvetapplication.app",
                appVersion: Bundle.main.object(
                    forInfoDictionaryKey: "CFBundleShortVersionString"
                ) as? String ?? "0"
            )
        }
    }

    static func handleRegistrationFailure(_ error: Error) {
        #if DEBUG
        print("Velvet APNs registration failed: \(error.localizedDescription)")
        #endif
    }

    static func handleNotification(userInfo: [AnyHashable: Any]) {
        publish(VelvetNotificationRoute(userInfo: userInfo), userInfo: userInfo)
    }

    static func handleDeepLink(_ url: URL) -> Bool {
        guard let route = VelvetNotificationRoute(url: url) else { return false }
        publish(route, userInfo: ["url": url.absoluteString])
        return true
    }

    static func consumePendingRoute() -> VelvetNotificationRoute? {
        guard let data = UserDefaults.standard.data(forKey: pendingRouteKey) else { return nil }
        UserDefaults.standard.removeObject(forKey: pendingRouteKey)
        return try? JSONDecoder().decode(VelvetNotificationRoute.self, from: data)
    }

    private static func publish(
        _ route: VelvetNotificationRoute,
        userInfo: [AnyHashable: Any]
    ) {
        if let data = try? JSONEncoder().encode(route) {
            UserDefaults.standard.set(data, forKey: pendingRouteKey)
        }
        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: .velvetNotificationRoute,
                object: route,
                userInfo: userInfo
            )
        }
    }

    private static var deviceID: String {
        if let value = UserDefaults.standard.string(forKey: deviceIDKey) {
            return value
        }
        let value = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
        UserDefaults.standard.set(value, forKey: deviceIDKey)
        return value
    }

    private static var pushEnvironment: String {
        #if DEBUG
        "sandbox"
        #else
        "production"
        #endif
    }
}

final class VelvetAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [
            UIApplication.LaunchOptionsKey: Any
        ]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        NotificationService.registerCategories()
        Task { @MainActor in
            await NotificationService.registerIfAuthorized()
        }
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        NotificationService.handleDeviceToken(deviceToken)
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        NotificationService.handleRegistrationFailure(error)
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (
            UNNotificationPresentationOptions
        ) -> Void
    ) {
        // Une notification reçue au premier plan reste une bannière. La navigation
        // ne se déclenche que lorsque le membre touche effectivement la notification.
        completionHandler([.banner, .list, .badge, .sound])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        NotificationService.handleNotification(
            userInfo: response.notification.request.content.userInfo
        )
        completionHandler()
    }
}
