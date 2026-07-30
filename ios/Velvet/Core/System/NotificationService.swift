import Foundation
import UIKit
import UserNotifications

extension Notification.Name {
    static let velvetNotificationRoute = Notification.Name("velvet.notification.route")
}

enum NotificationService {
    private static let tokenKey = "velvet.apns.token"
    private static let deviceIDKey = "velvet.apns.device-id"
    private static let pendingRouteKey = "velvet.apns.pending-route"

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
        let route = (userInfo["route"] as? String)
            ?? (userInfo["event_type"] as? String)
            ?? "notifications"
        UserDefaults.standard.set(route, forKey: pendingRouteKey)
        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: .velvetNotificationRoute,
                object: route,
                userInfo: userInfo
            )
        }
    }

    static func consumePendingRoute() -> String? {
        let route = UserDefaults.standard.string(forKey: pendingRouteKey)
        UserDefaults.standard.removeObject(forKey: pendingRouteKey)
        return route
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
        NotificationService.handleNotification(
            userInfo: notification.request.content.userInfo
        )
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
