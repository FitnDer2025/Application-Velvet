import SwiftUI

@MainActor
struct MessagingV15Overlay: View {
    let conversationID: String

    @StateObject private var voiceRecorder = ZwitVoiceRecorder()
    @State private var requestState: ZwitConversationRequestState?
    @State private var isSendingVoice = false
    @State private var actionInFlight = false
    @State private var transientMessage: String?

    private let session = SessionService()

    private var uuid: UUID? { UUID(uuidString: conversationID) }
    private var locked: Bool {
        guard let requestState else { return false }
        if requestState.isDeclined { return true }
        return requestState.status == "pending" && requestState.role == "requester" && !requestState.canSend
    }

    var body: some View {
        ZStack {
            VStack(spacing: 0) {
                if let requestState, !requestState.isAccepted {
                    requestBanner(requestState)
                        .padding(.horizontal, 12)
                        .padding(.top, 8)
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
                Spacer(minLength: 0)
            }

            VStack {
                Spacer()
                if locked {
                    lockedComposerCard
                        .padding(.horizontal, 12)
                        .padding(.bottom, 74)
                } else if requestState?.isDeclined != true {
                    voiceControl
                        .frame(maxWidth: .infinity, alignment: .trailing)
                        .padding(.trailing, 16)
                        .padding(.bottom, 76)
                }
            }
        }
        .animation(.snappy(duration: 0.28), value: requestState)
        .allowsHitTesting(true)
        .task(id: conversationID) {
            await refreshLoop()
        }
        .onChange(of: voiceRecorder.errorMessage) { _, value in
            if let value { transientMessage = value }
        }
        .overlay(alignment: .center) {
            if let transientMessage {
                Text(transientMessage)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 11)
                    .background(.black.opacity(0.82), in: Capsule())
                    .transition(.opacity.combined(with: .scale(scale: 0.96)))
                    .task(id: transientMessage) {
                        try? await Task.sleep(for: .seconds(2.6))
                        if self.transientMessage == transientMessage { self.transientMessage = nil }
                    }
            }
        }
    }

    @ViewBuilder
    private func requestBanner(_ state: ZwitConversationRequestState) -> some View {
        HStack(spacing: 12) {
            Image(systemName: state.isIncoming ? "sparkles" : state.isDeclined ? "hand.raised" : "hourglass")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.velvetGold)
                .frame(width: 38, height: 38)
                .background(Color.velvetGold.opacity(0.08), in: RoundedRectangle(cornerRadius: 13, style: .continuous))

            VStack(alignment: .leading, spacing: 3) {
                Text(state.isIncoming ? "NOUVELLE RENCONTRE" : state.isDeclined ? "RESPECT DU CHOIX" : "CONVERSATION PROTÉGÉE")
                    .font(.system(size: 8, weight: .black))
                    .tracking(1.2)
                    .foregroundStyle(Color.velvetGold)
                Text(state.statusTitle)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.primary)
                if state.isIncoming {
                    Text("Vous gardez le contrôle. Répondre accepte aussi naturellement la conversation.")
                        .font(.system(size: 9))
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                } else if state.status == "pending" && state.role == "requester" {
                    Text(followUpText(state))
                        .font(.system(size: 9))
                        .foregroundStyle(.secondary)
                }
            }

            Spacer(minLength: 4)

            if state.isIncoming {
                VStack(spacing: 6) {
                    Button("Accepter") { Task { await decide(accept: true) } }
                        .buttonStyle(.borderedProminent)
                        .tint(Color.velvetBurgundy)
                    Button("Décliner") { Task { await decide(accept: false) } }
                        .buttonStyle(.borderless)
                        .foregroundStyle(.secondary)
                }
                .font(.system(size: 9, weight: .semibold))
                .disabled(actionInFlight)
            } else if state.isDeclined && state.role == "recipient" {
                Button("Réouvrir") { Task { await decide(accept: true) } }
                    .font(.system(size: 9, weight: .semibold))
                    .buttonStyle(.bordered)
                    .tint(Color.velvetGold)
                    .disabled(actionInFlight)
            }
        }
        .padding(12)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.velvetGold.opacity(0.16), lineWidth: 0.7)
        }
        .shadow(color: .black.opacity(0.08), radius: 18, y: 8)
    }

    private var lockedComposerCard: some View {
        HStack(spacing: 10) {
            Image(systemName: "hourglass")
                .foregroundStyle(Color.velvetGold)
            VStack(alignment: .leading, spacing: 2) {
                Text(requestState?.isDeclined == true ? "Conversation fermée" : "En attente d’une réponse")
                    .font(.system(size: 11, weight: .semibold))
                Text(requestState?.isDeclined == true ? "Cette demande a été déclinée." : "Zwit limite les relances pour laisser à chacun l’espace de choisir.")
                    .font(.system(size: 8))
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(.horizontal, 13)
        .frame(minHeight: 56)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 17, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 17, style: .continuous)
                .stroke(Color.velvetGold.opacity(0.13), lineWidth: 0.7)
        }
    }

    private var voiceControl: some View {
        HStack(spacing: 8) {
            if voiceRecorder.isRecording {
                Button("Annuler") { voiceRecorder.cancel() }
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(.secondary)
                Text(durationLabel(voiceRecorder.durationSeconds))
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundStyle(.primary)
            }
            Button {
                Task { await toggleVoice() }
            } label: {
                Image(systemName: voiceRecorder.isRecording ? "stop.fill" : "mic.fill")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(voiceRecorder.isRecording ? Color.white : Color.velvetGold)
                    .frame(width: 43, height: 43)
                    .background(
                        voiceRecorder.isRecording ? Color.velvetBurgundy : Color.black.opacity(0.68),
                        in: Circle()
                    )
                    .overlay { Circle().stroke(Color.white.opacity(0.10), lineWidth: 0.7) }
                    .shadow(color: .black.opacity(0.18), radius: 12, y: 5)
            }
            .buttonStyle(.plain)
            .disabled(isSendingVoice || actionInFlight)
            .accessibilityLabel(voiceRecorder.isRecording ? "Arrêter et envoyer le message vocal" : "Enregistrer un message vocal")
        }
    }

    private func toggleVoice() async {
        guard let uuid else { return }
        if voiceRecorder.isRecording {
            guard let voice = voiceRecorder.stop() else { return }
            isSendingVoice = true
            defer { isSendingVoice = false }
            do {
                _ = try await session.sendVoiceMessage(
                    conversationID: uuid,
                    data: voice.data,
                    durationSeconds: voice.durationSeconds,
                    mimeType: voice.mimeType
                )
                transientMessage = "Message vocal envoyé."
                NotificationCenter.default.post(name: .zwitMessagingV15DidSend, object: uuid)
                await loadRequestState()
            } catch {
                transientMessage = ErrorMessage.text(for: error)
            }
        } else {
            _ = await voiceRecorder.start()
        }
    }

    private func decide(accept: Bool) async {
        guard let uuid else { return }
        actionInFlight = true
        defer { actionInFlight = false }
        do {
            requestState = try await session.decideConversationRequest(conversationID: uuid, accept: accept)
        } catch {
            transientMessage = ErrorMessage.text(for: error)
        }
    }

    private func loadRequestState() async {
        guard let uuid else { return }
        do {
            requestState = try await session.conversationRequest(conversationID: uuid)
        } catch {
            // Migration non encore appliquée : la messagerie historique reste disponible.
        }
    }

    private func refreshLoop() async {
        await loadRequestState()
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(5))
            if Task.isCancelled { break }
            await loadRequestState()
        }
    }

    private func followUpText(_ state: ZwitConversationRequestState) -> String {
        if state.canSend && state.introMessagesSent == 1 { return "Une dernière relance est disponible." }
        if let raw = state.followUpAt, let date = ISO8601DateFormatter().date(from: raw) {
            return "Une unique relance sera possible " + date.formatted(.relative(presentation: .named)) + "."
        }
        return "La conversation attend une réponse."
    }

    private func durationLabel(_ seconds: Int) -> String {
        String(format: "%02d:%02d", seconds / 60, seconds % 60)
    }
}

extension Notification.Name {
    static let zwitMessagingV15DidSend = Notification.Name("zwit.messaging.v15.did-send")
}
