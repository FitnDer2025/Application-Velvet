import Foundation

extension MemberSettingsRequest {
    init(
        discoverableBy: [String],
        contactableBy: [String],
        notifyFrom: [String],
        eventTypes: NotificationEventPreferences,
        inAppEnabled: Bool,
        browserEnabled: Bool,
        emailEnabled: Bool,
        quietHoursStart: String?,
        quietHoursEnd: String?
    ) {
        self.init(
            discoverableBy: discoverableBy,
            contactableBy: contactableBy,
            notifyFrom: notifyFrom,
            eventTypes: eventTypes,
            inAppEnabled: inAppEnabled,
            browserEnabled: browserEnabled,
            emailEnabled: emailEnabled,
            quietHoursStart: quietHoursStart,
            quietHoursEnd: quietHoursEnd,
            discoveryRadiusKm: 50,
            profileSort: "distance",
            aiPersonalizationEnabled: true
        )
    }
}
