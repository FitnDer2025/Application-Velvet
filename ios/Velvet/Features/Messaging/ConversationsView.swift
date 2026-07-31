import SwiftUI

struct ConversationsView: View {
    @EnvironmentObject private var store: VelvetStore

    private var conversations: [Conversation] {
        (store.directory?.conversations ?? []).sorted {
            MessageDate.date($0.lastMessageAt ?? $0.updatedAt)
                > MessageDate.date($1.lastMessageAt ?? $1.updatedAt)
        }
    }

    var body: some View {
        ZStack {
            VelvetBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VelvetPageHeader(
                        "Conversations privées et salons",
                        title: "Messages",
                        subtitle: "Retrouve immédiatement qui t’écrit, le dernier échange et les messages qui attendent ta lecture."
                    )

                    if store.directory?.locked == true {
                        LockedDirectoryView()
                    } else if conversations.isEmpty {
                        VelvetEmptyState(
                            symbol: "bubble.left.and.bubble.right",
                            title: "Aucune conversation",
                            message: "Écris depuis un profil ou rejoins un Salon Velvet lié à une sortie."
                        )
                    } else {
                        LazyVStack(spacing: 12) {
                            ForEach(conversations) { conversation in
                                NavigationLink {
                                    ConversationView(conversation: conversation)
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
            await store.refreshMessaging()
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
            ConversationAvatar(
                url: conversation.participantPhotoUrl,
                name: conversation.title,
                isEvent: conversation.kind == "event",
                size: 58
            )

            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(conversation.title)
                        .font(VelvetTypography.body(size: 16, weight: unread > 0 ? .bold : .semibold))
                        .foregroundStyle(VelvetColor.ivory)
                        .lineLimit(1)
                    Spacer(minLength: 8)
                    Text(MessageDate.short(conversation.lastMessageAt ?? conversation.updatedAt))
                        .font(VelvetTypography.caption(size: 9))
                        .foregroundStyle(unread > 0 ? VelvetColor.champagneGold : VelvetColor.textSecondary)
                }

                Text(conversation.lastMessageBody ?? "Commencez la conversation…")
                    .font(VelvetTypography.body(size: 12, weight: unread > 0 ? .semibold : .regular))
                    .foregroundStyle(unread > 0 ? VelvetColor.ivory : VelvetColor.textSecondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                HStack(spacing: 7) {
                    Text(conversation.kind == "event" ? "SALON VELVET" : "ÉCHANGE PRIVÉ")
                        .font(VelvetTypography.caption(size: 8, weight: .semibold))
                        .tracking(1.1)
                        .foregroundStyle(VelvetColor.champagneGold)
                    Spacer()
                    if unread > 0 {
                        Text(unread > 99 ? "99+" : "\(unread)")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                            .padding(.horizontal, unread > 9 ? 7 : 0)
                            .frame(minWidth: 23, minHeight: 23)
                            .background(VelvetColor.burgundyLight)
                            .clipShape(Capsule())
                            .accessibilityLabel("\(unread) messages non lus")
                    }
                }
            }
        }
        .padding(16)
        .background {
            LinearGradient(
                colors: [
                    unread > 0
                        ? VelvetColor.velvetBurgundy.opacity(0.20)
                        : VelvetColor.panelRaised.opacity(0.78),
                    VelvetColor.anthracite.opacity(0.82)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous)
                .stroke(unread > 0 ? VelvetColor.champagneGold.opacity(0.26) : VelvetColor.borderSubtle, lineWidth: 1)
        }
    }
}

struct ConversationView: View {
    @EnvironmentObject private var store: VelvetStore
    let conversation: Conversation

    @State private var draft = ""
    @State private var isSending = false
    @FocusState private var composerFocused: Bool

    private var messages: [DirectoryMessage] {
        store.messages[conversation.id] ?? []
    }

    private var composerHeight: CGFloat {
        let lineCount = max(1, draft.components(separatedBy: .newlines).count)
        return min(116, max(44, CGFloat(lineCount) * 22 + 20))
    }

    var body: some View {
        ZStack {
            VelvetBackground()
            VStack(spacing: 0) {
                conversationHeader

                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            if messages.isEmpty {
                                VelvetCompactEmptyState(
                                    symbol: "bubble.left.and.bubble.right",
                                    title: "Commencez l’échange",
                                    message: "Les messages restent privés entre les membres de cette conversation."
                                )
                                .padding(.top, 24)
                            } else {
                                ForEach(messages) { message in
                                    MessageBubble(
                                        message: message,
                                        isMine: message.senderUserId == store.directory?.currentUserId
                                    )
                                    .id(message.id)
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 18)
                    }
                    .scrollDismissesKeyboard(.interactively)
                    .onChange(of: messages.count) { _, _ in
                        if let id = messages.last?.id {
                            withAnimation(.easeOut(duration: VelvetMotion.normal)) {
                                proxy.scrollTo(id, anchor: .bottom)
                            }
                        }
                    }
                    .onAppear {
                        if let id = messages.last?.id {
                            proxy.scrollTo(id, anchor: .bottom)
                        }
                    }
                }

                composer
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(VelvetColor.velvetBlack.opacity(0.95), for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .task {
            await store.refreshMessages(conversationID: conversation.id)
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(8))
                guard !Task.isCancelled else { return }
                await store.refreshMessages(conversationID: conversation.id)
            }
        }
    }

    private var conversationHeader: some View {
        HStack(spacing: 12) {
            ConversationAvatar(
                url: conversation.participantPhotoUrl,
                name: conversation.title,
                isEvent: conversation.kind == "event",
                size: 48
            )
            VStack(alignment: .leading, spacing: 3) {
                Text(conversation.title)
                    .font(VelvetTypography.body(size: 17, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                    .lineLimit(1)
                Text(conversation.kind == "event" ? "SALON VELVET" : "CONVERSATION PRIVÉE")
                    .font(VelvetTypography.caption(size: 8, weight: .semibold))
                    .tracking(1.2)
                    .foregroundStyle(VelvetColor.champagneGold)
            }
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 11)
        .background(VelvetColor.anthracite.opacity(0.86))
        .overlay(alignment: .bottom) {
            Rectangle().fill(VelvetColor.borderSubtle).frame(height: 1)
        }
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 10) {
            ZStack(alignment: .topLeading) {
                if draft.isEmpty {
                    Text("Écrire un message…")
                        .font(VelvetTypography.body(size: 15))
                        .foregroundStyle(VelvetColor.textSecondary.opacity(0.72))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 13)
                        .allowsHitTesting(false)
                }

                TextEditor(text: $draft)
                    .focused($composerFocused)
                    .font(VelvetTypography.body(size: 15))
                    .foregroundStyle(VelvetColor.ivory)
                    .scrollContentBackground(.hidden)
                    .padding(.horizontal, 11)
                    .padding(.vertical, 5)
                    .frame(height: composerHeight)
                    .background(Color.clear)
                    .accessibilityLabel("Message")
                    .accessibilityHint("La touche retour crée une nouvelle ligne. Utilise Envoyer pour transmettre le message.")
            }
            .background(VelvetColor.ivory.opacity(0.055))
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(VelvetColor.borderSubtle, lineWidth: 1)
            }

            Button {
                Task { await send() }
            } label: {
                HStack(spacing: 6) {
                    if isSending {
                        ProgressView().tint(.white)
                    } else {
                        Image(systemName: "paperplane.fill")
                            .font(.system(size: 13, weight: .semibold))
                    }
                    Text("Envoyer")
                        .font(VelvetTypography.caption(size: 11, weight: .semibold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 14)
                .frame(height: 46)
                .background {
                    LinearGradient(
                        colors: [VelvetColor.burgundyLight, VelvetColor.velvetBurgundy],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                }
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending)
            .opacity(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.48 : 1)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
        .background(VelvetColor.velvetBlack.opacity(0.86))
        .overlay(alignment: .top) {
            Rectangle().fill(VelvetColor.borderSubtle).frame(height: 1)
        }
    }

    @MainActor
    private func send() async {
        let message = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty else { return }
        isSending = true
        if await store.send(message, conversationID: conversation.id) {
            draft = ""
            composerFocused = true
        }
        isSending = false
    }
}

private struct MessageBubble: View {
    let message: DirectoryMessage
    let isMine: Bool

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            if isMine { Spacer(minLength: 54) }

            VStack(alignment: isMine ? .trailing : .leading, spacing: 5) {
                if !isMine, let identity = message.senderIdentity, !identity.isEmpty {
                    Text(identity)
                        .font(VelvetTypography.caption(size: 9, weight: .semibold))
                        .foregroundStyle(VelvetColor.champagneGold)
                }

                if let body = message.body, !body.isEmpty {
                    Text(body)
                        .font(VelvetTypography.body(size: 15))
                        .foregroundStyle(isMine ? .white : VelvetColor.ivory)
                        .multilineTextAlignment(isMine ? .trailing : .leading)
                        .fixedSize(horizontal: false, vertical: true)
                }

                if let attachments = message.attachments, !attachments.isEmpty {
                    VStack(alignment: isMine ? .trailing : .leading, spacing: 7) {
                        ForEach(attachments) { attachment in
                            MessageAttachmentView(attachment: attachment)
                        }
                    }
                }

                Text(MessageDate.time(message.createdAt))
                    .font(VelvetTypography.caption(size: 8))
                    .foregroundStyle(isMine ? .white.opacity(0.68) : VelvetColor.textSecondary)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background {
                if isMine {
                    LinearGradient(
                        colors: [VelvetColor.burgundyLight, VelvetColor.velvetBurgundy],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                } else {
                    LinearGradient(
                        colors: [VelvetColor.panelRaised, VelvetColor.anthracite],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                }
            }
            .clipShape(
                UnevenRoundedRectangle(
                    topLeadingRadius: 19,
                    bottomLeadingRadius: isMine ? 19 : 5,
                    bottomTrailingRadius: isMine ? 5 : 19,
                    topTrailingRadius: 19,
                    style: .continuous
                )
            )
            .overlay {
                UnevenRoundedRectangle(
                    topLeadingRadius: 19,
                    bottomLeadingRadius: isMine ? 19 : 5,
                    bottomTrailingRadius: isMine ? 5 : 19,
                    topTrailingRadius: 19,
                    style: .continuous
                )
                .stroke(
                    isMine ? VelvetColor.burgundyLight.opacity(0.34) : VelvetColor.borderSubtle,
                    lineWidth: 1
                )
            }
            .frame(maxWidth: 290, alignment: isMine ? .trailing : .leading)

            if !isMine { Spacer(minLength: 54) }
        }
        .frame(maxWidth: .infinity)
    }
}

private struct MessageAttachmentView: View {
    let attachment: MessageAttachment

    var body: some View {
        Group {
            if attachment.mediaType == "image", let url = attachment.previewUrl {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    ProgressView().tint(VelvetColor.champagneGold)
                }
                .frame(width: 210, height: 170)
                .clipped()
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            } else if let url = attachment.previewUrl {
                Link(destination: url) {
                    Label(attachment.originalName ?? "Pièce jointe", systemImage: "doc.fill")
                        .font(VelvetTypography.caption(size: 11, weight: .semibold))
                        .foregroundStyle(VelvetColor.champagneGold)
                }
            }
        }
    }
}

private struct ConversationAvatar: View {
    let url: URL?
    let name: String
    let isEvent: Bool
    let size: CGFloat

    var body: some View {
        ZStack {
            if let url {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    placeholder
                }
            } else {
                placeholder
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(Circle().stroke(VelvetColor.champagneGold.opacity(0.24), lineWidth: 1))
    }

    private var placeholder: some View {
        ZStack {
            LinearGradient(
                colors: [VelvetColor.velvetBurgundy.opacity(0.55), VelvetColor.anthracite],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            if isEvent {
                Image(systemName: "person.3.fill")
                    .foregroundStyle(VelvetColor.champagneGold)
            } else {
                Text(String(name.prefix(1)).uppercased())
                    .font(VelvetTypography.title(size: size * 0.38))
                    .foregroundStyle(VelvetColor.champagneGold)
            }
        }
    }
}

private enum MessageDate {
    private static let isoWithFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let iso = ISO8601DateFormatter()

    static func date(_ value: String?) -> Date {
        guard let value else { return .distantPast }
        return isoWithFractional.date(from: value) ?? iso.date(from: value) ?? .distantPast
    }

    static func short(_ value: String?) -> String {
        let value = date(value)
        guard value != .distantPast else { return "" }
        if Calendar.current.isDateInToday(value) {
            return value.formatted(date: .omitted, time: .shortened)
        }
        return value.formatted(.dateTime.day().month(.abbreviated))
    }

    static func time(_ value: String?) -> String {
        let value = date(value)
        guard value != .distantPast else { return "" }
        return value.formatted(date: .omitted, time: .shortened)
    }
}
