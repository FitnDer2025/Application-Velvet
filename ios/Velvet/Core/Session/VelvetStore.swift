import Combine
import Foundation
import UserNotifications

@MainActor
final class VelvetStore: ObservableObject {
    @Published private(set) var directory: DirectoryResponse?
    @Published private(set) var notificationFeed = NotificationFeed(notifications: [], unreadCount: 0)
    @Published private(set) var archivedNotificationFeed = NotificationFeed(
        notifications: [],
        unreadCount: 0,
        archiveCount: 0,
        archived: true
    )
    @Published private(set) var discoveryState = DiscoveryStateResponse(
        presence: [],
        following: [],
        access: nil,
        persistenceAvailable: false,
        presenceAvailable: false
    )
    @Published private(set) var engagementState = EngagementResponse(
        views: [],
        reactions: [],
        streaks: [],
        currentUserId: nil,
        currentProfileId: nil
    )
    @Published private(set) var mapData: MemberMapResponse?
    @Published private(set) var messages: [UUID: [DirectoryMessage]] = [:]
    @Published private(set) var conversationStreaks: [UUID: ConversationStreak] = [:]
    @Published private(set) var messageReceipts: [UUID: [UUID: [MessageReceipt]]] = [:]
    @Published private(set) var messageReactions: [UUID: [UUID: [MessageReaction]]] = [:]
    @Published private(set) var typingParticipants: [UUID: [TypingParticipant]] = [:]
    @Published private(set) var photoReactions: [UUID: PhotoReactionSummary] = [:]
    @Published private(set) var isLoading = false
    @Published private(set) var loadIssue: String?
    @Published var errorMessage: String?

    let service: SessionService

    var unreadMessageCount: Int {
        directory?.messageUnreadCount
            ?? directory?.conversations.reduce(0) {
                $0 + NumberFormatter.velvetInteger($1.unreadCount)
            }
            ?? 0
    }

    var viewedProfiles: [(history: ProfileViewHistory, profile: MemberProfile?)] {
        engagementState.views
            .sorted { EngagementDate.date($0.lastViewedAt) > EngagementDate.date($1.lastViewedAt) }
            .map { history in
                (
                    history,
                    directory?.profiles.first(where: { $0.id == history.viewedProfileId })
                )
            }
    }

    init(service: SessionService = SessionService()) {
        self.service = service
    }

    func load() async {
        isLoading = true
        loadIssue = nil
        defer { isLoading = false }
        do {
            async let directoryRequest = service.directory()
            async let notificationRequest = service.notifications()
            async let discoveryRequest = service.discoveryState()
            async let mapRequest = service.memberMap()
            async let engagementRequest = service.engagementState()
            async let photoReactionRequest = service.photoReactionFeed()

            directory = try await directoryRequest
            notificationFeed = (try? await notificationRequest) ?? NotificationFeed(
                notifications: [],
                unreadCount: 0
            )
            discoveryState = (try? await discoveryRequest) ?? DiscoveryStateResponse(
                presence: [],
                following: [],
                access: nil,
                persistenceAvailable: false,
                presenceAvailable: false
            )
            mapData = try? await mapRequest
            if let engagement = try? await engagementRequest {
                apply(engagement)
            }
            if let feed = try? await photoReactionRequest {
                photoReactions = Dictionary(uniqueKeysWithValues: feed.reactions.map { ($0.mediaId, $0) })
            }
            await markVisibleMessagesDelivered()
            await synchronizeExternalCounters()
        } catch {
            // Un incident de synchronisation au démarrage ne doit plus bloquer l’utilisateur
            // avec une alerte modale. Les écrans présentent un état de repli et un bouton Réessayer.
            loadIssue = ErrorMessage.text(for: error)
        }
    }

    func refreshMessaging() async {
        do {
            async let directoryRequest = service.directory()
            async let notificationRequest = service.notifications()
            async let engagementRequest = service.engagementState()
            directory = try await directoryRequest
            notificationFeed = (try? await notificationRequest) ?? notificationFeed
            if let engagement = try? await engagementRequest {
                apply(engagement)
            }
            await markVisibleMessagesDelivered()
            await synchronizeExternalCounters()
        } catch {
            // Une actualisation silencieuse ne doit pas interrompre la navigation.
        }
    }

    func refreshSocialState() async {
        async let engagementRequest = service.engagementState()
        async let reactionRequest = service.photoReactionFeed()
        if let engagement = try? await engagementRequest {
            apply(engagement)
        }
        if let feed = try? await reactionRequest {
            photoReactions = Dictionary(uniqueKeysWithValues: feed.reactions.map { ($0.mediaId, $0) })
        }
    }

    func refreshMessages(conversationID: UUID) async {
        do {
            let response = try await service.messages(conversationID: conversationID)
            messages[conversationID] = response.messages
            if let streak = response.streak {
                conversationStreaks[conversationID] = streak
            }
            messageReceipts[conversationID] = Self.uuidDictionary(response.receipts)
            messageReactions[conversationID] = Self.uuidDictionary(response.reactions)
            typingParticipants[conversationID] = response.typing ?? []
            notificationFeed = (try? await service.notifications()) ?? notificationFeed
            await refreshDirectoryOnly()
            await synchronizeExternalCounters()
        } catch {
            errorMessage = ErrorMessage.text(for: error)
        }
    }

    func send(
        _ body: String,
        conversationID: UUID,
        attachments: [OutgoingMessageAttachment] = []
    ) async -> Bool {
        do {
            let message = try await service.sendMessage(
                body,
                conversationID: conversationID,
                attachments: attachments
            )
            messages[conversationID, default: []].append(message)
            await refreshMessages(conversationID: conversationID)
            return true
        } catch {
            errorMessage = ErrorMessage.text(for: error)
            return false
        }
    }

    func setTyping(conversationID: UUID, active: Bool) async {
        try? await service.setConversationTyping(
            conversationID: conversationID,
            active: active
        )
    }

    func setMessageReaction(
        conversationID: UUID,
        messageID: UUID,
        reaction: String?
    ) async {
        do {
            try await service.setMessageReaction(
                conversationID: conversationID,
                messageID: messageID,
                reaction: reaction
            )
            await refreshMessages(conversationID: conversationID)
        } catch {
            errorMessage = ErrorMessage.text(for: error)
        }
    }

    func receipts(conversationID: UUID, messageID: UUID) -> [MessageReceipt] {
        messageReceipts[conversationID]?[messageID] ?? []
    }

    func reactions(conversationID: UUID, messageID: UUID) -> [MessageReaction] {
        messageReactions[conversationID]?[messageID] ?? []
    }

    func typing(conversationID: UUID) -> [TypingParticipant] {
        typingParticipants[conversationID] ?? []
    }

    func markNotificationRead(id: UUID) async {
        do {
            notificationFeed = try await service.markNotificationRead(id: id)
            await refreshArchivedNotifications()
            await synchronizeExternalCounters()
        } catch {
            errorMessage = ErrorMessage.text(for: error)
        }
    }

    func markNotificationsRead() async {
        do {
            notificationFeed = try await service.markAllNotificationsRead()
            await refreshArchivedNotifications()
            await synchronizeExternalCounters()
        } catch {
            errorMessage = ErrorMessage.text(for: error)
        }
    }

    func consumeNotifications(entityType: String, entityID: UUID) async {
        do {
            notificationFeed = try await service.consumeNotifications(
                entityType: entityType,
                entityID: entityID
            )
            await refreshArchivedNotifications()
            await synchronizeExternalCounters()
        } catch {
            // La lecture de la destination reste prioritaire sur l’archivage visuel.
        }
    }

    func refreshArchivedNotifications() async {
        if let feed = try? await service.archivedNotifications() {
            archivedNotificationFeed = feed
        }
    }

    func viewHistory(for profileID: UUID) -> ProfileViewHistory? {
        engagementState.views.first(where: { $0.viewedProfileId == profileID })
    }

    func profileReactionValue(for profileID: UUID) -> Int? {
        engagementState.reactions.first(where: { $0.targetProfileId == profileID })?.reaction
    }

    func setProfileReaction(profileID: UUID, reaction: Int?) async {
        do {
            apply(try await service.setProfileReactionState(
                profileID: profileID,
                reaction: reaction
            ))
        } catch {
            errorMessage = ErrorMessage.text(for: error)
        }
    }

    func photoReaction(for mediaID: UUID) -> String? {
        photoReactions[mediaID]?.myReaction
    }

    func setPhotoReaction(mediaID: UUID, reaction: String?) async {
        do {
            if let summary = try await service.setPhotoReaction(
                mediaID: mediaID,
                reaction: reaction
            ) {
                photoReactions[mediaID] = summary
            }
            await refreshMessaging()
        } catch {
            errorMessage = ErrorMessage.text(for: error)
        }
    }

    private func refreshDirectoryOnly() async {
        if let refreshed = try? await service.directory() {
            directory = refreshed
            loadIssue = nil
        }
    }

    private func markVisibleMessagesDelivered() async {
        let unread = (directory?.conversations ?? []).filter { ($0.unreadCount ?? 0) > 0 }
        await withTaskGroup(of: Void.self) { group in
            for conversation in unread {
                group.addTask { [service] in
                    try? await service.markConversationDelivered(conversationID: conversation.id)
                }
            }
        }
    }

    private func apply(_ engagement: EngagementResponse) {
        engagementState = engagement
        conversationStreaks = Dictionary(
            uniqueKeysWithValues: engagement.streaks.map { ($0.conversationId, $0) }
        )
    }

    private func synchronizeExternalCounters() async {
        try? await UNUserNotificationCenter.current().setBadgeCount(notificationFeed.unreadCount)
        VelvetNotificationSnapshotStore.persist(
            feed: notificationFeed,
            unreadMessages: unreadMessageCount
        )
    }

    private static func uuidDictionary<Value>(_ source: [String: Value]?) -> [UUID: Value] {
        guard let source else { return [:] }
        return source.reduce(into: [:]) { result, item in
            guard let id = UUID(uuidString: item.key) else { return }
            result[id] = item.value
        }
    }
}

private enum EngagementDate {
    static func date(_ value: String?) -> Date {
        guard let value else { return .distantPast }
        return ISO8601DateFormatter.velvetWithFractional.date(from: value)
            ?? ISO8601DateFormatter.velvetBasic.date(from: value)
            ?? .distantPast
    }
}

private extension ISO8601DateFormatter {
    static let velvetWithFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static let velvetBasic: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
}

private extension NumberFormatter {
    static func velvetInteger(_ value: Int?) -> Int {
        value ?? 0
    }
}
