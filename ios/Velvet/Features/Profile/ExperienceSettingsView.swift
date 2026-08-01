import SwiftUI

struct ExperienceSettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState

    @State private var radiusKm = 50
    @State private var profileSort = "distance"
    @State private var aiPersonalizationEnabled = true
    @State private var isLoading = true
    @State private var isSaving = false

    private let radiusOptions = [10, 20, 30, 50, 75, 100, 150, 200]

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        VelvetPageHeader(
                            "Expérience personnelle",
                            title: "Proximité & Intelligence",
                            subtitle: "Un seul rayon pour l’accueil, les clubs, les sorties, la carte et le classement des profils."
                        )

                        SettingsExperienceCard(
                            eyebrow: "À proximité",
                            title: "Rayon de découverte",
                            icon: "location.circle"
                        ) {
                            Picker("Rayon", selection: $radiusKm) {
                                ForEach(radiusOptions, id: \.self) { distance in
                                    Text("\(distance) km").tag(distance)
                                }
                            }
                            .pickerStyle(.segmented)
                            .labelsHidden()

                            Text("Velvet utilise une position approximative. Votre adresse et vos coordonnées exactes ne sont jamais montrées aux membres.")
                                .experienceFootnote()
                        }

                        SettingsExperienceCard(
                            eyebrow: "Classement",
                            title: "Ordre des profils",
                            icon: "arrow.up.arrow.down.circle"
                        ) {
                            Picker("Classement", selection: $profileSort) {
                                Text("Proximité").tag("distance")
                                Text("Compatibilité").tag("compatibility")
                                Text("Récents").tag("recent")
                                Text("Glaçon & flammes").tag("affinity")
                            }
                            .pickerStyle(.menu)
                            .tint(VelvetColor.champagneGold)

                            Text("Le tri par proximité reste le réglage par défaut. Les filtres précis restent disponibles sous la sélection d’accueil.")
                                .experienceFootnote()
                        }

                        SettingsExperienceCard(
                            eyebrow: "Velvet Intelligence",
                            title: "Personnalisation autonome",
                            icon: "wand.and.stars"
                        ) {
                            Toggle("Adapter mes recommandations", isOn: $aiPersonalizationEnabled)
                                .tint(VelvetColor.champagneGold)
                            Text("Velvet combine vos critères déclarés, la proximité, les pratiques communes, les recommandations et vos glaçons/flammes. Aucun classement ne repose sur la popularité seule.")
                                .experienceFootnote()
                        }

                        VelvetPrimaryButton(
                            "Enregistrer",
                            isLoading: isSaving,
                            isDisabled: isLoading
                        ) {
                            Task { await save() }
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Préférences")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fermer", action: dismiss.callAsFunction)
                        .foregroundStyle(VelvetColor.champagneGold)
                }
            }
            .task { await load() }
        }
    }

    @MainActor
    private func load() async {
        defer { isLoading = false }
        do {
            let settings = try await appState.session.memberSettings()
            radiusKm = settings.experience.discoveryRadiusKm
            profileSort = settings.experience.profileSort
            aiPersonalizationEnabled = settings.experience.aiPersonalizationEnabled
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }

    @MainActor
    private func save() async {
        isSaving = true
        defer { isSaving = false }
        do {
            let saved = try await appState.session.saveExperiencePreferences(
                radiusKm: radiusKm,
                profileSort: profileSort,
                aiPersonalizationEnabled: aiPersonalizationEnabled
            )
            radiusKm = saved.discoveryRadiusKm
            profileSort = saved.profileSort
            aiPersonalizationEnabled = saved.aiPersonalizationEnabled
            appState.alertMessage = "Votre rayon et vos préférences Velvet Intelligence sont enregistrés."
            dismiss()
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }
}

private struct SettingsExperienceCard<Content: View>: View {
    let eyebrow: String
    let title: String
    let icon: String
    let content: Content

    init(
        eyebrow: String,
        title: String,
        icon: String,
        @ViewBuilder content: () -> Content
    ) {
        self.eyebrow = eyebrow
        self.title = title
        self.icon = icon
        self.content = content()
    }

    var body: some View {
        VelvetCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 12) {
                    Image(systemName: icon)
                        .foregroundStyle(VelvetColor.champagneGold)
                        .frame(width: 40, height: 40)
                        .background(VelvetColor.champagneGold.opacity(0.08))
                        .clipShape(Circle())
                    VStack(alignment: .leading, spacing: 2) {
                        Text(eyebrow.uppercased())
                            .font(VelvetTypography.caption(size: 9, weight: .semibold))
                            .tracking(1.3)
                            .foregroundStyle(VelvetColor.champagneGold)
                        Text(title)
                            .font(VelvetTypography.title(size: 22))
                            .foregroundStyle(VelvetColor.ivory)
                    }
                }
                content
            }
        }
    }
}

private extension View {
    func experienceFootnote() -> some View {
        font(VelvetTypography.caption(size: 11))
            .foregroundStyle(VelvetColor.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
    }
}
