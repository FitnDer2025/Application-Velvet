import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

struct RealtimeAppleConversationsView: View {
    @EnvironmentObject private var store: VelvetStore

    private var conversations: [Conversation] {
        (store.directory?.conversations ?? []).sorted {
            RealtimeMessageDate.date($0.lastMessageAt ?? $0.updatedAt)
                > RealtimeMessageDate.date($1.lastMessageAt ?? $1.updatedAt)
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
                        subtitle: "Accusés de lecture, réactions, pièces jointes et identité de chaque personne."
                    )
                    conversationsContent
                }
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .padding(.bottom, 28)
            }
            .refreshable { await store.refreshMessaging() }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task { await pollConversations() }
    }

    @ViewBuilder
    private var conversationsContent: some View {
        if store.directory?.locked == true {
            LockedDirectoryView()
        } else if conversations.isEmpty {
            VelvetEmptyState(
                symbol: "bubble.left.and.bubble.right",
                title: "Aucune conversation",
                message: "Écris depuis un profil ou rejoins un Salon Zwit lié à une sortie."
            )
        } else {
            LazyVStack(spacing: 10) {
                ForEach(conversations) { conversation in
                    NavigationLink {
                        RealtimeAppleConversationView(conversation: conversation)
                    } label: {
                        RealtimeConversationTile(conversation: conversation)
                    }
                    .buttonStyle(.plain)
                }
            }
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
}

private struct RealtimeConversationTile: View {
    @EnvironmentObject private var store: VelvetStore
    let conversation: Conversation

    private var unread: Int { conversation.unreadCount ?? 0 }
    private var streak: ConversationStreak? { store.conversationStreaks[conversation.id] }

    var body: some View {
        HStack(spacing: 13) {
            RealtimeConversationAvatar(
                url: conversation.participantPhotoUrl,
                name: conversation.title,
                isEvent: conversation.kind == "event",
                size: 54
            )
            conversationSummary
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
        .background(.ultraThinMaterial)
        .background(tileBackground)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(tileBorder)
    }

    private var tileBackground: Color {
        unread > 0
            ? VelvetColor.velvetBurgundy.opacity(0.16)
            : VelvetColor.anthracite.opacity(0.60)
    }

    private var tileBorder: some View {
        RoundedRectangle(cornerRadius: 22, style: .continuous)
            .stroke(
                unread > 0 ? VelvetColor.champagneGold.opacity(0.24) : VelvetColor.borderSubtle,
                lineWidth: 0.8
            )
    }

    private var conversationSummary: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(conversation.title)
                    .font(.system(size: 16, weight: unread > 0 ? .bold : .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                    .lineLimit(1)
                streakLabel
                Spacer(minLength: 8)
                Text(RealtimeMessageDate.short(conversation.lastMessageAt ?? conversation.updatedAt))
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(unread > 0 ? VelvetColor.champagneGold : VelvetColor.textSecondary)
            }
            HStack(spacing: 8) {
                Text(conversation.lastMessageBody ?? "Commencez la conversation…")
                    .font(.system(size: 13, weight: unread > 0 ? .semibold : .regular))
                    .foregroundStyle(unread > 0 ? VelvetColor.ivory : VelvetColor.textSecondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 4)
                unreadBadge
            }
        }
    }

    @ViewBuilder
    private var streakLabel: some View {
        if let streak, streak.currentStreak > 0 {
            Label("\(streak.currentStreak)", systemImage: "flame.fill")
                .font(.system(size: 10, weight: .bold, design: .rounded))
                .foregroundStyle(VelvetColor.champagneGold)
        }
    }

    @ViewBuilder
    private var unreadBadge: some View {
        if unread > 0 {
            Text(unread > 99 ? "99+" : "\(unread)")
                .font(.system(size: 10, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .padding(.horizontal, unread > 9 ? 7 : 0)
                .frame(minWidth: 23, minHeight: 23)
                .background(VelvetColor.burgundyLight)
                .clipShape(Capsule())
        }
    }
}

struct RealtimeAppleConversationView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: VelvetStore
    @EnvironmentObject private var chrome: ShellChromeState
    let conversation: Conversation

    @State private var draft = ""
    @State private var composerIdentity = UUID()
    @State private var isSending = false
    @State private var isLoadingAttachments = false
    @State private var showsAttachmentMenu = false
    @State private var showsPhotoPicker = false
    @State private var showsDocumentPicker = false
    @State private var selectedPhotoItems: [PhotosPickerItem] = []
    @State private var outgoingAttachments: [OutgoingMessageAttachment] = []
    @State private var typingTask: Task<Void, Never>?
    @State private var fullScreenImage: URL?
    @FocusState private var composerFocused: Bool

    private var messages: [DirectoryMessage] {
        store.messages[conversation.id] ?? []
    }

    private var participantProfile: MemberProfile? {
        guard let id = conversation.participantProfileId else { return nil }
        return store.directory?.profiles.first(where: { $0.id == id })
    }

    private var streak: ConversationStreak? {
        store.conversationStreaks[conversation.id]
    }

    private var typing: [TypingParticipant] {
        store.typing(conversationID: conversation.id)
    }

    private var composerHeight: CGFloat {
        let lines = max(1, draft.components(separatedBy: .newlines).count)
        return min(112, max(40, CGFloat(lines) * 21 + 18))
    }

    private var canSend: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !outgoingAttachments.isEmpty
    }

    private var fullScreenBinding: Binding<Bool> {
        Binding(
            get: { fullScreenImage != nil },
            set: { visible in if !visible { fullScreenImage = nil } }
        )
    }

    var body: some View {
        conversationScreen
            .safeAreaInset(edge: .bottom, spacing: 0) { composer }
            .toolbar(.hidden, for: .navigationBar)
            .onAppear { chrome.isImmersive = true }
            .onDisappear { leaveConversation() }
            .task { await pollMessages() }
            .onChange(of: draft) { _, value in updateTyping(for: value) }
            .confirmationDialog("Ajouter une pièce jointe", isPresented: $showsAttachmentMenu) {
                attachmentActions
            }
            .photosPicker(
                isPresented: $showsPhotoPicker,
                selection: $selectedPhotoItems,
                maxSelectionCount: max(1, 4 - outgoingAttachments.count),
                matching: .any(of: [.images, .videos])
            )
            .fileImporter(
                isPresented: $showsDocumentPicker,
                allowedContentTypes: [.pdf],
                allowsMultipleSelection: true,
                onCompletion: handleDocumentImport
            )
            .onChange(of: selectedPhotoItems) { _, items in
                Task { await importPhotos(items) }
            }
            .fullScreenCover(isPresented: fullScreenBinding) {
                if let fullScreenImage {
                    RealtimeFullScreenAttachment(url: fullScreenImage)
                }
            }
    }

    private var conversationScreen: some View {
        ZStack {
            VelvetBackground()
            VStack(spacing: 0) {
                header
                messagesTimeline
            }
        }
    }

    private var messagesTimeline: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 7) {
                    messagesContent
                    typingContent
                }
                .padding(.horizontal, 12)
                .padding(.top, 12)
                .padding(.bottom, 16)
                .frame(maxWidth: .infinity, minHeight: 1, alignment: .bottom)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: messages.count) { _, _ in scrollToLatest(proxy) }
            .onChange(of: typing.count) { _, _ in scrollToLatest(proxy) }
            .onChange(of: composerFocused) { _, focused in
                if focused { scrollToLatest(proxy) }
            }
            .onAppear { scrollToLatest(proxy, animated: false) }
        }
    }

    @ViewBuilder
    private var messagesContent: some View {
        if messages.isEmpty {
            VelvetCompactEmptyState(
                symbol: "bubble.left.and.bubble.right",
                title: "Commencez l’échange",
                message: "Les messages et pièces jointes restent privés entre les membres de cette conversation."
            )
            .padding(.top, 30)
        } else {
            ForEach(Array(messages.enumerated()), id: \.element.id) { index, message in
                if index == 0 || !Calendar.current.isDate(
                    RealtimeMessageDate.date(messages[index - 1].createdAt),
                    inSameDayAs: RealtimeMessageDate.date(message.createdAt)
                ) {
                    RealtimeMessageDaySeparator(date: RealtimeMessageDate.date(message.createdAt))
                }
                messageBubble(for: message)
                    .id(message.id)
            }
        }
    }

    @ViewBuilder
    private var typingContent: some View {
        if !typing.isEmpty {
            RealtimeTypingBubble(participants: typing)
                .id("typing-indicator")
        }
    }

    private func messageBubble(for message: DirectoryMessage) -> some View {
        RealtimeMessageBubble(
            conversationID: conversation.id,
            message: message,
            isMine: message.senderUserId == store.directory?.currentUserId,
            receipts: store.receipts(conversationID: conversation.id, messageID: message.id),
            reactions: store.reactions(conversationID: conversation.id, messageID: message.id),
            currentUserID: store.directory?.currentUserId,
            openImage: { fullScreenImage = $0 }
        )
    }

    @ViewBuilder
    private var attachmentActions: some View {
        Button("Photo ou vidéo", systemImage: "photo.on.rectangle") {
            showsPhotoPicker = true
        }
        Button("Document PDF", systemImage: "doc.fill") {
            showsDocumentPicker = true
        }
        Button("Annuler", role: .cancel) {}
    }

    private var header: some View {
        HStack(spacing: 10) {
            Button { dismiss() } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(VelvetColor.champagneGold)
                    .frame(width: 38, height: 38)
                    .background(.ultraThinMaterial)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(VelvetColor.borderSubtle, lineWidth: 0.7))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Retour")
            identityDestination
            Spacer()
            streakBadge
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial)
        .background(VelvetColor.velvetBlack.opacity(0.76))
        .overlay(alignment: .bottom) {
            Rectangle().fill(VelvetColor.borderSubtle).frame(height: 0.5)
        }
    }

    @ViewBuilder
    private var identityDestination: some View {
        if let participantProfile {
            NavigationLink {
                MemberDetailView(profile: participantProfile)
            } label: {
                identityLabel
            }
            .buttonStyle(.plain)
        } else {
            identityLabel
        }
    }

    private var identityLabel: some View {
        HStack(spacing: 10) {
            RealtimeConversationAvatar(
                url: conversation.participantPhotoUrl,
                name: conversation.title,
                isEvent: conversation.kind == "event",
                size: 38
            )
            VStack(alignment: .leading, spacing: 1) {
                Text(conversation.title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                    .lineLimit(1)
                Text(typing.isEmpty ? defaultConversationSubtitle : typingLabel)
                    .font(.system(size: 10, weight: typing.isEmpty ? .medium : .semibold))
                    .foregroundStyle(typing.isEmpty ? VelvetColor.textSecondary : VelvetColor.champagneGold)
                    .lineLimit(1)
            }
        }
    }

    private var defaultConversationSubtitle: String {
        conversation.kind == "event" ? "Salon Zwit" : "Conversation privée"
    }

    private var typingLabel: String {
        let names = typing.map { $0.displayIdentity ?? "Un membre" }
        return "\(names.joined(separator: " et ")) \(names.count > 1 ? "écrivent" : "écrit")…"
    }

    @ViewBuilder
    private var streakBadge: some View {
        if let streak, streak.currentStreak > 0 {
            Label("\(streak.currentStreak)", systemImage: "flame.fill")
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundStyle(VelvetColor.champagneGold)
                .padding(.horizontal, 10)
                .frame(height: 36)
                .background(VelvetColor.champagneGold.opacity(0.07))
                .clipShape(Capsule())
        }
    }

    private var composer: some View {
        VStack(spacing: 7) {
            attachmentDrafts
            composerRow
        }
        .padding(.horizontal, 10)
        .padding(.top, 7)
        .padding(.bottom, 7)
        .background(.ultraThinMaterial)
        .background(VelvetColor.velvetBlack.opacity(0.82))
        .overlay(alignment: .top) {
            Rectangle().fill(VelvetColor.borderSubtle).frame(height: 0.5)
        }
    }

    @ViewBuilder
    private var attachmentDrafts: some View {
        if !outgoingAttachments.isEmpty || isLoadingAttachments {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    if isLoadingAttachments {
                        ProgressView()
                            .tint(VelvetColor.champagneGold)
                            .frame(width: 66, height: 54)
                    }
                    ForEach(outgoingAttachments) { attachment in
                        RealtimeAttachmentDraftChip(attachment: attachment) {
                            outgoingAttachments.removeAll { $0.id == attachment.id }
                        }
                    }
                }
            }
        }
    }

    private var composerRow: some View {
        HStack(alignment: .bottom, spacing: 8) {
            attachmentButton
            messageEditor
            sendButton
        }
    }

    private var attachmentButton: some View {
        Button { showsAttachmentMenu = true } label: {
            Group {
                if isLoadingAttachments {
                    ProgressView().tint(VelvetColor.champagneGold)
                } else {
                    Image(systemName: "plus")
                        .font(.system(size: 18, weight: .medium))
                }
            }
            .foregroundStyle(VelvetColor.champagneGold)
            .frame(width: 38, height: 38)
            .background(VelvetColor.ivory.opacity(0.04))
            .clipShape(Circle())
        }
        .buttonStyle(.plain)
        .disabled(isLoadingAttachments || outgoingAttachments.count >= 4)
    }

    private var messageEditor: some View {
        ZStack(alignment: .topLeading) {
            if draft.isEmpty {
                Text(outgoingAttachments.isEmpty ? "Message" : "Ajouter un message…")
                    .font(.system(size: 15))
                    .foregroundStyle(VelvetColor.textSecondary.opacity(0.72))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .allowsHitTesting(false)
            }
            TextEditor(text: $draft)
                .id(composerIdentity)
                .focused($composerFocused)
                .font(.system(size: 16))
                .foregroundStyle(VelvetColor.ivory)
                .scrollContentBackground(.hidden)
                .padding(.horizontal, 9)
                .padding(.vertical, 3)
                .frame(height: composerHeight)
                .background(Color.clear)
                .accessibilityLabel("Message")
        }
        .background(VelvetColor.ivory.opacity(0.055))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(VelvetColor.borderSubtle, lineWidth: 0.8)
        }
    }

    private var sendButton: some View {
        Button { Task { await send() } } label: {
            Group {
                if isSending {
                    ProgressView().tint(.white)
                } else {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 17, weight: .bold))
                }
            }
            .foregroundStyle(.white)
            .frame(width: 40, height: 40)
            .background(canSend ? VelvetColor.burgundyLight : VelvetColor.textSecondary.opacity(0.28))
            .clipShape(Circle())
        }
        .buttonStyle(.plain)
        .disabled(!canSend || isSending)
    }

    @MainActor
    private func send() async {
        let value = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty || !outgoingAttachments.isEmpty else { return }

        let messageToSend = value
        let attachmentsToSend = outgoingAttachments
        draft = ""
        outgoingAttachments = []
        composerIdentity = UUID()
        typingTask?.cancel()
        await store.setTyping(conversationID: conversation.id, active: false)
        isSending = true

        let sent = await store.send(
            messageToSend,
            conversationID: conversation.id,
            attachments: attachmentsToSend
        )
        if !sent {
            draft = messageToSend
            outgoingAttachments = attachmentsToSend
            composerIdentity = UUID()
        }
        isSending = false
        composerFocused = true
    }

    private func updateTyping(for value: String) {
        typingTask?.cancel()
        let active = !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        Task { await store.setTyping(conversationID: conversation.id, active: active) }
        guard active else { return }
        typingTask = Task {
            try? await Task.sleep(for: .seconds(4))
            guard !Task.isCancelled else { return }
            await store.setTyping(conversationID: conversation.id, active: false)
        }
    }

    private func leaveConversation() {
        chrome.isImmersive = false
        typingTask?.cancel()
        Task { await store.setTyping(conversationID: conversation.id, active: false) }
    }

    private func pollMessages() async {
        await store.refreshMessages(conversationID: conversation.id)
        while !Task.isCancelled {
            try? await Task.sleep(for: .milliseconds(2200))
            guard !Task.isCancelled else { return }
            await store.refreshMessages(conversationID: conversation.id)
        }
    }

    private func handleDocumentImport(_ result: Result<[URL], Error>) {
        Task { await importDocuments(result) }
    }

    @MainActor
    private func importPhotos(_ items: [PhotosPickerItem]) async {
        guard !items.isEmpty else { return }
        isLoadingAttachments = true
        defer {
            selectedPhotoItems = []
            isLoadingAttachments = false
        }

        do {
            for item in items.prefix(max(0, 4 - outgoingAttachments.count)) {
                guard let data = try await item.loadTransferable(type: Data.self) else { continue }
                let type = item.supportedContentTypes.first(where: {
                    $0.conforms(to: .image) || $0.conforms(to: .movie)
                })
                if type?.conforms(to: .movie) == true {
                    guard data.count <= 50 * 1024 * 1024 else {
                        throw RealtimeAttachmentImportError.tooLarge("La vidéo dépasse 50 Mo.")
                    }
                    let ext = type?.preferredFilenameExtension ?? "mov"
                    outgoingAttachments.append(OutgoingMessageAttachment(
                        data: data,
                        fileName: "video-\(UUID().uuidString).\(ext)",
                        mimeType: type?.preferredMIMEType ?? "video/quicktime",
                        mediaType: "video"
                    ))
                } else {
                    let compressed = try ImageCompressor.jpegData(from: data)
                    guard compressed.count <= 10 * 1024 * 1024 else {
                        throw RealtimeAttachmentImportError.tooLarge("La photo dépasse 10 Mo après compression.")
                    }
                    outgoingAttachments.append(OutgoingMessageAttachment(
                        data: compressed,
                        fileName: "photo-\(UUID().uuidString).jpg",
                        mimeType: "image/jpeg",
                        mediaType: "image"
                    ))
                }
            }
        } catch {
            store.errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func importDocuments(_ result: Result<[URL], Error>) async {
        do {
            let urls = try result.get()
            for url in urls.prefix(max(0, 4 - outgoingAttachments.count)) {
                let secured = url.startAccessingSecurityScopedResource()
                defer { if secured { url.stopAccessingSecurityScopedResource() } }
                let data = try Data(contentsOf: url)
                guard data.count <= 10 * 1024 * 1024 else {
                    throw RealtimeAttachmentImportError.tooLarge("Le PDF dépasse 10 Mo.")
                }
                outgoingAttachments.append(OutgoingMessageAttachment(
                    data: data,
                    fileName: url.lastPathComponent.isEmpty ? "document.pdf" : url.lastPathComponent,
                    mimeType: "application/pdf",
                    mediaType: "document"
                ))
            }
        } catch {
            store.errorMessage = error.localizedDescription
        }
    }

    private func scrollToLatest(_ proxy: ScrollViewProxy, animated: Bool = true) {
        let target: AnyHashable? = typing.isEmpty ? messages.last?.id : "typing-indicator"
        guard let target else { return }
        if animated {
            withAnimation(.easeOut(duration: 0.22)) {
                proxy.scrollTo(target, anchor: .bottom)
            }
        } else {
            proxy.scrollTo(target, anchor: .bottom)
        }
    }
}

private struct RealtimeMessageDaySeparator: View {
    let date: Date

    private var label: String {
        if Calendar.current.isDateInToday(date) { return "Aujourd’hui" }
        if Calendar.current.isDateInYesterday(date) { return "Hier" }
        return date.formatted(.dateTime.weekday(.wide).day().month(.wide).year())
    }

    var body: some View {
        HStack(spacing: 10) {
            Rectangle().fill(VelvetColor.borderSubtle).frame(height: 0.5)
            Text(label.capitalized)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(VelvetColor.textSecondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(.ultraThinMaterial)
                .clipShape(Capsule())
            Rectangle().fill(VelvetColor.borderSubtle).frame(height: 0.5)
        }
        .padding(.vertical, 8)
        .accessibilityLabel("Messages du \(label)")
    }
}

private struct RealtimeAttachmentDraftChip: View {
    let attachment: OutgoingMessageAttachment
    let remove: () -> Void

    var body: some View {
        HStack(spacing: 7) {
            Image(systemName: icon)
                .foregroundStyle(VelvetColor.champagneGold)
            Text(attachment.fileName)
                .font(.system(size: 10, weight: .semibold))
                .lineLimit(1)
            Button(action: remove) {
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(VelvetColor.textSecondary)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 10)
        .frame(height: 42)
        .background(VelvetColor.ivory.opacity(0.055))
        .clipShape(Capsule())
    }

    private var icon: String {
        switch attachment.mediaType {
        case "image": "photo.fill"
        case "video": "video.fill"
        default: "doc.fill"
        }
    }
}

private struct MessageReactionGroup: Identifiable {
    let reaction: String
    let count: Int
    let names: [String]
    var id: String { reaction }
}

private struct RealtimeMessageBubble: View {
    @EnvironmentObject private var store: VelvetStore
    let conversationID: UUID
    let message: DirectoryMessage
    let isMine: Bool
    let receipts: [MessageReceipt]
    let reactions: [MessageReaction]
    let currentUserID: UUID?
    let openImage: (URL) -> Void

    private let reactionChoices: [(key: String, emoji: String)] = [
        ("like", "👍"),
        ("love", "❤️"),
        ("laugh", "😂"),
        ("wow", "😮"),
        ("sad", "😢"),
        ("fire", "🔥")
    ]

    var body: some View {
        HStack(alignment: .bottom, spacing: 7) {
            if isMine { Spacer(minLength: 48) }
            messageColumn
            if !isMine { Spacer(minLength: 48) }
        }
        .frame(maxWidth: .infinity)
    }

    private var messageColumn: some View {
        VStack(alignment: isMine ? .trailing : .leading, spacing: 4) {
            senderIdentity
            messageSurface
            reactionsRow
            receiptsList
        }
    }

    @ViewBuilder
    private var senderIdentity: some View {
        if let identity = message.senderIdentity, !identity.isEmpty {
            Text(isMine ? "Vous · \(identity)" : identity)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(VelvetColor.champagneGold)
                .padding(.horizontal, 4)
        }
    }

    private var messageSurface: some View {
        VStack(alignment: isMine ? .trailing : .leading, spacing: 7) {
            messageBody
            attachmentsList
            timestamp
        }
        .padding(.horizontal, 13)
        .padding(.vertical, 9)
        .background(messageBackground)
        .clipShape(messageShape)
        .overlay(messageShape.stroke(messageBorder, lineWidth: 0.8))
        .frame(maxWidth: 300, alignment: isMine ? .trailing : .leading)
        .contextMenu { reactionMenu }
    }

    @ViewBuilder
    private var messageBody: some View {
        if let body = message.body, !body.isEmpty {
            Text(body)
                .font(.system(size: 15))
                .foregroundStyle(isMine ? .white : VelvetColor.ivory)
                .multilineTextAlignment(isMine ? .trailing : .leading)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    @ViewBuilder
    private var attachmentsList: some View {
        ForEach(message.attachments ?? []) { attachment in
            RealtimeMessageAttachmentView(attachment: attachment, openImage: openImage)
        }
    }

    private var timestamp: some View {
        HStack(spacing: 4) {
            Text(RealtimeMessageDate.time(message.createdAt))
            if isMine {
                Image(systemName: receiptIcon)
            }
        }
        .font(.system(size: 8, weight: .medium))
        .foregroundStyle(isMine ? .white.opacity(0.66) : VelvetColor.textSecondary)
    }

    private var messageBackground: LinearGradient {
        if isMine {
            return LinearGradient(
                colors: [VelvetColor.burgundyLight, VelvetColor.velvetBurgundy],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
        return LinearGradient(
            colors: [VelvetColor.panelRaised, VelvetColor.anthracite],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    private var messageShape: UnevenRoundedRectangle {
        UnevenRoundedRectangle(
            topLeadingRadius: 19,
            bottomLeadingRadius: isMine ? 19 : 5,
            bottomTrailingRadius: isMine ? 5 : 19,
            topTrailingRadius: 19,
            style: .continuous
        )
    }

    private var messageBorder: Color {
        isMine ? VelvetColor.burgundyLight.opacity(0.34) : VelvetColor.borderSubtle
    }

    @ViewBuilder
    private var reactionMenu: some View {
        ForEach(reactionChoices, id: \.key) { choice in
            Button("\(choice.emoji) \(reactionName(choice.key))") {
                Task { await toggleReaction(choice.key) }
            }
        }
    }

    @ViewBuilder
    private var reactionsRow: some View {
        if !reactionGroups.isEmpty {
            HStack(spacing: 4) {
                ForEach(reactionGroups) { group in
                    Button {
                        Task { await toggleReaction(group.reaction) }
                    } label: {
                        Text("\(emoji(group.reaction))\(group.count > 1 ? " \(group.count)" : "")")
                            .font(.system(size: 11, weight: .bold))
                            .padding(.horizontal, 7)
                            .frame(height: 24)
                            .background(.ultraThinMaterial)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(group.names.joined(separator: ", "))
                }
            }
            .padding(.horizontal, 4)
        }
    }

    @ViewBuilder
    private var receiptsList: some View {
        if isMine {
            ForEach(receipts) { receipt in
                Text(receiptLabel(receipt))
                    .font(.system(size: 8, weight: .medium))
                    .foregroundStyle(receipt.status == "read" ? VelvetColor.champagneGold : VelvetColor.textSecondary)
                    .padding(.horizontal, 4)
            }
        }
    }

    private var receiptIcon: String {
        if receipts.contains(where: { $0.status == "read" }) {
            return "checkmark.circle.fill"
        }
        if receipts.contains(where: { $0.status == "delivered" }) {
            return "checkmark.circle"
        }
        return "checkmark"
    }

    private var reactionGroups: [MessageReactionGroup] {
        Dictionary(grouping: reactions, by: \.reaction)
            .map { key, value in
                MessageReactionGroup(
                    reaction: key,
                    count: value.count,
                    names: value.map { $0.displayIdentity ?? "Membre Zwit" }
                )
            }
            .sorted { $0.reaction < $1.reaction }
    }

    private func receiptLabel(_ receipt: MessageReceipt) -> String {
        switch receipt.status {
        case "read":
            let time = receipt.readAt.map { " à \(RealtimeMessageDate.time($0))" } ?? ""
            return "Lu par \(receipt.displayIdentity)\(time)"
        case "delivered":
            return "Distribué à \(receipt.displayIdentity)"
        default:
            return "Envoyé à \(receipt.displayIdentity)"
        }
    }

    private func toggleReaction(_ reaction: String) async {
        let mine = reactions.first(where: { $0.userId == currentUserID })
        await store.setMessageReaction(
            conversationID: conversationID,
            messageID: message.id,
            reaction: mine?.reaction == reaction ? nil : reaction
        )
    }

    private func emoji(_ reaction: String) -> String {
        reactionChoices.first(where: { $0.key == reaction })?.emoji ?? "♡"
    }

    private func reactionName(_ reaction: String) -> String {
        [
            "like": "J’aime",
            "love": "J’adore",
            "laugh": "Drôle",
            "wow": "Waouh",
            "sad": "Triste",
            "fire": "Flamme"
        ][reaction] ?? "Réaction"
    }
}

private struct RealtimeTypingBubble: View {
    let participants: [TypingParticipant]

    var body: some View {
        HStack {
            HStack(spacing: 4) {
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .fill(VelvetColor.champagneGold)
                        .frame(width: 5, height: 5)
                        .opacity(index == 1 ? 1 : 0.52)
                }
                Text(typingText)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .padding(.leading, 3)
            }
            .padding(.horizontal, 12)
            .frame(height: 34)
            .background(VelvetColor.panelRaised.opacity(0.75))
            .clipShape(Capsule())
            Spacer()
        }
    }

    private var typingText: String {
        let names = participants.map { $0.displayIdentity ?? "Un membre" }
        return "\(names.joined(separator: " et ")) \(participants.count > 1 ? "écrivent" : "écrit")…"
    }
}

private struct RealtimeMessageAttachmentView: View {
    let attachment: MessageAttachment
    let openImage: (URL) -> Void

    var body: some View {
        Group {
            if attachment.mediaType == "image", let url = attachment.previewUrl {
                Button { openImage(url) } label: {
                    AsyncImage(url: url) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        ProgressView().tint(VelvetColor.champagneGold)
                    }
                    .frame(width: 210, height: 170)
                    .clipped()
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)
            } else if let url = attachment.previewUrl {
                Link(destination: url) {
                    Label(
                        attachment.originalName ?? "Pièce jointe",
                        systemImage: attachment.mediaType == "video" ? "video.fill" : "doc.fill"
                    )
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(VelvetColor.champagneGold)
                }
            }
        }
    }
}

private struct RealtimeFullScreenAttachment: View {
    @Environment(\.dismiss) private var dismiss
    let url: URL

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            AsyncImage(url: url) { image in
                image.resizable().scaledToFit()
            } placeholder: {
                ProgressView().tint(.white)
            }
            VStack {
                HStack {
                    Spacer()
                    Button { dismiss() } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 40, height: 40)
                            .background(.ultraThinMaterial)
                            .clipShape(Circle())
                    }
                }
                Spacer()
            }
            .padding(16)
        }
    }
}

private struct RealtimeConversationAvatar: View {
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
                colors: [VelvetColor.velvetBurgundy.opacity(0.82), VelvetColor.anthracite],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            Text(isEvent ? "✦" : initials)
                .font(.system(size: size * 0.29, weight: .bold, design: .rounded))
                .foregroundStyle(VelvetColor.champagneGold)
        }
    }

    private var initials: String {
        name.split(separator: " ")
            .prefix(2)
            .compactMap(\.first)
            .map(String.init)
            .joined()
            .uppercased()
    }
}

private enum RealtimeMessageDate {
    static func date(_ value: String?) -> Date {
        guard let value else { return .distantPast }
        return ISO8601DateFormatter.realtimeFractional.date(from: value)
            ?? ISO8601DateFormatter.realtimeBasic.date(from: value)
            ?? .distantPast
    }

    static func time(_ value: String?) -> String {
        let date = date(value)
        guard date != .distantPast else { return "" }
        return date.formatted(date: .omitted, time: .shortened)
    }

    static func short(_ value: String?) -> String {
        let date = date(value)
        guard date != .distantPast else { return "" }
        if Calendar.current.isDateInToday(date) {
            return date.formatted(date: .omitted, time: .shortened)
        }
        return date.formatted(.dateTime.day().month(.abbreviated))
    }
}

private extension ISO8601DateFormatter {
    static let realtimeFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static let realtimeBasic: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
}

private enum RealtimeAttachmentImportError: LocalizedError {
    case tooLarge(String)

    var errorDescription: String? {
        switch self {
        case let .tooLarge(message): message
        }
    }
}
