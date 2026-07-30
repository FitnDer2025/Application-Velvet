import Foundation
import UIKit
import UserNotifications

enum NotificationService {
    @MainActor
    static func requestAuthorization() async throws -> Bool {
        let granted = try await UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .badge, .sound]
        )
        if granted {
            UIApplication.shared.registerForRemoteNotifications()
        }
        return granted
    }
}
