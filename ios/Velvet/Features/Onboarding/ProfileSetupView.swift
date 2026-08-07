import PhotosUI
import SwiftUI

struct ProfileSetupView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.openURL) private var openURL
    let profile: MemberProfile

    @State private var selectedItems: [PhotosPickerItem] = []
    @State private var photos: [ProfilePhoto] = []
    @State private var partnerEmail = ""
    @State private var invitation: CoupleInvitation?
    @State private var verification: VerificationResponse?
    @State private var isWorking = false

    private var approvedCount: Int {
        photos.filter { $0.moderationStatus == "approved" }.count
    }

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: VelvetSpacing.xl) {
                        VelvetSectionHeader(
                            "Admission",
                            title: "Finalise ton entrée.",
                            subtitle: "Les vérifications restent côté serveur. Zwit ne conserve aucun document d’identité."
                        )

                        if profile.profileType == .couple {
                            partnerSection
                        }

                        photosSection
                        verificationSection
                        admissionState

                        VelvetPrimaryButton(
                            "Actualiser mon admission",
                            isLoading: isWorking
                        ) {
                            Task {
                                await load()
                                await appState.refreshProfile()
                            }
                        }

                        Button("Prévisualiser l’accueil") {
                            appState.continueToPreview(profile)
                        }
                        .font(VelvetTypography.caption(size: 13, weight: .semibold))
                        .foregroundStyle(VelvetColor.textSecondary)
                        .frame(maxWidth: .infinity)
                    }
                    .padding(VelvetSpacing.lg)
                }
            }
            .navigationTitle("Admission")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Déconnexion") { Task { await appState.logout() } }
                }
            }
        }
        .task { await load() }
        .onChange(of: selectedItems) { _, items in
            Task { await upload(items) }
        }
    }

    private var partnerSection: some View {
        VelvetCard {
            VStack(alignment: .leading, spacing: VelvetSpacing.md) {
                VelvetSectionHeader(
                    "Profil Couple",
                    title: "Invite ton ou ta partenaire.",
                    subtitle: "Son lien personnel expire après 7 jours. Sa fiche et ses consentements lui appartiennent."
                )
                if invitation?.partnerAccepted == true {
                    Label("Partenaire inscrit·e — validation en cours", systemImage: "person.2.fill")
                        .foregroundStyle(VelvetColor.success)
                } else {
                    VelvetField(
                        title: "E-mail du partenaire",
                        prompt: "partenaire@email.fr",
                        text: $partnerEmail,
                        contentType: .emailAddress,
                        keyboardType: .emailAddress
                    )
                    VelvetPrimaryButton(
                        invitation == nil ? "Envoyer l’invitation" : "Renvoyer l’invitation",
                        isLoading: isWorking,
                        isDisabled: !partnerEmail.contains("@")
                    ) {
                        Task { await invitePartner() }
                    }
                    if let invitation {
                        Text("État : \(invitation.deliveryStatus ?? invitation.status ?? "en attente")")
                            .font(VelvetTypography.caption())
                            .foregroundStyle(VelvetColor.textSecondary)
                    }
                }
            }
        }
    }

    private var photosSection: some View {
        VelvetCard {
            VStack(alignment: .leading, spacing: VelvetSpacing.md) {
                VelvetSectionHeader(
                    "Galerie publique",
                    title: "\(approvedCount) photo\(approvedCount > 1 ? "s" : "") approuvée\(approvedCount > 1 ? "s" : "")",
                    subtitle: profile.profileType == .couple
                        ? "Chaque photo doit montrer clairement les deux adultes, au minimum à mi-corps."
                        : "Chaque photo doit montrer clairement une seule personne adulte, au minimum à mi-corps."
                )

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: VelvetSpacing.sm) {
                        ForEach(photos) { photo in
                            AsyncImage(url: photo.previewUrl) { image in
                                image.resizable().scaledToFill()
                            } placeholder: {
                                ProgressView().tint(VelvetColor.champagneGold)
                            }
                            .frame(width: 112, height: 142)
                            .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.medium))
                            .overlay(alignment: .bottom) {
                                Text(photo.moderationStatus.labelledModeration)
                                    .font(VelvetTypography.caption(size: 9, weight: .semibold))
                                    .padding(.horizontal, 7)
                                    .padding(.vertical, 4)
                                    .background(.black.opacity(0.72))
                                    .clipShape(Capsule())
                                    .padding(6)
                            }
                            .contextMenu {
                                Button("Supprimer", role: .destructive) {
                                    Task { await delete(photo) }
                                }
                            }
                        }
                    }
                }

                PhotosPicker(
                    selection: $selectedItems,
                    maxSelectionCount: max(1, 3 - photos.count),
                    matching: .images
                ) {
                    Label("Ajouter et compresser des photos", systemImage: "photo.badge.plus")
                        .font(VelvetTypography.body(size: 14, weight: .semibold))
                        .foregroundStyle(VelvetColor.champagneGold)
                }
                .disabled(isWorking || photos.count >= 3)

                Text("Compression locale en JPEG, puis envoi chiffré. Limite serveur : 4 Mo.")
                    .font(VelvetTypography.caption(size: 11))
                    .foregroundStyle(VelvetColor.textSecondary)
            }
        }
    }

    private var verificationSection: some View {
        VelvetCard {
            VStack(alignment: .leading, spacing: VelvetSpacing.md) {
                VelvetSectionHeader(
                    "Majorité et identité",
                    title: verification?.verification.majorityVerified == true
                        ? "Vérification validée"
                        : "Vérification externe",
                    subtitle: "Le prestataire renvoie uniquement un statut. Aucun document n’est stocké par Zwit."
                )
                if verification?.providerConfigured == true {
                    VelvetPrimaryButton("Commencer la vérification", isLoading: isWorking) {
                        Task {
                            do { openURL(try await appState.session.startVerification()) }
                            catch { appState.alertMessage = ErrorMessage.text(for: error) }
                        }
                    }
                } else {
                    Label("Prestataire pas encore configuré côté backend.", systemImage: "clock")
                        .font(VelvetTypography.caption())
                        .foregroundStyle(VelvetColor.warning)
                }
            }
        }
    }

    private var admissionState: some View {
        Label(
            profile.isAdmitted ? "Profil admis" : "Profil transmis ou en attente de complétude",
            systemImage: profile.isAdmitted ? "checkmark.seal.fill" : "hourglass"
        )
        .font(VelvetTypography.body(size: 14, weight: .semibold))
        .foregroundStyle(profile.isAdmitted ? VelvetColor.success : VelvetColor.warning)
    }

    @MainActor
    private func load() async {
        isWorking = true
        defer { isWorking = false }
        async let photosRequest = appState.session.photos()
        async let verificationRequest = appState.session.verification()
        do {
            let invitationResponse = profile.profileType == .couple
                ? try await appState.session.coupleInvitation()
                : nil
            let photosResponse = try await photosRequest
            photos = photosResponse.photos
            invitation = invitationResponse
            verification = try await verificationRequest
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }

    @MainActor
    private func invitePartner() async {
        isWorking = true
        defer { isWorking = false }
        do {
            let created = try await appState.session.invitePartner(email: partnerEmail)
            partnerEmail = created.invitedEmail
            invitation = try await appState.session.coupleInvitation()
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }

    @MainActor
    private func upload(_ items: [PhotosPickerItem]) async {
        guard !items.isEmpty else { return }
        isWorking = true
        defer {
            isWorking = false
            selectedItems = []
        }
        do {
            for item in items {
                guard let source = try await item.loadTransferable(type: Data.self) else { continue }
                let data = try ImageCompressor.jpegData(from: source)
                _ = try await appState.session.uploadPhoto(
                    data: data,
                    mediaRole: profile.profileType == .couple ? "couple_gallery" : "individual_gallery"
                )
            }
            photos = try await appState.session.photos().photos
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }

    @MainActor
    private func delete(_ photo: ProfilePhoto) async {
        do {
            try await appState.session.deletePhoto(id: photo.id)
            photos.removeAll { $0.id == photo.id }
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }
}

private extension String {
    var labelledModeration: String {
        switch self {
        case "approved": "Approuvée"
        case "rejected": "Refusée"
        default: "En vérification"
        }
    }
}
