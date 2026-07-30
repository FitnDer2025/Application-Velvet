import SwiftUI

struct SafetyActionsView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: VelvetStore
    let profile: MemberProfile

    @State private var category = "comportement_inapproprie"
    @State private var details = ""
    @State private var isWorking = false

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()
                Form {
                    Section("Garder le contrôle") {
                        Button("Bloquer ce profil", role: .destructive) {
                            Task { await action("block", enabled: true) }
                        }
                        Text("Le blocage coupe les interactions avec toutes les personnes actives de ce profil.")
                    }
                    Section("Signaler et bloquer") {
                        Picker("Motif", selection: $category) {
                            Text("Comportement inapproprié").tag("comportement_inapproprie")
                            Text("Faux profil").tag("faux_profil")
                            Text("Harcèlement").tag("harcelement")
                            Text("Sécurité ou consentement").tag("securite_consentement")
                        }
                        TextField("Précisions utiles à la modération", text: $details, axis: .vertical)
                            .lineLimit(3...8)
                        Button("Envoyer le signalement", role: .destructive) {
                            Task { await action("report") }
                        }
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Sécurité")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if isWorking { ProgressView() }
                    else { Button("Fermer", action: dismiss.callAsFunction) }
                }
            }
        }
    }

    @MainActor
    private func action(_ action: String, enabled: Bool? = nil) async {
        isWorking = true
        defer { isWorking = false }
        do {
            _ = try await store.service.socialAction(
                profileID: profile.id,
                action: action,
                enabled: enabled,
                category: action == "report" ? category : nil,
                description: action == "report" ? details : nil
            )
            dismiss()
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }
}
