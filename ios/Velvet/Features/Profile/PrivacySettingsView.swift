import SwiftUI
import UserNotifications

struct PrivacySettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var biometrics: BiometricLockService
    @StateObject private var locationService = LocationService()

    @State private var notificationsEnabled = false
    @State private var notificationsDenied = false
    @State private var biometricEnabled = false
    @State private var locationEnabled = false
    @State private var emailEnabled = true
    @State private var inAppEnabled = true
    @State private var discoverableBy = Set([
        "couple", "woman", "man", "trans_nonbinary", "other"
    ])
    @State private var contactableBy = Set([
        "couple", "woman", "man", "trans_nonbinary", "other"
    ])
    @State private var notifyFrom = Set([
        "couple", "woman", "man", "trans_nonbinary", "other"
    ])
    @State private var eventPreferences = NotificationEventPreferences(
        messages: true,
        likes: true,
        albumAccess: true,
        profileViews: true,
        events: true,
        recommendations: true,
        security: true
    )
    @State private var showsDeletion = false
    @State private var isWorking = false
    @State private var settingsLoaded = false

    private static let audiences: [(id: String, label: String)] = [
        ("couple", "Couples"),
        ("woman", "Femmes"),
        ("man", "Hommes"),
        ("trans_nonbinary", "Trans & non-binaires"),
        ("other", "Autres")
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        VelvetPageHeader(
                            "Contrôle privé",
                            title: "Confidentialité",
                            subtitle: "Des réglages simples, synchronisés avec Velvet et les protections natives de l’iPhone."
                        )

                        securityCard
                        notificationsCard
                        audienceCard(
                            eyebrow: "Découverte",
                            title: "Qui peut me trouver",
                            selection: $discoverableBy
                        )
                        audienceCard(
                            eyebrow: "Messages",
                            title: "Qui peut me contacter",
                            selection: $contactableBy
                        )
                        locationCard
                        accountCard

                        VelvetPrimaryButton(
                            "Enregistrer mes préférences",
                            isLoading: isWorking,
                            isDisabled: !settingsLoaded
                        ) {
                            Task { await saveSettings() }
                        }
                    }
                    .padding(20)
                    .padding(.bottom, 24)
                }
            }
            .navigationTitle("Confidentialité")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fermer", action: dismiss.callAsFunction)
                }
            }
            .sheet(isPresented: $showsDeletion) {
                AccountDeletionView()
            }
            .task { await loadSettings() }
            .onChange(of: biometricEnabled) { oldValue, enabled in
                guard settingsLoaded, oldValue != enabled else { return }
                Task {
                    let accepted = await biometrics.setEnabled(enabled)
                    if !accepted {
                        biometricEnabled = biometrics.isEnabled
                    }
                }
            }
            .onChange(of: notificationsEnabled) { oldValue, enabled in
                guard settingsLoaded, oldValue != enabled else { return }
                Task { await updateNotifications(enabled) }
            }
            .onChange(of: locationEnabled) { oldValue, enabled in
                guard settingsLoaded, oldValue != enabled else { return }
                if enabled {
                    locationService.requestOneShotLocation()
                } else {
                    Task { _ = try? await appState.session.disableLocation() }
                }
            }
            .onChange(of: locationService.lastLocation) { _, location in
                guard let location else { return }
                Task {
                    do {
                        _ = try await appState.session.saveLocation(
                            latitude: location.coordinate.latitude,
                            longitude: location.coordinate.longitude
                        )
                    } catch {
                        appState.alertMessage = ErrorMessage.text(for: error)
                    }
                }
            }
        }
    }

    private var securityCard: some View {
        SettingsCard(
            eyebrow: "Sécurité Apple",
            title: biometrics.biometryName,
            icon: "faceid"
        ) {
            Toggle("Verrouiller Velvet", isOn: $biometricEnabled)
                .tint(VelvetColor.champagneGold)
            Text("Velvet masque l’espace membre à chaque passage en arrière-plan. Le mot de passe n’est jamais stocké : l’iPhone valide ton identité.")
                .settingsFootnote()
        }
    }

    private var notificationsCard: some View {
        SettingsCard(
            eyebrow: "Temps réel",
            title: "Notifications",
            icon: "bell.badge"
        ) {
            Toggle("Alertes sur cet iPhone", isOn: $notificationsEnabled)
                .tint(VelvetColor.champagneGold)
            Toggle("Centre de notifications Velvet", isOn: $inAppEnabled)
                .tint(VelvetColor.champagneGold)
            Toggle("Récapitulatif par e-mail", isOn: $emailEnabled)
                .tint(VelvetColor.champagneGold)

            if notificationsDenied {
                Button("Ouvrir les réglages iOS") {
                    NotificationService.openSystemSettings()
                }
                .font(VelvetTypography.body(size: 13, weight: .semibold))
                .foregroundStyle(VelvetColor.champagneGold)
            }

            Divider().overlay(VelvetColor.borderSubtle)
            notificationToggle("Messages", value: $eventPreferences.messages)
            notificationToggle("Likes", value: $eventPreferences.likes)
            notificationToggle("Accès aux albums", value: $eventPreferences.albumAccess)
            notificationToggle("Visites de profil", value: $eventPreferences.profileViews)
            notificationToggle("Événements", value: $eventPreferences.events)
            notificationToggle("Recommandations", value: $eventPreferences.recommendations)
            notificationToggle("Sécurité", value: $eventPreferences.security)
        }
    }

    private func audienceCard(
        eyebrow: String,
        title: String,
        selection: Binding<Set<String>>
    ) -> some View {
        SettingsCard(eyebrow: eyebrow, title: title, icon: "person.2") {
            ForEach(Self.audiences, id: \.id) { audience in
                Button {
                    if selection.wrappedValue.contains(audience.id) {
                        selection.wrappedValue.remove(audience.id)
                    } else {
                        selection.wrappedValue.insert(audience.id)
                    }
                } label: {
                    HStack {
                        Text(audience.label)
                            .font(VelvetTypography.body(size: 14))
                            .foregroundStyle(VelvetColor.ivory)
                        Spacer()
                        Image(
                            systemName: selection.wrappedValue.contains(audience.id)
                                ? "checkmark.circle.fill"
                                : "circle"
                        )
                        .foregroundStyle(
                            selection.wrappedValue.contains(audience.id)
                                ? VelvetColor.champagneGold
                                : VelvetColor.textSecondary
                        )
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var locationCard: some View {
        SettingsCard(
            eyebrow: "À proximité",
            title: "Localisation",
            icon: "location"
        ) {
            Toggle("Afficher les lieux proches", isOn: $locationEnabled)
                .tint(VelvetColor.champagneGold)
            Text("Velvet conserve uniquement une zone approximative d’environ 10 km. Les coordonnées exactes ne sont jamais publiées.")
                .settingsFootnote()
        }
    }

    private var accountCard: some View {
        SettingsCard(
            eyebrow: "Compte",
            title: "Services & données",
            icon: "person.crop.circle"
        ) {
            NavigationLink {
                MemberToolsView()
            } label: {
                settingsRow("Outils du profil", detail: "Rédaction, organisateur et cycle du compte")
            }

            NavigationLink {
                StoreKitPreparationView()
            } label: {
                settingsRow("Abonnement Velvet", detail: "Achats gérés par l’App Store")
            }

            Button(role: .destructive) {
                showsDeletion = true
            } label: {
                settingsRow(
                    "Supprimer définitivement mon compte",
                    detail: "Action irréversible",
                    destructive: true
                )
            }
            .buttonStyle(.plain)
        }
    }

    private func notificationToggle(_ title: String, value: Binding<Bool>) -> some View {
        Toggle(title, isOn: value)
            .font(VelvetTypography.body(size: 13))
            .tint(VelvetColor.champagneGold)
    }

    private func settingsRow(
        _ title: String,
        detail: String,
        destructive: Bool = false
    ) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(VelvetTypography.body(size: 14, weight: .semibold))
                    .foregroundStyle(destructive ? VelvetColor.danger : VelvetColor.ivory)
                Text(detail)
                    .font(VelvetTypography.caption(size: 10))
                    .foregroundStyle(VelvetColor.textSecondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(VelvetColor.textSecondary)
        }
        .contentShape(Rectangle())
    }

    @MainActor
    private func loadSettings() async {
        biometrics.refreshAvailability()
        biometricEnabled = biometrics.isEnabled

        let status = await NotificationService.authorizationStatus()
        notificationsEnabled = status == .authorized || status == .provisional
        notificationsDenied = status == .denied

        do {
            let settings = try await appState.session.memberSettings()
            discoverableBy = Set(settings.privacy.discoverableBy)
            contactableBy = Set(settings.privacy.contactableBy)
            notifyFrom = Set(settings.notifications.notifyFrom)
            eventPreferences = settings.notifications.eventTypes
            inAppEnabled = settings.notifications.inAppEnabled
            emailEnabled = settings.notifications.emailEnabled
            locationEnabled = settings.location.enabled
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
        settingsLoaded = true
    }

    @MainActor
    private func updateNotifications(_ enabled: Bool) async {
        do {
            if enabled {
                let granted = try await NotificationService.requestAuthorization()
                notificationsEnabled = granted
                notificationsDenied = !granted
            } else {
                await NotificationService.disable()
            }
        } catch {
            notificationsEnabled = false
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }

    @MainActor
    private func saveSettings() async {
        isWorking = true
        defer { isWorking = false }
        do {
            let result = try await appState.session.saveMemberSettings(
                MemberSettingsRequest(
                    discoverableBy: discoverableBy.sorted(),
                    contactableBy: contactableBy.sorted(),
                    notifyFrom: notifyFrom.sorted(),
                    eventTypes: eventPreferences,
                    inAppEnabled: inAppEnabled,
                    browserEnabled: false,
                    emailEnabled: emailEnabled,
                    quietHoursStart: nil,
                    quietHoursEnd: nil
                )
            )
            eventPreferences = result.notifications.eventTypes
            appState.alertMessage = "Tes préférences Velvet sont enregistrées."
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }
}

private struct SettingsCard<Content: View>: View {
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
                        .font(.system(size: 17, weight: .medium))
                        .foregroundStyle(VelvetColor.champagneGold)
                        .frame(width: 38, height: 38)
                        .background(VelvetColor.champagneGold.opacity(0.08))
                        .clipShape(Circle())
                    VStack(alignment: .leading, spacing: 2) {
                        Text(eyebrow.uppercased())
                            .font(VelvetTypography.caption(size: 9, weight: .semibold))
                            .tracking(1.4)
                            .foregroundStyle(VelvetColor.champagneGold)
                        Text(title)
                            .font(VelvetTypography.title(size: 21))
                            .foregroundStyle(VelvetColor.ivory)
                    }
                }
                content
            }
        }
    }
}

private extension View {
    func settingsFootnote() -> some View {
        font(VelvetTypography.caption(size: 11))
            .foregroundStyle(VelvetColor.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
    }
}

private struct StoreKitPreparationView: View {
    @StateObject private var storeKit = StoreKitService()

    var body: some View {
        ZStack {
            VelvetBackground()
            ContentUnavailableView(
                "StoreKit prêt",
                systemImage: "apple.logo",
                description: Text("Aucun produit n’est codé en dur. Les identifiants viendront du catalogue validé dans App Store Connect.")
            )
            .foregroundStyle(VelvetColor.textSecondary)
        }
        .navigationTitle("Abonnements")
    }
}

private struct AccountDeletionView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState
    @State private var confirmation = ""
    @State private var isWorking = false

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()
                VelvetCard {
                    VStack(alignment: .leading, spacing: VelvetSpacing.lg) {
                        VelvetSectionHeader(
                            "Action irréversible",
                            title: "Supprimer le compte",
                            subtitle: "L’accès, le profil et les données rattachées au compte seront supprimés selon la politique de conservation Velvet."
                        )
                        VelvetField(
                            title: "Écris SUPPRIMER pour confirmer",
                            prompt: "SUPPRIMER",
                            text: $confirmation,
                            contentType: nil
                        )
                        VelvetPrimaryButton(
                            "Supprimer définitivement",
                            isLoading: isWorking,
                            isDisabled: confirmation != "SUPPRIMER"
                        ) {
                            Task { await deleteAccount() }
                        }
                    }
                }
                .padding(VelvetSpacing.lg)
            }
            .navigationTitle("Suppression")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Annuler", action: dismiss.callAsFunction)
                }
            }
        }
    }

    @MainActor
    private func deleteAccount() async {
        isWorking = true
        defer { isWorking = false }
        do {
            try await appState.session.deleteAccount(confirmation: confirmation)
            dismiss()
            await appState.logout()
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }
}
