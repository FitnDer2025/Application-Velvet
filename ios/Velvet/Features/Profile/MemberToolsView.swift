import SwiftUI

struct MemberToolsView: View {
    private enum Tool: String, CaseIterable, Identifiable {
        case writing
        case organizer
        case account

        var id: String { rawValue }

        var title: String {
            switch self {
            case .writing: "Rédaction"
            case .organizer: "Organisateur"
            case .account: "Compte"
            }
        }
    }

    @State private var selectedTool: Tool = .writing

    var body: some View {
        ZStack {
            VelvetBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VelvetPageHeader(
                        "Studio membre",
                        title: "Outils du profil",
                        subtitle: "Les fonctions avancées de Velvet, pensées comme des outils natifs simples et confidentiels."
                    )

                    Picker("Outil", selection: $selectedTool) {
                        ForEach(Tool.allCases) { tool in
                            Text(tool.title).tag(tool)
                        }
                    }
                    .pickerStyle(.segmented)

                    switch selectedTool {
                    case .writing:
                        ProfileWritingTool()
                    case .organizer:
                        OrganizerAccessTool()
                    case .account:
                        AccountLifecycleTool()
                    }
                }
                .padding(20)
                .padding(.bottom, 30)
            }
        }
        .navigationTitle("Outils")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct ProfileWritingTool: View {
    @EnvironmentObject private var appState: AppState
    @State private var source = ""
    @State private var result = ""
    @State private var purpose = "description"
    @State private var profile: MemberProfile?
    @State private var isWorking = false

    var body: some View {
        VelvetCard {
            VStack(alignment: .leading, spacing: 16) {
                toolHeader(
                    "Plume Velvet",
                    title: "Affiner mon profil",
                    detail: "L’IA reformule uniquement ta matière. Elle n’invente ni pratique, ni expérience, ni information privée."
                )

                Picker("Texte", selection: $purpose) {
                    Text("Présentation").tag("description")
                    Text("Notre histoire").tag("story")
                    Text("Parcours").tag("journey")
                    Text("Recherche").tag("search_text")
                    Text("Biographie").tag("biography")
                }
                .pickerStyle(.menu)
                .tint(VelvetColor.champagneGold)

                TextEditor(text: $source)
                    .font(VelvetTypography.body(size: 14))
                    .foregroundStyle(VelvetColor.ivory)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 140)
                    .padding(10)
                    .background(VelvetColor.ivory.opacity(0.04))
                    .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.medium))
                    .overlay {
                        RoundedRectangle(cornerRadius: VelvetRadius.medium)
                            .stroke(VelvetColor.borderSubtle, lineWidth: 1)
                    }
                    .overlay(alignment: .topLeading) {
                        if source.isEmpty {
                            Text("Écris tes idées, mots-clés et limites…")
                                .font(VelvetTypography.body(size: 14))
                                .foregroundStyle(VelvetColor.textSecondary)
                                .padding(16)
                                .allowsHitTesting(false)
                        }
                    }

                VelvetPrimaryButton(
                    "Proposer une version",
                    isLoading: isWorking,
                    isDisabled: source.trimmingCharacters(in: .whitespacesAndNewlines).count < 18
                ) {
                    Task { await generate() }
                }

                if !result.isEmpty {
                    VStack(alignment: .leading, spacing: 9) {
                        Text("PROPOSITION")
                            .font(VelvetTypography.caption(size: 9, weight: .semibold))
                            .tracking(1.5)
                            .foregroundStyle(VelvetColor.champagneGold)
                        Text(result)
                            .font(VelvetTypography.brand(size: 18))
                            .foregroundStyle(VelvetColor.ivory)
                            .lineSpacing(5)
                            .textSelection(.enabled)
                    }
                    .padding(15)
                    .background(VelvetColor.champagneGold.opacity(0.06))
                    .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.medium))
                }
            }
        }
        .task {
            profile = (try? await appState.session.profile())?.profile
        }
    }

    @MainActor
    private func generate() async {
        guard let profile else {
            appState.alertMessage = "Le profil doit être chargé avant de générer un texte."
            return
        }
        isWorking = true
        defer { isWorking = false }
        do {
            result = try await appState.session.generateProfileCopy(
                purpose: purpose,
                source: source,
                profileType: profile.profileType,
                relationshipSince: profile.relationshipSince,
                practices: profile.practices ?? [],
                values: profile.valuesList ?? []
            ).text
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }
}

private struct OrganizerAccessTool: View {
    @EnvironmentObject private var appState: AppState
    @State private var state: OrganizerRequestState?
    @State private var message = ""
    @State private var isWorking = false

    var body: some View {
        VelvetCard {
            VStack(alignment: .leading, spacing: 16) {
                toolHeader(
                    "Événements",
                    title: "Devenir organisateur",
                    detail: "Propose des sorties et anime des Salons Velvet après validation de l’équipe."
                )

                if let state {
                    Label(statusLabel(state.status), systemImage: statusIcon(state.status))
                        .font(VelvetTypography.body(size: 14, weight: .semibold))
                        .foregroundStyle(statusColor(state.status))
                    if let message = state.message, !message.isEmpty {
                        Text(message)
                            .font(VelvetTypography.body(size: 13))
                            .foregroundStyle(VelvetColor.textSecondary)
                    }
                } else {
                    TextEditor(text: $message)
                        .font(VelvetTypography.body(size: 14))
                        .foregroundStyle(VelvetColor.ivory)
                        .scrollContentBackground(.hidden)
                        .frame(minHeight: 120)
                        .padding(10)
                        .background(VelvetColor.ivory.opacity(0.04))
                        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.medium))

                    VelvetPrimaryButton(
                        "Envoyer ma demande",
                        isLoading: isWorking
                    ) {
                        Task { await submit() }
                    }
                }
            }
        }
        .task { await load() }
    }

    @MainActor
    private func load() async {
        do {
            state = try await appState.session.organizerRequest().request
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }

    @MainActor
    private func submit() async {
        isWorking = true
        defer { isWorking = false }
        do {
            state = try await appState.session.requestOrganizerAccess(
                message: message
            ).request
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }

    private func statusLabel(_ status: String) -> String {
        switch status {
        case "approved": "Accès organisateur validé"
        case "rejected": "Demande à retravailler"
        default: "Demande en cours d’étude"
        }
    }

    private func statusIcon(_ status: String) -> String {
        status == "approved" ? "checkmark.seal.fill" : "hourglass"
    }

    private func statusColor(_ status: String) -> Color {
        status == "approved" ? VelvetColor.success : VelvetColor.champagneGold
    }
}

private struct AccountLifecycleTool: View {
    @EnvironmentObject private var appState: AppState
    @State private var isWorking = false
    @State private var confirmationText: String?

    var body: some View {
        VelvetCard {
            VStack(alignment: .leading, spacing: 16) {
                toolHeader(
                    "Cycle du profil",
                    title: "Pause et suppression",
                    detail: "Sur un profil couple, chaque partenaire actif reçoit sa propre confirmation de sécurité."
                )

                if let confirmationText {
                    Text(confirmationText)
                        .font(VelvetTypography.body(size: 13))
                        .foregroundStyle(VelvetColor.champagneGold)
                }

                Button {
                    Task { await request("pause") }
                } label: {
                    lifecycleRow(
                        "Mettre le profil en pause",
                        detail: "Le profil devient invisible après confirmation",
                        icon: "pause.circle"
                    )
                }
                .buttonStyle(.plain)
                .disabled(isWorking)

                Button {
                    Task { await request("resume") }
                } label: {
                    lifecycleRow(
                        "Réactiver ou annuler",
                        detail: "Annule une action en attente et restaure le profil",
                        icon: "arrow.counterclockwise.circle"
                    )
                }
                .buttonStyle(.plain)
                .disabled(isWorking)

                Button(role: .destructive) {
                    Task { await request("delete") }
                } label: {
                    lifecycleRow(
                        "Programmer la suppression",
                        detail: "Invisible après confirmation, suppression après 30 jours",
                        icon: "trash.circle",
                        destructive: true
                    )
                }
                .buttonStyle(.plain)
                .disabled(isWorking)
            }
        }
    }

    @MainActor
    private func request(_ action: String) async {
        isWorking = true
        defer { isWorking = false }
        do {
            _ = try await appState.session.requestAccountLifecycle(action)
            confirmationText = action == "resume"
                ? "L’action en attente est annulée et le profil peut être réactivé."
                : "Un lien personnel de confirmation a été envoyé à chaque membre actif."
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }

    private func lifecycleRow(
        _ title: String,
        detail: String,
        icon: String,
        destructive: Bool = false
    ) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .light))
                .foregroundStyle(destructive ? VelvetColor.danger : VelvetColor.champagneGold)
                .frame(width: 40, height: 40)
                .background(
                    (destructive ? VelvetColor.danger : VelvetColor.champagneGold)
                        .opacity(0.08)
                )
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(VelvetTypography.body(size: 14, weight: .semibold))
                    .foregroundStyle(destructive ? VelvetColor.danger : VelvetColor.ivory)
                Text(detail)
                    .font(VelvetTypography.caption(size: 10))
                    .foregroundStyle(VelvetColor.textSecondary)
            }
            Spacer()
        }
        .contentShape(Rectangle())
    }
}

private func toolHeader(
    _ eyebrow: String,
    title: String,
    detail: String
) -> some View {
    VStack(alignment: .leading, spacing: 6) {
        Text(eyebrow.uppercased())
            .font(VelvetTypography.caption(size: 9, weight: .semibold))
            .tracking(1.5)
            .foregroundStyle(VelvetColor.champagneGold)
        Text(title)
            .font(VelvetTypography.title(size: 23))
            .foregroundStyle(VelvetColor.ivory)
        Text(detail)
            .font(VelvetTypography.body(size: 12))
            .foregroundStyle(VelvetColor.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
    }
}
