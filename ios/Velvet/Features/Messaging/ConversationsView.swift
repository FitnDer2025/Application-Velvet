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
                        subtitle: "Retrouve immédiatement qui t’écrit et les échanges qui attendent ta réponse."
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
            .refreshable { await store.refreshMessaging() }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(15))
                guard !Task.isCancelled else { return }
                await store.refreshMessaging()
            }
        }
    }
}

private struct ConversationTile: View {
    let conversation: Conversation

    private var unread: Int { conversation.unreadCount ?? 0 }

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                if conversation.kind != "event", let url = conversation.participantPhotoUrl {
                    AsyncImage(url: url) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        avatarPlaceholder
                    }
                } else {
                    avatarPlaceholder
                }
            }
            .frame(width: 56, height: 56)
            .clipShape(Circle())
            .overlay(Circle().stroke(
                unread > 0 ? VelvetColor.champagneGold.opacity(0.65) : VelvetColor.borderSubtle,
                lineWidth: unread > 0 ? 2 : 1
            ))

            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    Text(conversation.title)
                        .font(VelvetTypography.body(size: 15, weight: unread > 0 ? .bold : .semibold))
                        .foregroundStyle(VelvetColor.ivory)
                        .lineLimit(1)
                    Spacer()
                    if unread > 0 {
                        Text(unread > 99 ? "99+" : "\(unread)")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(VelvetColor.velvetBlack)
                            .frame(minWidth: 24, minHeight: 24)
                            .padding(.horizontal, unread > 9 ? 4 : 0)
                            .background(VelvetColor.champagneGold)
                            .clipShape(Capsule())
                    }
                }

                Text(conversation.lastMessageBody ?? (conversation.kind == "event" ? "Salon Velvet" : "Nouvelle conversation"))
                    .font(VelvetTypography.body(size: 12, weight: unread > 0 ? .semibold : .regular))
                    .foregroundStyle(unread > 0 ? VelvetColor.ivory.opacity(0.88) : VelvetColor.textSecondary)
                    .lineLimit(2)

                Text(conversation.kind == "event" ? "SALON VELVET" : "ÉCHANGE PRIVÉ")
                    .font(VelvetTypography.caption(size: 8, weight: .semibold))
                    .tracking(1.1)
                    .foregroundStyle(VelvetColor.champagneGold)
            }

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(VelvetColor.textSecondary)
        }
        .padding(16)
        .background(unread > 0 ? VelvetColor.velvetBurgundy.opacity(0.14) : VelvetColor.panelRaised.opacity(0.72))
        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous)
                .stroke(
                    unread > 0 ? VelvetColor.champagneGold.opacity(0.24) : VelvetColor.borderSubtle,
                    lineWidth: 1
                )
        }
    }

    private var avatarPlaceholder: some View {
        ZStack {
            VelvetColor.velvetBurgundy.opacity(0.22)
            Image(systemName: conversation.kind == "event" ? "person.3.fill" : "person.crop.circle.fill")
                .font(.system(size: 22, weight: .light))
                .foregroundStyle(VelvetColor.champagneGold)
        }
    }
}

struct ConversationView: View {
    @EnvironmentObject private var store: VelvetStore
    let conversationID: UUID
    let title: String

    @State private var draft = ""
    @State private var isSending = false
    @FocusState private var composerFocused: Bool

    private var currentUserID: UUID? { store.directory?.currentUserId }

    var body: some View {
        ZStack {
            VelvetBackground()
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            ForEach(store.messages[conversationID] ?? []) { message in
                                MessageBubble(
                                    message: message,
                                    isMine: message.senderUserId == currentUserID
                                )
                                .id(message.id)
                            }
                        }
                        .padding(.horizontal, VelvetSpacing.md)
                        .padding(.vertical, 18)
                    }
                    .scrollDismissesKeyboard(.interactively)
                    .onChange(of: store.messages[conversationID]?.count) { _, _ in
                        scrollToBottom(proxy)
                    }
                    .onAppear { scrollToBottom(proxy, animated: false) }
                }

                composer
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(VelvetColor.velvetBlack.opacity(0.92), for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .task {
            await store.refreshMessages(conversationID: conversationID)
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(8))
                guard !Task.isCancelled else { return }
                await store.refreshMessages(conversationID: conversationID)
            }
        }
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 10) {
            ZStack(alignment: .topLeading) {
                if draft.isEmpty {
                    Text("Un message respectueux…")
                        .font(VelvetTypography.body(size: 15))
                        .foregroundStyle(VelvetColor.textSecondary.opacity(0.72))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                        .allowsHitTesting(false)
                }

                TextEditor(text: $draft)
                    .focused($composerFocused)
                    .font(VelvetTypography.body(size: 15))
                    .foregroundStyle(VelvetColor.ivory)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 48, maxHeight: 126)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Color.clear)
            }
            .background(VelvetColor.ivory.opacity(0.065))
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(VelvetColor.borderSubtle, lineWidth: 1)
            }

            Button {
                Task { await send() }
            } label: {
                ZStack {
                    Circle()
                        .fill(
                            draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                ? VelvetColor.velourGray
                                : VelvetColor.velvetBurgundy
                        )
                    if isSending {
                        ProgressView().tint(.white)
                    } else {
                        Image(systemName: "paperplane.fill")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(.white)
                            .offset(x: -1)
                    }
                }
                .frame(width: 48, height: 48)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Envoyer le message")
            .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending)
        }
        .padding(.horizontal, VelvetSpacing.md)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
        .background(VelvetColor.velvetBlack.opacity(0.76))
        .overlay(alignment: .top) {
            Rectangle().fill(VelvetColor.borderSubtle).frame(height: 1)
        }
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

    private func scrollToBottom(_ proxy: ScrollViewProxy, animated: Bool = true) {
        guard let id = store.messages[conversationID]?.last?.id else { return }
        if animated {
            withAnimation(.easeOut(duration: VelvetMotion.normal)) {
                proxy.scrollTo(id, anchor: .bottom)
            }
        } else {
            proxy.scrollTo(id, anchor: .bottom)
        }
    }
}

private struct MessageBubble: View {
    let message: DirectoryMessage
    let isMine: Bool

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            if isMine { Spacer(minLength: 58) }

            VStack(alignment: isMine ? .trailing : .leading, spacing: 5) {
                if !isMine, let identity = message.senderIdentity, !identity.isEmpty {
                    Text(identity)
                        .font(VelvetTypography.caption(size: 9, weight: .semibold))
                        .foregroundStyle(VelvetColor.champagneGold)
                        .padding(.horizontal, 4)
                }

                if let body = message.body, !body.isEmpty {
                    Text(body)
                        .font(VelvetTypography.body(size: 15))
                        .foregroundStyle(VelvetColor.ivory)
                        .multilineTextAlignment(.leading)
                        .textSelection(.enabled)
                        .padding(.horizontal, 15)
                        .padding(.vertical, 11)
                        .background(
                            isMine
                                ? VelvetColor.velvetBurgundy
                                : VelvetColor.panelRaised
                        )
                        .clipShape(
                            UnevenRoundedRectangle(
                                topLeadingRadius: 18,
                                bottomLeadingRadius: isMine ? 18 : 5,
                                bottomTrailingRadius: isMine ? 5 : 18,
                                topTrailingRadius: 18,
                                style: .continuous
                            )
                        )
                        .overlay {
                            UnevenRoundedRectangle(
                                topLeadingRadius: 18,
                                bottomLeadingRadius: isMine ? 18 : 5,
                                bottomTrailingRadius: isMine ? 5 : 18,
                                topTrailingRadius: 18,
                                style: .continuous
                            )
                            .stroke(
                                isMine ? VelvetColor.burgundyLight.opacity(0.32) : VelvetColor.borderSubtle,
                                lineWidth: 1
                            )
                        }
                }
            }
            .frame(maxWidth: 310, alignment: isMine ? .trailing : .leading)

            if !isMine { Spacer(minLength: 58) }
        }
        .frame(maxWidth: .infinity)
    }
}
