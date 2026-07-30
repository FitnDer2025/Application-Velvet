import SwiftUI

struct PrivacySettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState
    @StateObject private var locationService = LocationService()

    @State private var notificationsEnabled = false
    @State private var locationEnabled = false
    @State private var showsDeletion = false
    @State private var isWorking = false

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()
                Form {
                    Section("Notifications") {
                        Toggle("Alertes Velvet", isOn: $notificationsEnabled)
                            .onChange(of: notificationsEnabled) { _, enabled in
                                guard enabled else { return }
                                Task {
                                    do {
                                        notificationsEnabled = try await NotificationService.requestAuthorization()
                                    } catch {
                                        appState.alertMessage = ErrorMessage.text(for: error)
                                    }
                                }
                            }
                        Text("Le consentement iOS est prêt. L’enregistrement du jeton APNs sera activé avec le contrat push du backend.")
                    }

                    Section("Localisation approximative") {
                        Toggle("Lieux proches", isOn: $locationEnabled)
                            .onChange(of: locationEnabled) { _, enabled in
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
                        Text("Le backend arrondit la position à environ 10 km et ne stocke jamais les coordonnées exactes.")
                    }

                    Section("Abonnement") {
                        NavigationLink("Préparation App Store / StoreKit") {
                            StoreKitPreparationView()
                        }
                        Text("Les produits resteront désactivés tant que leurs identifiants App Store Connect ne seront pas reliés au catalogue Velvet.")
                    }

                    Section("Compte") {
                        Button("Supprimer définitivement mon compte", role: .destructive) {
                            showsDeletion = true
                        }
                    }
                }
                .scrollContentBackground(.hidden)
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
        }
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
