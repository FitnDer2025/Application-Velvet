import Combine
import Foundation

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
    @Published private(set) var mapData: MemberMapResponse?
    @Published private(set) var messages: [UUID: [DirectoryMessage]] = [:]
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    let service: SessionService

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
        } catch {
            errorMessage = ErrorMessage.text(for: error)
        }
    }

    func refreshMessages(conversationID: UUID) async {
        do {
            messages[conversationID] = try await service.messages(
                conversationID: conversationID
            ).messages
        } catch {
            errorMessage = ErrorMessage.text(for: error)
        }
    }

    func send(_ body: String, conversationID: UUID) async -> Bool {
        do {
            let message = try await service.sendMessage(body, conversationID: conversationID)
            messages[conversationID, default: []].append(message)
            return true
        } catch {
            errorMessage = ErrorMessage.text(for: error)
            return false
        }
    }

    func markNotificationsRead() async {
        do {
            notificationFeed = try await service.markAllNotificationsRead()
        } catch {
            errorMessage = ErrorMessage.text(for: error)
        }
    }
}
