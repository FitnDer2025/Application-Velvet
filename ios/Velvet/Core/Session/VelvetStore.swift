import Combine
import Foundation
import UserNotifications

@MainActor
final class VelvetStore: ObservableObject {
    @Published private(set) var directory: DirectoryResponse?
    @Published private(set) var notificationFeed = NotificationFeed(notifications: [], unreadCount: 0)
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
    @Published private(set) var photoReactions: [UUID: PhotoReactionSummary] = [:]
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    let service: SessionService

    var unreadMessageCount: Int {
        directory?.messageUnreadCount
            ?? directory?.conversations.reduce(0) {
                $0 + NumberFormatter.velvetInteger($1.unreadCount)
            }
            ?? 0
    }

    init(service: SessionService = SessionService()) {
        self.service = service
    }

    func load() async {
        isLoading = true
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
            await synchronizeSystemBadge()
        } catch {
            errorMessage = ErrorMessage.text(for: error)
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
            await synchronizeSystemBadge()
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
            await refreshMessaging()
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

    func markNotificationRead(id: UUID) async {
        do {
            notificationFeed = try await service.markNotificationRead(id: id)
            await synchronizeSystemBadge()
        } catch {
            errorMessage = ErrorMessage.text(for: error)
        }
    }

    func markNotificationsRead() async {
        do {
            notificationFeed = try await service.markAllNotificationsRead()
            await synchronizeSystemBadge()
        } catch {
            errorMessage = ErrorMessage.text(for: error)
        }
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

    private func apply(_ engagement: EngagementResponse) {
        engagementState = engagement
        conversationStreaks = Dictionary(
            uniqueKeysWithValues: engagement.streaks.map { ($0.conversationId, $0) }
        )
    }

    private func synchronizeSystemBadge() async {
        try? await UNUserNotificationCenter.current().setBadgeCount(notificationFeed.unreadCount)
    }
}

private extension NumberFormatter {
    static func velvetInteger(_ value: Int?) -> Int {
        value ?? 0
    }
}
