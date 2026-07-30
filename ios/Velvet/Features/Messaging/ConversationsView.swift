import SwiftUI

struct ConversationsView: View {
    @EnvironmentObject private var store: VelvetStore

    var body: some View {
        ZStack {
            VelvetBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VelvetPageHeader(
                        "Conversations privées et salons",
                        title: "Messages",
                        subtitle: "Des échanges confidentiels avec les membres et les communautés Velvet."
                    )

                    if store.directory?.locked == true {
                        LockedDirectoryView()
                    } else if store.directory?.conversations.isEmpty != false {
                        VelvetEmptyState(
                            symbol: "bubble.left.and.bubble.right",
                            title: "Aucune conversation",
                            message: "Écris depuis un profil ou rejoins un Salon Velvet lié à une sortie."
                        )
                    } else {
                        LazyVStack(spacing: 12) {
                            ForEach(store.directory?.conversations ?? []) { conversation in
                                NavigationLink {
                                    ConversationView(
                                        conversationID: conversation.id,
                                        title: conversation.title
                                    )
                                } label: {
                                    ConversationTile(conversation: conversation)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 24)
                .padding(.bottom, 28)
            }
            .refreshable { await store.load() }
        }
        .toolbar(.hidden, for: .navigationBar)
    }
}

private struct ConversationTile: View {
    let conversation: Conversation

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: conversation.kind == "event" ? "person.3.fill" : "bubble.left.fill")
                .font(.system(size: 16))
                .foregroundStyle(VelvetColor.champagneGold)
                .frame(width: 48, height: 48)
                .background(VelvetColor.velvetBurgundy.opacity(0.20))
                .clipShape(Circle())
                .overlay(Circle().stroke(VelvetColor.champagneGold.opacity(0.18), lineWidth: 1))

            VStack(alignment: .leading, spacing: 5) {
                Text(conversation.title)
                    .font(VelvetTypography.body(size: 15, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                Text(conversation.kind == "event" ? "SALON VELVET" : "ÉCHANGE PRIVÉ")
                    .font(VelvetTypography.caption(size: 9, weight: .semibold))
                    .tracking(1.1)
                    .foregroundStyle(VelvetColor.champagneGold)
            }
            Spacer()
            Image(systemName: "arrow.right")
                .font(.caption)
                .foregroundStyle(VelvetColor.textSecondary)
        }
        .padding(16)
        .background(VelvetColor.panelRaised.opacity(0.72))
        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous)
                .stroke(VelvetColor.borderSubtle, lineWidth: 1)
        }
    }
}

struct ConversationView: View {
    @EnvironmentObject private var store: VelvetStore
    let conversationID: UUID
    let title: String

    @State private var draft = ""
    @State private var isSending = false

    var body: some View {
        ZStack {
            VelvetBackground()
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: VelvetSpacing.sm) {
                            ForEach(store.messages[conversationID] ?? []) { message in
                                MessageBubble(message: message)
                                    .id(message.id)
                            }
                        }
                        .padding(VelvetSpacing.md)
                    }
                    .onChange(of: store.messages[conversationID]?.count) { _, _ in
                        if let id = store.messages[conversationID]?.last?.id {
                            withAnimation { proxy.scrollTo(id, anchor: .bottom) }
                        }
                    }
                }

                HStack(alignment: .bottom, spacing: VelvetSpacing.sm) {
                    TextField("Un message respectueux…", text: $draft, axis: .vertical)
                        .lineLimit(1...5)
                        .padding(.horizontal, VelvetSpacing.md)
                        .padding(.vertical, 11)
                        .background(.white.opacity(0.07))
                        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.medium))

                    Button {
                        Task { await send() }
                    } label: {
                        Image(systemName: "arrow.up")
                            .font(.system(size: 17, weight: .bold))
                            .frame(width: 44, height: 44)
                            .foregroundStyle(.white)
                            .background(VelvetColor.velvetBurgundy)
                            .clipShape(Circle())
                    }
                    .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending)
                }
                .padding(VelvetSpacing.md)
                .background(.ultraThinMaterial)
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(VelvetColor.velvetBlack.opacity(0.92), for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .task { await store.refreshMessages(conversationID: conversationID) }
        .refreshable { await store.refreshMessages(conversationID: conversationID) }
    }

    @MainActor
    private func send() async {
        let message = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty else { return }
        isSending = true
        if await store.send(message, conversationID: conversationID) {
            draft = ""
        }
        isSending = false
    }
}

private struct MessageBubble: View {
    let message: DirectoryMessage

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let identity = message.senderIdentity {
                Text(identity)
                    .font(VelvetTypography.caption(size: 10, weight: .semibold))
                    .foregroundStyle(VelvetColor.champagneGold)
            }
            if let body = message.body {
                Text(body)
                    .font(VelvetTypography.body(size: 15))
                    .foregroundStyle(VelvetColor.ivory)
            }
        }
        .padding(.horizontal, VelvetSpacing.md)
        .padding(.vertical, VelvetSpacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.white.opacity(0.055))
        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.medium))
    }
}
