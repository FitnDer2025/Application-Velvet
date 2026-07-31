import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

struct AppleConversationsView: View {
    @EnvironmentObject private var store: VelvetStore

    private var conversations: [Conversation] {
        (store.directory?.conversations ?? []).sorted {
            AppleMessageDate.date($0.lastMessageAt ?? $0.updatedAt)
                > AppleMessageDate.date($1.lastMessageAt ?? $1.updatedAt)
        }
    }

    var body: some View {
        ZStack {
            VelvetBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VelvetPageHeader(
                        "Conversations et salons",
                        title: "Messages",
                        subtitle: "Retrouve immédiatement la personne qui t’écrit, le dernier message et vos flammes."
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
                        LazyVStack(spacing: 10) {
                            ForEach(conversations) { conversation in
                                NavigationLink {
                                    AppleConversationView(conversation: conversation)
                                } label: {
                                    AppleConversationTile(conversation: conversation)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .padding(.bottom, 28)
            }
            .refreshable {
                await store.refreshMessaging()
                await store.refreshSocialState()
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task {
            await store.refreshMessaging()
            await store.refreshSocialState()
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(15))
                guard !Task.isCancelled else { return }
                await store.refreshMessaging()
            }
        }
    }
}

private struct AppleConversationTile: View {
    @EnvironmentObject private var store: VelvetStore
    let conversation: Conversation

    private var unread: Int { conversation.unreadCount ?? 0 }
    private var streak: ConversationStreak? { store.conversationStreaks[conversation.id] }

    var body: some View {
        HStack(spacing: 13) {
            AppleConversationAvatar(
                url: conversation.participantPhotoUrl,
                name: conversation.title,
                isEvent: conversation.kind == "event",
                size: 54
            )

            VStack(alignment: .leading, spacing: 5) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(conversation.title)
                        .font(.system(size: 16, weight: unread > 0 ? .bold : .semibold))
                        .foregroundStyle(VelvetColor.ivory)
                        .lineLimit(1)
                    if let streak, streak.currentStreak > 0 {
                        Label("\(streak.currentStreak)", systemImage: "flame.fill")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .foregroundStyle(VelvetColor.champagneGold)
                    }
                    Spacer(minLength: 8)
                    Text(AppleMessageDate.short(conversation.lastMessageAt ?? conversation.updatedAt))
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(unread > 0 ? VelvetColor.champagneGold : VelvetColor.textSecondary)
                }

                HStack(alignment: .center, spacing: 8) {
                    Text(conversation.lastMessageBody ?? "Commencez la conversation…")
                        .font(.system(size: 13, weight: unread > 0 ? .semibold : .regular))
                        .foregroundStyle(unread > 0 ? VelvetColor.ivory : VelvetColor.textSecondary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    Spacer(minLength: 4)
                    if unread > 0 {
                        Text(unread > 99 ? "99+" : "\(unread)")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                            .padding(.horizontal, unread > 9 ? 7 : 0)
                            .frame(minWidth: 23, minHeight: 23)
                            .background(VelvetColor.burgundyLight)
                            .clipShape(Capsule())
                    } else {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(VelvetColor.textSecondary.opacity(0.7))
                    }
                }

                if conversation.kind == "event" {
                    Text("SALON VELVET")
                        .font(VelvetTypography.caption(size: 8, weight: .semibold))
                        .tracking(1.1)
                        .foregroundStyle(VelvetColor.champagneGold)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
        .background(.ultraThinMaterial)
        .background(
            unread > 0
                ? VelvetColor.velvetBurgundy.opacity(0.16)
                : VelvetColor.anthracite.opacity(0.60)
        )
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(
                    unread > 0 ? VelvetColor.champagneGold.opacity(0.24) : VelvetColor.borderSubtle,
                    lineWidth: 0.8
                )
        }
    }
}

struct AppleConversationView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: VelvetStore
    @EnvironmentObject private var chrome: ShellChromeState
    let conversation: Conversation

    @State private var draft = ""
    @State private var isSending = false
    @State private var isLoadingAttachments = false
    @State private var showsAttachmentMenu = false
    @State private var showsPhotoPicker = false
    @State private var showsDocumentPicker = false
    @State private var selectedPhotoItems: [PhotosPickerItem] = []
    @State private var outgoingAttachments: [OutgoingMessageAttachment] = []
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

    private var composerHeight: CGFloat {
        let lines = max(1, draft.components(separatedBy: .newlines).count)
        return min(112, max(40, CGFloat(lines) * 21 + 18))
    }

    private var canSend: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || !outgoingAttachments.isEmpty
    }

    var body: some View {
        ZStack {
            VelvetBackground()
            VStack(spacing: 0) {
                iMessageHeader

                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 6) {
                            if messages.isEmpty {
                                VelvetCompactEmptyState(
                                    symbol: "bubble.left.and.bubble.right",
                                    title: "Commencez l’échange",
                                    message: "Les messages et pièces jointes restent privés entre les membres de cette conversation."
                                )
                                .padding(.top, 30)
                            } else {
                                ForEach(messages) { message in
                                    AppleMessageBubble(
                                        message: message,
                                        isMine: message.senderUserId == store.directory?.currentUserId
                                    )
                                    .id(message.id)
                                }
                            }
                        }
                        .padding(.horizontal, 12)
                        .padding(.top, 12)
                        .padding(.bottom, 16)
                        .frame(maxWidth: .infinity, minHeight: 1, alignment: .bottom)
                    }
                    .scrollDismissesKeyboard(.interactively)
                    .onChange(of: messages.count) { _, _ in scrollToLatest(proxy) }
                    .onChange(of: composerFocused) { _, focused in
                        if focused { scrollToLatest(proxy) }
                    }
                    .onAppear { scrollToLatest(proxy, animated: false) }
                }
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { composer }
        .toolbar(.hidden, for: .navigationBar)
        .onAppear { chrome.isImmersive = true }
        .onDisappear { chrome.isImmersive = false }
        .task {
            await store.refreshMessages(conversationID: conversation.id)
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(8))
                guard !Task.isCancelled else { return }
                await store.refreshMessages(conversationID: conversation.id)
            }
        }
        .confirmationDialog(
            "Ajouter une pièce jointe",
            isPresented: $showsAttachmentMenu,
            titleVisibility: .visible
        ) {
            Button("Photo ou vidéo", systemImage: "photo.on.rectangle") {
                showsPhotoPicker = true
            }
            Button("Document PDF", systemImage: "doc.fill") {
                showsDocumentPicker = true
            }
            Button("Annuler", role: .cancel) {}
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
            allowsMultipleSelection: true
        ) { result in
            Task { await importDocuments(result) }
        }
        .onChange(of: selectedPhotoItems) { _, items in
            Task { await importPhotos(items) }
        }
    }

    private var iMessageHeader: some View {
        HStack(spacing: 10) {
            Button {
                dismiss()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(VelvetColor.champagneGold)
                    .frame(width: 38, height: 38)
                    .background(.ultraThinMaterial)
                    .background(VelvetColor.ivory.opacity(0.025))
                    .clipShape(Circle())
                    .overlay(Circle().stroke(VelvetColor.borderSubtle, lineWidth: 0.7))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Retour")

            headerIdentity
            Spacer()

            if let streak, streak.currentStreak > 0 {
                VStack(spacing: 1) {
                    Label("\(streak.currentStreak)", systemImage: "flame.fill")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundStyle(VelvetColor.champagneGold)
                    Text("FLAMMES")
                        .font(VelvetTypography.caption(size: 6, weight: .bold))
                        .tracking(0.8)
                        .foregroundStyle(VelvetColor.textSecondary)
                }
                .padding(.horizontal, 9)
                .frame(height: 38)
                .background(VelvetColor.champagneGold.opacity(0.07))
                .clipShape(Capsule())
            }

            Menu {
                if participantProfile != nil {
                    Button("Voir le profil", systemImage: "person.crop.rectangle") {}
                }
                Button("Signaler ou bloquer", systemImage: "shield") {}
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                    .frame(width: 38, height: 38)
                    .background(.ultraThinMaterial)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(VelvetColor.borderSubtle, lineWidth: 0.7))
            }
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
    private var headerIdentity: some View {
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
            AppleConversationAvatar(
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
                if conversation.kind == "event" {
                    Text("Salon Velvet")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(VelvetColor.champagneGold)
                }
            }
        }
    }

    private var composer: some View {
        VStack(spacing: 7) {
            if !outgoingAttachments.isEmpty || isLoadingAttachments {
                attachmentDrafts
            }

            HStack(alignment: .bottom, spacing: 8) {
                Button {
                    showsAttachmentMenu = true
                } label: {
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

                ZStack(alignment: .topLeading) {
                    if draft.isEmpty {
                        Text(outgoingAttachments.isEmpty ? "iMessage Velvet" : "Ajouter un message…")
                            .font(.system(size: 15))
                            .foregroundStyle(VelvetColor.textSecondary.opacity(0.72))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .allowsHitTesting(false)
                    }

                    TextEditor(text: $draft)
                        .focused($composerFocused)
                        .font(.system(size: 16))
                        .foregroundStyle(VelvetColor.ivory)
                        .scrollContentBackground(.hidden)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 3)
                        .frame(height: composerHeight)
                        .background(Color.clear)
                        .accessibilityLabel("Message")
                        .accessibilityHint("Retour crée une nouvelle ligne. Le bouton flèche envoie le message.")
                }
                .background(VelvetColor.ivory.opacity(0.055))
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .stroke(VelvetColor.borderSubtle, lineWidth: 0.8)
                }

                Button {
                    Task { await send() }
                } label: {
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
                .disabled(!canSend || isSending || isLoadingAttachments)
            }
        }
        .padding(.horizontal, 10)
        .padding(.top, 8)
        .padding(.bottom, 7)
        .background(.ultraThinMaterial)
        .background(VelvetColor.velvetBlack.opacity(0.84))
        .overlay(alignment: .top) {
            Rectangle().fill(VelvetColor.borderSubtle).frame(height: 0.5)
        }
    }

    private var attachmentDrafts: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(outgoingAttachments) { attachment in
                    AttachmentDraftChip(attachment: attachment) {
                        outgoingAttachments.removeAll { $0.id == attachment.id }
                    }
                }
                if isLoadingAttachments {
                    HStack(spacing: 7) {
                        ProgressView().tint(VelvetColor.champagneGold)
                        Text("Préparation…")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(VelvetColor.textSecondary)
                    }
                    .padding(.horizontal, 12)
                    .frame(height: 42)
                    .background(VelvetColor.ivory.opacity(0.04))
                    .clipShape(Capsule())
                }
            }
            .padding(.horizontal, 2)
        }
    }

    private func scrollToLatest(_ proxy: ScrollViewProxy, animated: Bool = true) {
        guard let id = messages.last?.id else { return }
        DispatchQueue.main.async {
            if animated {
                withAnimation(.easeOut(duration: VelvetMotion.normal)) {
                    proxy.scrollTo(id, anchor: .bottom)
                }
            } else {
                proxy.scrollTo(id, anchor: .bottom)
            }
        }
    }

    @MainActor
    private func send() async {
        let value = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty || !outgoingAttachments.isEmpty else { return }
        isSending = true
        let sent = await store.send(
            value,
            conversationID: conversation.id,
            attachments: outgoingAttachments
        )
        if sent {
            draft = ""
            outgoingAttachments = []
            composerFocused = true
        }
        isSending = false
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
                        throw AttachmentImportError.tooLarge("La vidéo dépasse 50 Mo.")
                    }
                    let ext = type?.preferredFilenameExtension ?? "mov"
                    outgoingAttachments.append(
                        OutgoingMessageAttachment(
                            data: data,
                            fileName: "video-\(UUID().uuidString).\(ext)",
                            mimeType: type?.preferredMIMEType ?? "video/quicktime",
                            mediaType: "video"
                        )
                    )
                } else {
                    let compressed = try ImageCompressor.jpegData(from: data)
                    guard compressed.count <= 10 * 1024 * 1024 else {
                        throw AttachmentImportError.tooLarge("La photo dépasse 10 Mo après compression.")
                    }
                    outgoingAttachments.append(
                        OutgoingMessageAttachment(
                            data: compressed,
                            fileName: "photo-\(UUID().uuidString).jpg",
                            mimeType: "image/jpeg",
                            mediaType: "image"
                        )
                    )
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
            isLoadingAttachments = true
            defer { isLoadingAttachments = false }

            for url in urls.prefix(max(0, 4 - outgoingAttachments.count)) {
                let secured = url.startAccessingSecurityScopedResource()
                defer { if secured { url.stopAccessingSecurityScopedResource() } }
                let data = try Data(contentsOf: url)
                guard data.count <= 10 * 1024 * 1024 else {
                    throw AttachmentImportError.tooLarge("Le PDF dépasse 10 Mo.")
                }
                outgoingAttachments.append(
                    OutgoingMessageAttachment(
                        data: data,
                        fileName: url.lastPathComponent.isEmpty ? "document.pdf" : url.lastPathComponent,
                        mimeType: "application/pdf",
                        mediaType: "document"
                    )
                )
            }
        } catch {
            store.errorMessage = error.localizedDescription
        }
    }
}

private struct AttachmentDraftChip: View {
    let attachment: OutgoingMessageAttachment
    let remove: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(VelvetColor.champagneGold)
            Text(attachment.fileName)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(VelvetColor.ivory)
                .lineLimit(1)
                .frame(maxWidth: 150)
            Button(action: remove) {
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(VelvetColor.textSecondary)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 11)
        .frame(height: 42)
        .background(VelvetColor.ivory.opacity(0.05))
        .clipShape(Capsule())
        .overlay(Capsule().stroke(VelvetColor.borderSubtle, lineWidth: 0.7))
    }

    private var icon: String {
        switch attachment.mediaType {
        case "image": "photo.fill"
        case "video": "video.fill"
        default: "doc.fill"
        }
    }
}

private struct AppleMessageBubble: View {
    let message: DirectoryMessage
    let isMine: Bool

    var body: some View {
        HStack(alignment: .bottom, spacing: 6) {
            if isMine { Spacer(minLength: 58) }

            VStack(alignment: isMine ? .trailing : .leading, spacing: 4) {
                if let body = message.body, !body.isEmpty {
                    Text(body)
                        .font(.system(size: 16))
                        .foregroundStyle(isMine ? .white : VelvetColor.ivory)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }

                if let attachments = message.attachments, !attachments.isEmpty {
                    VStack(alignment: isMine ? .trailing : .leading, spacing: 7) {
                        ForEach(attachments) { attachment in
                            AppleMessageAttachment(attachment: attachment)
                        }
                    }
                }

                Text(AppleMessageDate.time(message.createdAt))
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(isMine ? .white.opacity(0.68) : VelvetColor.textSecondary)
            }
            .padding(.horizontal, 13)
            .padding(.vertical, 8)
            .background(isMine ? VelvetColor.burgundyLight : VelvetColor.panelRaised)
            .clipShape(
                UnevenRoundedRectangle(
                    topLeadingRadius: 18,
                    bottomLeadingRadius: isMine ? 18 : 5,
                    bottomTrailingRadius: isMine ? 5 : 18,
                    topTrailingRadius: 18,
                    style: .continuous
                )
            )
            .frame(maxWidth: 300, alignment: isMine ? .trailing : .leading)

            if !isMine { Spacer(minLength: 58) }
        }
        .frame(maxWidth: .infinity)
    }
}

private struct AppleMessageAttachment: View {
    let attachment: MessageAttachment

    var body: some View {
        Group {
            if attachment.mediaType == "image", let url = attachment.previewUrl {
                VelvetRemoteImage(url: url)
                    .frame(width: 210, height: 170)
                    .clipped()
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            } else if let url = attachment.previewUrl {
                Link(destination: url) {
                    Label(
                        attachment.originalName ?? "Pièce jointe",
                        systemImage: attachment.mediaType == "video" ? "play.rectangle.fill" : "doc.fill"
                    )
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(VelvetColor.champagneGold)
                    .padding(.vertical, 4)
                }
            }
        }
    }
}

private struct AppleConversationAvatar: View {
    let url: URL?
    let name: String
    let isEvent: Bool
    let size: CGFloat

    var body: some View {
        ZStack {
            if let url {
                VelvetRemoteImage(url: url, symbol: isEvent ? "person.3.fill" : "person.fill")
            } else {
                placeholder
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(Circle().stroke(VelvetColor.champagneGold.opacity(0.24), lineWidth: 0.8))
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

private enum AppleMessageDate {
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
        let date = date(value)
        guard date != .distantPast else { return "" }
        if Calendar.current.isDateInToday(date) {
            return date.formatted(date: .omitted, time: .shortened)
        }
        return date.formatted(.dateTime.day().month(.abbreviated))
    }

    static func time(_ value: String?) -> String {
        let date = date(value)
        guard date != .distantPast else { return "" }
        return date.formatted(date: .omitted, time: .shortened)
    }
}

private enum AttachmentImportError: LocalizedError {
    case tooLarge(String)

    var errorDescription: String? {
        switch self {
        case let .tooLarge(message): message
        }
    }
}
