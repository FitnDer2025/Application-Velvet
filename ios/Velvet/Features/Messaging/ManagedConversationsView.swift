import SwiftUI

struct ManagedConversationsView: View {
    @EnvironmentObject private var store: VelvetStore

    @State private var conversationToRemove: Conversation?
    @State private var isRemoving = false

    private var conversations: [Conversation] {
        (store.directory?.conversations ?? []).sorted {
            messageDate($0.lastMessageAt ?? $0.updatedAt) > messageDate($1.lastMessageAt ?? $1.updatedAt)
        }
    }

    var body: some View {
        ZStack {
            VelvetBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VelvetPageHeader(
                        "Vos échanges",
                        title: "Messages",
                        subtitle: "Accusés de lecture, réactions, pièces jointes et contrôle de vos conversations."
                    )

                    if conversations.isEmpty {
                        VelvetEmptyState(
                            symbol: "bubble.left.and.bubble.right",
                            title: "Aucune conversation",
                            message: "Écrivez depuis un profil ou rejoignez un Salon Zwit lié à une sortie."
                        )
                    } else {
                        LazyVStack(spacing: 10) {
                            ForEach(conversations) { conversation in
                                HStack(spacing: 8) {
                                    NavigationLink {
                                        RealtimeAppleConversationView(conversation: conversation)
                                    } label: {
                                        ManagedConversationRow(conversation: conversation)
                                    }
                                    .buttonStyle(.plain)

                                    Menu {
                                        Button(role: .destructive) {
                                            conversationToRemove = conversation
                                        } label: {
                                            Label("Supprimer de mes conversations", systemImage: "trash")
                                        }
                                    } label: {
                                        Image(systemName: "ellipsis")
                                            .font(.system(size: 16, weight: .semibold))
                                            .foregroundStyle(VelvetColor.textSecondary)
                                            .frame(width: 42, height: 42)
                                            .background(.ultraThinMaterial)
                                            .clipShape(Circle())
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .padding(.bottom, 28)
            }
            .refreshable { await store.refreshMessaging() }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task { await pollConversations() }
        .confirmationDialog(
            "Supprimer cette conversation ?",
            isPresented: Binding(
                get: { conversationToRemove != nil },
                set: { if !$0 { conversationToRemove = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Supprimer de ma messagerie", role: .destructive) {
                Task { await removeSelectedConversation() }
            }
            Button("Annuler", role: .cancel) { conversationToRemove = nil }
        } message: {
            Text("La conversation disparaît uniquement de votre espace. Elle reste disponible pour l’autre membre et pourra réapparaître si vous le contactez à nouveau.")
        }
        .overlay {
            if isRemoving {
                ProgressView()
                    .tint(VelvetColor.champagneGold)
                    .padding(24)
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            }
        }
    }

    @MainActor
    private func removeSelectedConversation() async {
        guard let conversation = conversationToRemove else { return }
        isRemoving = true
        defer {
            isRemoving = false
            conversationToRemove = nil
        }
        do {
            _ = try await store.service.removeConversation(id: conversation.id)
            await store.load()
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }

    private func pollConversations() async {
        await store.refreshMessaging()
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(8))
            guard !Task.isCancelled else { return }
            await store.refreshMessaging()
        }
    }

    private func messageDate(_ value: String?) -> Date {
        guard let value else { return .distantPast }
        return ISO8601DateFormatter().date(from: value) ?? .distantPast
    }
}

private struct ManagedConversationRow: View {
    @EnvironmentObject private var store: VelvetStore
    let conversation: Conversation

    private var unread: Int { conversation.unreadCount ?? 0 }
    private var streak: ConversationStreak? { store.conversationStreaks[conversation.id] }

    var body: some View {
        HStack(spacing: 13) {
            VelvetRemoteImage(
                url: conversation.participantPhotoUrl,
                symbol: conversation.kind == "event" ? "person.3.fill" : "person.crop.circle"
            )
            .frame(width: 54, height: 54)
            .clipped()
            .clipShape(Circle())
            .overlay(Circle().stroke(VelvetColor.borderSubtle, lineWidth: 0.8))

            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 7) {
                    Text(conversation.title)
                        .font(.system(size: 16, weight: unread > 0 ? .bold : .semibold))
                        .foregroundStyle(VelvetColor.ivory)
                        .lineLimit(1)
                    if let streak, streak.currentStreak > 0 {
                        Label("\(streak.currentStreak)", systemImage: "flame.fill")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(VelvetColor.champagneGold)
                    }
                    Spacer()
                    if unread > 0 {
                        Text(unread > 99 ? "99+" : "\(unread)")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, unread > 9 ? 6 : 0)
                            .frame(minWidth: 22, minHeight: 22)
                            .background(VelvetColor.danger)
                            .clipShape(Capsule())
                    }
                }
                Text(conversation.lastMessageBody ?? "Commencez la conversation…")
                    .font(.system(size: 13, weight: unread > 0 ? .semibold : .regular))
                    .foregroundStyle(unread > 0 ? VelvetColor.ivory : VelvetColor.textSecondary)
                    .lineLimit(2)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.ultraThinMaterial)
        .background(unread > 0 ? VelvetColor.velvetBurgundy.opacity(0.16) : VelvetColor.anthracite.opacity(0.60))
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(unread > 0 ? VelvetColor.champagneGold.opacity(0.24) : VelvetColor.borderSubtle, lineWidth: 0.8)
        }
    }
}
