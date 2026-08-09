import SwiftUI

struct OnboardingFlowView: View {
    @EnvironmentObject private var appState: AppState
    @State private var step = 0
    @State private var profileType: MemberProfile.ProfileType = .individual
    @State private var displayName = ""
    @State private var city = ""
    @State private var firstName = ""
    @State private var genderIdentity = "Information privée"
    @State private var birthYear = ""
    @State private var profileDescription = ""

    private let genders = [
        "Homme",
        "Femme",
        "Homme trans",
        "Femme trans",
        "Personne non binaire",
        "Autre identité",
        "Information privée"
    ]

    private var currentYear: Int {
        Calendar(identifier: .gregorian).component(.year, from: Date())
    }

    private var parsedBirthYear: Int? {
        guard let value = Int(birthYear), value >= 1900, value <= currentYear - 18 else {
            return nil
        }
        return value
    }

    private var canContinue: Bool {
        switch step {
        case 0:
            true
        case 1:
            displayName.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2
                && city.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2
        case 2:
            firstName.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2
                && parsedBirthYear != nil
        default:
            profileDescription.trimmingCharacters(in: .whitespacesAndNewlines).count >= 20
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            progressHeader

            TabView(selection: $step) {
                profileChoice.tag(0)
                identityStep.tag(1)
                personStep.tag(2)
                storyStep.tag(3)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .animation(.easeInOut(duration: VelvetMotion.normal), value: step)

            footer
        }
        .background(VelvetBackground())
    }

    private var progressHeader: some View {
        HStack(spacing: VelvetSpacing.md) {
            VelvetMark(size: 46)

            VStack(alignment: .leading, spacing: VelvetSpacing.xxs) {
                Text("CRÉATION DU PROFIL")
                    .font(VelvetTypography.caption(size: 10, weight: .semibold))
                    .tracking(1.8)
                    .foregroundStyle(VelvetColor.softBlush)

                Text("Étape \(step + 1) sur 4")
                    .font(VelvetTypography.body(size: 14, weight: .medium))
                    .foregroundStyle(VelvetColor.ivory)
            }

            Spacer()

            HStack(spacing: 5) {
                ForEach(0..<4, id: \.self) { index in
                    Capsule()
                        .fill(index <= step ? VelvetColor.champagneGold : .white.opacity(0.12))
                        .frame(width: index == step ? 22 : 8, height: 5)
                }
            }
        }
        .padding(.horizontal, VelvetSpacing.lg)
        .padding(.vertical, VelvetSpacing.md)
        .background(.ultraThinMaterial)
    }

    private var profileChoice: some View {
        OnboardingPage {
            VelvetSectionHeader(
                "Ton espace",
                title: "Comment souhaites-tu apparaître ?",
                subtitle: "Chaque personne conserve son identité et ses consentements, y compris au sein d’un profil Couple."
            )

            VStack(spacing: VelvetSpacing.md) {
                ProfileTypeCard(
                    type: .individual,
                    selection: $profileType,
                    icon: "person.crop.circle",
                    detail: "Une identité personnelle, visible selon tes choix."
                )
                ProfileTypeCard(
                    type: .couple,
                    selection: $profileType,
                    icon: "person.2.circle",
                    detail: "Une identité commune et des partenaires liés individuellement."
                )
            }

            if profileType == .couple {
                Label(
                    "L’invitation sécurisée du second partenaire sera proposée après cette première fiche.",
                    systemImage: "link"
                )
                .font(VelvetTypography.caption())
                .foregroundStyle(VelvetColor.textSecondary)
            }
        }
    }

    private var identityStep: some View {
        OnboardingPage {
            VelvetSectionHeader(
                "Identité publique",
                title: "Pose les premiers repères.",
                subtitle: "Ton pseudonyme est public. Ton identité civile ne l’est jamais."
            )

            VelvetField(
                title: profileType == .couple ? "Nom du couple" : "Pseudonyme",
                prompt: profileType == .couple ? "Ex. Nous deux" : "Ex. Éclat du Nord",
                text: $displayName,
                contentType: .nickname
            )

            VelvetField(
                title: "Ville",
                prompt: "Ex. Lille",
                text: $city,
                contentType: .addressCity
            )
        }
    }

    private var personStep: some View {
        OnboardingPage {
            VelvetSectionHeader(
                "Ta fiche personnelle",
                title: "Une personne avant un profil.",
                subtitle: "Ces informations servent à appliquer la majorité et tes préférences de visibilité."
            )

            VelvetField(
                title: "Prénom",
                prompt: "Ton prénom",
                text: $firstName,
                contentType: .givenName
            )

            VStack(alignment: .leading, spacing: VelvetSpacing.xs) {
                Text("Identité de genre")
                    .font(VelvetTypography.caption(size: 13))
                    .foregroundStyle(VelvetColor.textSecondary)

                Picker("Identité de genre", selection: $genderIdentity) {
                    ForEach(genders, id: \.self) { gender in
                        Text(gender).tag(gender)
                    }
                }
                .pickerStyle(.menu)
                .tint(VelvetColor.ivory)
                .padding(.horizontal, VelvetSpacing.md)
                .frame(maxWidth: .infinity, minHeight: 50, alignment: .leading)
                .background(.white.opacity(0.045))
                .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.medium, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: VelvetRadius.medium, style: .continuous)
                        .stroke(.white.opacity(0.11), lineWidth: 1)
                }
            }

            VelvetField(
                title: "Année de naissance",
                prompt: "Ex. 1988",
                text: $birthYear,
                contentType: nil,
                keyboardType: .numberPad
            )

            if !birthYear.isEmpty, parsedBirthYear == nil {
                Label(
                    "L’accès à Zwit est réservé aux personnes majeures.",
                    systemImage: "exclamationmark.circle"
                )
                .font(VelvetTypography.caption())
                .foregroundStyle(VelvetColor.danger)
            }
        }
    }

    private var storyStep: some View {
        OnboardingPage {
            VelvetSectionHeader(
                "Présentation",
                title: "Donne envie de te découvrir.",
                subtitle: "Parle de ton univers, de ton état d’esprit et de la façon dont tu imagines de belles rencontres."
            )

            VStack(alignment: .leading, spacing: VelvetSpacing.xs) {
                Text("Présentation publique")
                    .font(VelvetTypography.caption(size: 13))
                    .foregroundStyle(VelvetColor.textSecondary)

                TextEditor(text: $profileDescription)
                    .scrollContentBackground(.hidden)
                    .font(VelvetTypography.body())
                    .foregroundStyle(VelvetColor.ivory)
                    .frame(minHeight: 180)
                    .padding(VelvetSpacing.sm)
                    .background(.white.opacity(0.045))
                    .clipShape(
                        RoundedRectangle(cornerRadius: VelvetRadius.medium, style: .continuous)
                    )
                    .overlay {
                        RoundedRectangle(cornerRadius: VelvetRadius.medium, style: .continuous)
                            .stroke(.white.opacity(0.11), lineWidth: 1)
                    }

                Text("\(profileDescription.count) caractères · 20 minimum")
                    .font(VelvetTypography.caption(size: 11))
                    .foregroundStyle(
                        profileDescription.count >= 20
                            ? VelvetColor.success
                            : VelvetColor.textSecondary
                    )
            }

            Label(
                "Aucune pratique n’est imposée pendant l’inscription. Tu pourras affiner tes choix ensuite.",
                systemImage: "heart.text.square"
            )
            .font(VelvetTypography.caption())
            .foregroundStyle(VelvetColor.textSecondary)
        }
    }

    private var footer: some View {
        HStack(spacing: VelvetSpacing.md) {
            if step > 0 {
                Button {
                    step -= 1
                } label: {
                    Image(systemName: "chevron.left")
                        .frame(width: 48, height: 48)
                        .background(.white.opacity(0.06))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .foregroundStyle(VelvetColor.ivory)
                .accessibilityLabel("Étape précédente")
            }

            VelvetPrimaryButton(
                step == 3 ? "Créer mon profil" : "Continuer",
                isLoading: appState.isWorking,
                isDisabled: !canContinue
            ) {
                if step < 3 {
                    step += 1
                } else {
                    submit()
                }
            }
        }
        .padding(VelvetSpacing.lg)
        .background(.ultraThinMaterial)
    }

    private func submit() {
        guard let birthYear = parsedBirthYear else { return }
        let description = profileDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        let request = ProfileUpsertRequest(
            profileType: profileType,
            displayName: displayName.trimmingCharacters(in: .whitespacesAndNewlines),
            city: city.trimmingCharacters(in: .whitespacesAndNewlines),
            description: description,
            story: description,
            searchText: "",
            practices: [],
            valuesList: ["Consentement", "Respect", "Discrétion"],
            favoritePlaces: [],
            person: .init(
                firstName: firstName.trimmingCharacters(in: .whitespacesAndNewlines),
                genderIdentity: genderIdentity,
                birthYear: birthYear,
                professionPrivate: true,
                childrenStatus: "private"
            )
        )

        Task {
            await appState.completeOnboarding(request)
        }
    }
}

private struct OnboardingPage<Content: View>: View {
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: VelvetSpacing.xl) {
                content
            }
            .padding(VelvetSpacing.lg)
        }
        .scrollDismissesKeyboard(.interactively)
    }
}

private struct ProfileTypeCard: View {
    let type: MemberProfile.ProfileType
    @Binding var selection: MemberProfile.ProfileType
    let icon: String
    let detail: String

    private var isSelected: Bool {
        type == selection
    }

    var body: some View {
        Button {
            selection = type
        } label: {
            HStack(spacing: VelvetSpacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 25, weight: .light))
                    .frame(width: 48, height: 48)
                    .foregroundStyle(
                        isSelected ? VelvetColor.champagneGold : VelvetColor.textSecondary
                    )
                    .background(.white.opacity(0.05))
                    .clipShape(Circle())

                VStack(alignment: .leading, spacing: VelvetSpacing.xxs) {
                    Text(type.label)
                        .font(VelvetTypography.body(size: 16, weight: .semibold))
                        .foregroundStyle(VelvetColor.ivory)
                    Text(detail)
                        .font(VelvetTypography.caption(size: 12, weight: .regular))
                        .foregroundStyle(VelvetColor.textSecondary)
                        .multilineTextAlignment(.leading)
                }

                Spacer()

                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(
                        isSelected ? VelvetColor.champagneGold : VelvetColor.borderSubtle
                    )
            }
            .padding(VelvetSpacing.md)
            .frame(maxWidth: .infinity, minHeight: 86)
            .background(
                isSelected
                    ? VelvetColor.velvetBurgundy.opacity(0.22)
                    : .white.opacity(0.035)
            )
            .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous)
                    .stroke(
                        isSelected
                            ? VelvetColor.champagneGold.opacity(0.48)
                            : .white.opacity(0.08),
                        lineWidth: 1
                    )
            }
        }
        .buttonStyle(.plain)
    }
}
