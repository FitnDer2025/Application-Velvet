import AVKit
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

/// Source-of-truth conversation experience for Zwit iOS.
/// Keeps the validated iMessage-style timeline and makes premium media actions
/// explicit instead of hiding them behind legacy overlays.
struct ZwitPremiumConversationView: View {
    @EnvironmentObject private var store: VelvetStore

    let conversation: Conversation

    @StateObject private var voiceRecorder = ZwitVoiceRecorder()
    @State private var requestState: ZwitConversationRequestState?
    @State private var standardPhotoItem: PhotosPickerItem?
    @State private var ephemeralPhotoItem: PhotosPickerItem?
    @State private var showsStandardPhotoPicker = false
    @State private var showsEphemeralPhotoPicker = false
    @State private var isMediaBusy = false
    @State private var transientMessage: String?
    @State private var openedEphemeral: OpenedEphemeralPresentation?
    @State private var consumedEphemeralIDs = Set<UUID>()

    private let session = SessionService()

    private var messages: [DirectoryMessage] {
        store.messages[conversation.id] ?? []
    }

    private var requestLocked: Bool {
        guard let requestState else { return false }
        if requestState.isDeclined { return true }
        return requestState.status == "pending"
            && requestState.role == "requester"
            && !requestState.canSend
    }

    private var incomingEphemeral: DirectoryMessage? {
        messages.reversed().first { message in
            message.senderUserId != store.directory?.currentUserId
                && !consumedEphemeralIDs.contains(message.id)
                && (message.body?.hasPrefix("🔒") == true)
        }
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            RealtimeAppleConversationView(conversation: conversation)

            VStack(spacing: 8) {
                Spacer(minLength: 0)
                if let incomingEphemeral {
                    ephemeralIncomingBanner(incomingEphemeral)
                }
                if requestLocked {
                    lockedRequestBanner
                } else if requestState?.isDeclined != true {
                    quickActions
                }
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 61)
            .allowsHitTesting(true)
        }
        .task(id: conversation.id) {
            await loadRequestState()
        }
        .onReceive(NotificationCenter.default.publisher(for: .zwitMessagingV15DidSend)) { notification in
            guard notification.object as? UUID == conversation.id else { return }
            Task { await store.refreshMessages(conversationID: conversation.id) }
        }
        .onChange(of: voiceRecorder.errorMessage) { _, value in
            if let value { transientMessage = value }
        }
        .photosPicker(
            isPresented: $showsStandardPhotoPicker,
            selection: $standardPhotoItem,
            matching: .images
        )
        .photosPicker(
            isPresented: $showsEphemeralPhotoPicker,
            selection: $ephemeralPhotoItem,
            matching: .images
        )
        .onChange(of: standardPhotoItem) { _, item in
            guard let item else { return }
            Task { await sendStandardPhoto(item) }
        }
        .onChange(of: ephemeralPhotoItem) { _, item in
            guard let item else { return }
            Task { await sendEphemeralPhoto(item) }
        }
        .sheet(item: $openedEphemeral) { presentation in
            ZwitEphemeralMediaPreview(presentation: presentation)
        }
        .overlay(alignment: .center) {
            if let transientMessage {
                Text(transientMessage)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 11)
                    .background(.black.opacity(0.86), in: Capsule())
                    .transition(.opacity.combined(with: .scale(scale: 0.96)))
                    .task(id: transientMessage) {
                        try? await Task.sleep(for: .seconds(2.6))
                        if self.transientMessage == transientMessage {
                            self.transientMessage = nil
                        }
                    }
            }
        }
    }

    private var quickActions: some View {
        HStack(spacing: 7) {
            if voiceRecorder.isRecording {
                recordingControls
            } else {
                premiumAction(
                    title: "Photo",
                    symbol: "photo.fill",
                    accessibility: "Envoyer une photo"
                ) {
                    showsStandardPhotoPicker = true
                }

                premiumAction(
                    title: "Éphémère",
                    symbol: "viewfinder.circle.fill",
                    accessibility: "Envoyer une photo éphémère à voir une fois"
                ) {
                    showsEphemeralPhotoPicker = true
                }

                premiumAction(
                    title: "Vocal",
                    symbol: "mic.fill",
                    accessibility: "Enregistrer un message vocal"
                ) {
                    Task { _ = await voiceRecorder.start() }
                }
            }
        }
        .padding(6)
        .background(.ultraThinMaterial)
        .background(VelvetColor.velvetBlack.opacity(0.82))
        .clipShape(Capsule())
        .overlay {
            Capsule().stroke(VelvetColor.borderSubtle, lineWidth: 0.7)
        }
        .shadow(color: .black.opacity(0.22), radius: 15, y: 7)
        .disabled(isMediaBusy)
        .opacity(isMediaBusy ? 0.62 : 1)
    }

    private var recordingControls: some View {
        HStack(spacing: 8) {
            Button {
                voiceRecorder.cancel()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .frame(width: 32, height: 32)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Annuler le vocal")

            Circle()
                .fill(VelvetColor.danger)
                .frame(width: 7, height: 7)

            Text(durationLabel(voiceRecorder.durationSeconds))
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundStyle(VelvetColor.ivory)
                .frame(minWidth: 42)

            Button {
                Task { await stopAndSendVoice() }
            } label: {
                Label("Envoyer", systemImage: "arrow.up.circle.fill")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 10)
                    .frame(height: 32)
                    .background(VelvetColor.velvetBurgundy)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Arrêter et envoyer le vocal")
        }
    }

    private func premiumAction(
        title: String,
        symbol: String,
        accessibility: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Label(title, systemImage: symbol)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(VelvetColor.champagneGold)
                .padding(.horizontal, 10)
                .frame(height: 32)
                .background(VelvetColor.ivory.opacity(0.035))
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibility)
    }

    private func ephemeralIncomingBanner(_ message: DirectoryMessage) -> some View {
        Button {
            Task { await openEphemeral(message) }
        } label: {
            HStack(spacing: 9) {
                Image(systemName: "lock.open.fill")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(VelvetColor.champagneGold)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Photo éphémère reçue")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(VelvetColor.ivory)
                    Text("Touchez pour l’ouvrir · accès court et privé")
                        .font(.system(size: 8, weight: .medium))
                        .foregroundStyle(VelvetColor.textSecondary)
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.right")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(VelvetColor.champagneGold)
            }
            .padding(.horizontal, 13)
            .frame(minHeight: 48)
            .background(.ultraThinMaterial)
            .background(VelvetColor.velvetBurgundy.opacity(0.22))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(VelvetColor.champagneGold.opacity(0.18), lineWidth: 0.7)
            }
        }
        .buttonStyle(.plain)
        .disabled(isMediaBusy)
    }

    private var lockedRequestBanner: some View {
        HStack(spacing: 9) {
            Image(systemName: requestState?.isDeclined == true ? "hand.raised.fill" : "hourglass")
                .foregroundStyle(VelvetColor.champagneGold)
            VStack(alignment: .leading, spacing: 1) {
                Text(requestState?.isDeclined == true ? "Conversation fermée" : "En attente d’une réponse")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                Text("Zwit limite les relances pour laisser à chacun l’espace de choisir.")
                    .font(.system(size: 8))
                    .foregroundStyle(VelvetColor.textSecondary)
            }
            Spacer()
        }
        .padding(.horizontal, 13)
        .frame(minHeight: 50)
        .background(.ultraThinMaterial)
        .background(VelvetColor.velvetBlack.opacity(0.86))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(VelvetColor.champagneGold.opacity(0.14), lineWidth: 0.7)
        }
    }

    @MainActor
    private func sendStandardPhoto(_ item: PhotosPickerItem) async {
        isMediaBusy = true
        defer {
            standardPhotoItem = nil
            isMediaBusy = false
        }

        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                throw PremiumMediaError.unreadablePhoto
            }
            let compressed = try ImageCompressor.jpegData(from: data)
            guard compressed.count <= 10 * 1024 * 1024 else {
                throw PremiumMediaError.photoTooLarge
            }
            let attachment = OutgoingMessageAttachment(
                data: compressed,
                fileName: "photo-zwit-\(UUID().uuidString).jpg",
                mimeType: "image/jpeg",
                mediaType: "image"
            )
            guard await store.send("", conversationID: conversation.id, attachments: [attachment]) else {
                throw PremiumMediaError.sendFailed
            }
            transientMessage = "Photo envoyée."
        } catch {
            transientMessage = ErrorMessage.text(for: error)
        }
    }

    @MainActor
    private func sendEphemeralPhoto(_ item: PhotosPickerItem) async {
        isMediaBusy = true
        defer {
            ephemeralPhotoItem = nil
            isMediaBusy = false
        }

        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                throw PremiumMediaError.unreadablePhoto
            }
            let compressed = try ImageCompressor.jpegData(from: data)
            guard compressed.count <= 10 * 1024 * 1024 else {
                throw PremiumMediaError.photoTooLarge
            }
            _ = try await session.sendEphemeralMessage(
                conversationID: conversation.id,
                data: compressed,
                fileName: "ephemere-zwit-\(UUID().uuidString).jpg",
                mimeType: "image/jpeg",
                mode: "view_once",
                expiresMinutes: 10
            )
            await store.refreshMessages(conversationID: conversation.id)
            transientMessage = "Photo éphémère envoyée · visible une seule fois."
        } catch {
            transientMessage = ErrorMessage.text(for: error)
        }
    }

    @MainActor
    private func stopAndSendVoice() async {
        guard let voice = voiceRecorder.stop() else { return }
        isMediaBusy = true
        defer { isMediaBusy = false }

        do {
            _ = try await session.sendVoiceMessage(
                conversationID: conversation.id,
                data: voice.data,
                durationSeconds: voice.durationSeconds,
                mimeType: voice.mimeType
            )
            await store.refreshMessages(conversationID: conversation.id)
            transientMessage = "Message vocal envoyé."
        } catch {
            transientMessage = ErrorMessage.text(for: error)
        }
    }

    @MainActor
    private func openEphemeral(_ message: DirectoryMessage) async {
        isMediaBusy = true
        defer { isMediaBusy = false }
        do {
            let media = try await session.openEphemeralMessage(messageID: message.id)
            consumedEphemeralIDs.insert(message.id)
            openedEphemeral = OpenedEphemeralPresentation(
                id: message.id,
                url: media.previewUrl,
                mimeType: media.mimeType ?? "image/jpeg",
                expiresAt: media.expiresAt
            )
        } catch {
            consumedEphemeralIDs.insert(message.id)
            transientMessage = ErrorMessage.text(for: error)
        }
    }

    @MainActor
    private func loadRequestState() async {
        do {
            requestState = try await session.conversationRequest(conversationID: conversation.id)
        } catch {
            // Historical conversations remain usable if the v1.5 request row does not exist.
            requestState = nil
        }
    }

    private func durationLabel(_ seconds: Int) -> String {
        String(format: "%02d:%02d", seconds / 60, seconds % 60)
    }
}

private struct OpenedEphemeralPresentation: Identifiable {
    let id: UUID
    let url: URL
    let mimeType: String
    let expiresAt: String
}

private struct ZwitEphemeralMediaPreview: View {
    @Environment(\.dismiss) private var dismiss
    let presentation: OpenedEphemeralPresentation

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if presentation.mimeType.hasPrefix("video/") {
                VideoPlayer(player: AVPlayer(url: presentation.url))
                    .ignoresSafeArea(edges: .horizontal)
            } else {
                AsyncImage(url: presentation.url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFit()
                    case .failure:
                        ContentUnavailableView("Média indisponible", systemImage: "photo.badge.exclamationmark")
                            .foregroundStyle(.white)
                    default:
                        ProgressView().tint(.white)
                    }
                }
                .padding(.vertical, 60)
            }

            VStack {
                HStack {
                    Label("Éphémère", systemImage: "lock.fill")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.8))
                    Spacer()
                    Button { dismiss() } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 40, height: 40)
                            .background(.ultraThinMaterial)
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                }
                Spacer()
                Text("Ce lien privé expire rapidement et n’est pas conservé dans le flux normal.")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(.white.opacity(0.65))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 28)
                    .padding(.bottom, 18)
            }
            .padding(16)
        }
    }
}

private enum PremiumMediaError: LocalizedError {
    case unreadablePhoto
    case photoTooLarge
    case sendFailed

    var errorDescription: String? {
        switch self {
        case .unreadablePhoto:
            "La photo sélectionnée n’a pas pu être lue."
        case .photoTooLarge:
            "La photo reste trop volumineuse après optimisation."
        case .sendFailed:
            "La photo n’a pas pu être envoyée."
        }
    }
}
