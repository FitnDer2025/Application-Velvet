import SwiftUI

struct ZwitPassportView: View {
    @State private var passport: Passport?
    @State private var isLoading = false
    @State private var errorMessage: String?

    private let client = APIClient(baseURL: APIConfiguration.baseURL)

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header

                if isLoading && passport == nil {
                    loadingState
                } else if let passport {
                    proofGrid(passport)
                    privacyNote(passport)
                } else {
                    errorState
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 30)
        }
        .background(VelvetBackground())
        .refreshable { await load(force: true) }
        .task { await load(force: false) }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 7) {
                Text("CONFIANCE ZWIT")
                    .font(VelvetTypography.caption(size: 9, weight: .semibold))
                    .tracking(1.6)
                    .foregroundStyle(VelvetColor.champagneGold)

                Text("Passeport Zwit")
                    .font(VelvetTypography.title(size: 29))
                    .foregroundStyle(VelvetColor.ivory)

                Text("Des preuves simples et vérifiables pour savoir à qui l’on parle, sans notes ni classement des membres.")
                    .font(VelvetTypography.body(size: 12))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 8)

            Image(systemName: "checkmark.shield")
                .font(.system(size: 22, weight: .medium))
                .foregroundStyle(VelvetColor.champagneGold)
                .frame(width: 48, height: 48)
                .background(VelvetColor.champagneGold.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(VelvetColor.champagneGold.opacity(0.22), lineWidth: 0.8)
                }
        }
        .padding(18)
        .background(.ultraThinMaterial)
        .background(VelvetColor.anthracite.opacity(0.64))
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(VelvetColor.champagneGold.opacity(0.13), lineWidth: 0.8)
        }
    }

    private var loadingState: some View {
        VStack(spacing: 10) {
            ProgressView()
                .tint(VelvetColor.champagneGold)
            Text("Actualisation des preuves de confiance…")
                .font(VelvetTypography.body(size: 12))
                .foregroundStyle(VelvetColor.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 42)
    }

    @ViewBuilder
    private func proofGrid(_ passport: Passport) -> some View {
        LazyVGrid(
            columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)],
            spacing: 10
        ) {
            ForEach(passport.proofs) { proof in
                proofCard(proof)
            }
        }
    }

    private func proofCard(_ proof: Proof) -> some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 8) {
                Image(systemName: proof.symbol)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(proof.tint)
                    .frame(width: 27, height: 27)
                    .background(proof.tint.opacity(0.08))
                    .clipShape(Circle())

                Text(proof.label)
                    .font(VelvetTypography.body(size: 11, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                    .lineLimit(2)

                Spacer(minLength: 0)
            }

            Text(proof.detail)
                .font(VelvetTypography.caption(size: 10))
                .foregroundStyle(VelvetColor.textSecondary)
                .fixedSize(horizontal: false, vertical: true)

            if proof.status == "verified" {
                Text("CONFIRMÉ")
                    .font(VelvetTypography.caption(size: 8, weight: .semibold))
                    .tracking(1.1)
                    .foregroundStyle(VelvetColor.champagneGold)
            } else if proof.status == "pending" {
                Text("EN COURS")
                    .font(VelvetTypography.caption(size: 8, weight: .semibold))
                    .tracking(1.1)
                    .foregroundStyle(VelvetColor.warning)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 128, alignment: .topLeading)
        .padding(14)
        .background(.ultraThinMaterial)
        .background(VelvetColor.anthracite.opacity(0.52))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(
                    proof.status == "verified"
                        ? VelvetColor.champagneGold.opacity(0.16)
                        : VelvetColor.borderSubtle,
                    lineWidth: 0.7
                )
        }
    }

    private func privacyNote(_ passport: Passport) -> some View {
        Label {
            Text(passport.privacy)
                .fixedSize(horizontal: false, vertical: true)
        } icon: {
            Image(systemName: "lock")
        }
        .font(VelvetTypography.caption(size: 9))
        .foregroundStyle(VelvetColor.textSecondary)
        .padding(.horizontal, 4)
        .padding(.top, 2)
    }

    private var errorState: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Passeport momentanément indisponible", systemImage: "arrow.clockwise")
                .font(VelvetTypography.body(size: 13, weight: .semibold))
                .foregroundStyle(VelvetColor.ivory)

            Text(errorMessage ?? "La fiche profil reste accessible. Réessaie dans quelques instants.")
                .font(VelvetTypography.body(size: 11))
                .foregroundStyle(VelvetColor.textSecondary)

            Button("Réessayer") {
                Task { await load(force: true) }
            }
            .font(VelvetTypography.body(size: 11, weight: .semibold))
            .foregroundStyle(VelvetColor.champagneGold)
            .buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(VelvetColor.anthracite.opacity(0.48))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    @MainActor
    private func load(force: Bool) async {
        if isLoading { return }
        if !force, passport != nil { return }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response: Response = try await client.get("/api/members/passport")
            passport = response.passport
        } catch {
            errorMessage = ErrorMessage.text(for: error)
        }
    }
}

private extension ZwitPassportView {
    struct Response: Decodable {
        let passport: Passport
    }

    struct Passport: Decodable {
        let profileId: UUID?
        let profileType: String?
        let proofs: [Proof]
        let publicBadges: [String]
        let privacy: String
    }

    struct Proof: Decodable, Identifiable {
        let key: String
        let label: String
        let status: String
        let detail: String
        let verifiedAt: String?
        let count: Int?
        let lastVerifiedAt: String?
        let activeMembers: Int?

        var id: String { key }

        var symbol: String {
            switch status {
            case "verified": "checkmark"
            case "pending": "clock"
            case "not_applicable": "minus"
            default: "circle"
            }
        }

        var tint: Color {
            switch status {
            case "verified": VelvetColor.champagneGold
            case "pending": VelvetColor.warning
            default: VelvetColor.textSecondary
            }
        }
    }
}
