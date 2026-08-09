import Foundation

/// Maintient la compatibilité avec les écrans qui ouvrent une conversation
/// immédiatement après sa création et ne possèdent encore que son identifiant.
extension ConversationView {
    init(conversationID: UUID, title: String) {
        self.init(
            conversation: Conversation(
                id: conversationID,
                kind: "direct",
                eventId: nil,
                subject: nil,
                createdAt: nil,
                updatedAt: nil,
                conversationMembers: nil,
                participantProfileId: nil,
                participantDisplayName: title,
                participantPhotoUrl: nil,
                lastMessageBody: nil,
                lastMessageAt: nil,
                unreadCount: 0
            )
        )
    }
}
