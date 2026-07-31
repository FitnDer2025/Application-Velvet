import SwiftUI

struct ProfileEditorView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState
    let profile: MemberProfile

    @State private var displayName: String
    @State private var city: String
    @State private var description: String
    @State private var story: String
    @State private var searchText: String
    @State private var practicesText: String
    @State private var valuesText: String
    @State private var placesText: String
    @State private var firstName: String
    @State private var genderIdentity: String
    @State private var birthYear: Int
    @State private var childrenStatus: String
    @State private var professionPrivate: Bool
    @State private var aiField = "description"
    @State private var aiSource = ""
    @State private var aiProposal = ""
    @State private var isSaving = false
    @State private var isGenerating = false

    init(profile: MemberProfile) {
        self.profile = profile
        let person = profile.individualProfiles?.first
        _displayName = State(initialValue: profile.displayName)
        _city = State(initialValue: profile.city ?? profile.locationZone ?? "")
        _description = State(initialValue: profile.description ?? "")
        _story = State(initialValue: profile.story ?? "")
        _searchText = State(initialValue: profile.searchText ?? "")
        _practicesText = State(initialValue: (profile.practices ?? []).joined(separator: ", "))
        _valuesText = State(initialValue: (profile.valuesList ?? []).joined(separator: ", "))
        _placesText = State(initialValue: (profile.favoritePlaces ?? []).joined(separator: ", "))
        _firstName = State(initialValue: person?.firstName ?? "")
        _genderIdentity = State(initialValue: person?.genderIdentity ?? "Information privée")
        _birthYear = State(initialValue: person?.birthYear ?? Calendar.current.component(.year, from: Date()) - 30)
        _childrenStatus = State(initialValue: person?.childrenStatus ?? "Information privée")
        _professionPrivate = State(initialValue: person?.professionPrivate ?? true)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        VelvetPageHeader(
                            "Édition native",
                            title: "Modifier mon profil",
                            subtitle: "Les mêmes informations structurantes que sur le Web, avec une aide Velvet IA qui n’invente jamais ton vécu."
                        )

                        VelvetCard {
                            VStack(alignment: .leading, spacing: 14) {
                                editorTitle("Identité du profil")
                                VelvetField(title: "Nom affiché", prompt: "Notre nom Velvet", text: $displayName)
                                VelvetField(title: "Ville ou zone publique", prompt: "Lens", text: $city)
                                if profile.profileType == .couple {
                                    Text("Les fiches individuelles du couple restent indépendantes. Cette édition conserve la première fiche personnelle existante.")
                                        .font(VelvetTypography.caption(size: 10))
                                        .foregroundStyle(VelvetColor.textSecondary)
                                }
                            }
                        }

                        VelvetCard {
                            VStack(alignment: .leading, spacing: 14) {
                                editorTitle("Textes du profil")
                                profileTextEditor("Présentation", text: $description, prompt: "Décris ton univers…")
                                profileTextEditor("Notre histoire", text: $story, prompt: "Raconte votre chemin…")
                                profileTextEditor("Ce que nous recherchons", text: $searchText, prompt: "Explique les rencontres souhaitées…")
                            }
                        }

                        VelvetCard {
                            VStack(alignment: .leading, spacing: 14) {
                                editorTitle("Tags et préférences")
                                VelvetField(
                                    title: "Pratiques · séparées par des virgules",
                                    prompt: "Échangisme, massages, clubs…",
                                    text: $practicesText
                                )
                                VelvetField(
                                    title: "Valeurs · séparées par des virgules",
                                    prompt: "Consentement, communication…",
                                    text: $valuesText
                                )
                                VelvetField(
                                    title: "Lieux préférés · séparés par des virgules",
                                    prompt: "Clubs, spas, destinations…",
                                    text: $placesText
                                )
                            }
                        }

                        VelvetCard {
                            VStack(alignment: .leading, spacing: 14) {
                                editorTitle(profile.profileType == .couple ? "Première fiche personnelle" : "Fiche personnelle")
                                VelvetField(title: "Prénom", prompt: "Prénom", text: $firstName)
                                VelvetField(title: "Identité de genre", prompt: "Femme, homme…", text: $genderIdentity)
                                Stepper("Année de naissance : \(birthYear)", value: $birthYear, in: 1930...(Calendar.current.component(.year, from: Date()) - 18))
                                    .font(VelvetTypography.body(size: 13))
                                    .foregroundStyle(VelvetColor.ivory)
                                VelvetField(title: "Enfants", prompt: "Information privée", text: $childrenStatus)
                                Toggle("Profession privée", isOn: $professionPrivate)
                                    .tint(VelvetColor.champagneGold)
                                    .foregroundStyle(VelvetColor.ivory)
                            }
                        }

                        aiStudio

                        VelvetPrimaryButton(
                            "Enregistrer les modifications",
                            isLoading: isSaving,
                            isDisabled: displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                || city.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                || firstName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                        ) {
                            Task { await save() }
                        }
                    }
                    .padding(20)
                    .padding(.bottom, 30)
                }
            }
            .navigationTitle("Modifier")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fermer", action: dismiss.callAsFunction)
                        .foregroundStyle(VelvetColor.champagneGold)
                }
            }
            .toolbarBackground(VelvetColor.velvetBlack.opacity(0.92), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
        }
    }

    private var aiStudio: some View {
        VelvetCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    editorTitle("Velvet IA")
                    Spacer()
                    Image(systemName: "sparkles")
                        .foregroundStyle(VelvetColor.champagneGold)
                }

                Text("Dépose tes mots-clés. Velvet reformule sans ajouter de pratique, de limite ni d’expérience.")
                    .font(VelvetTypography.body(size: 12))
                    .foregroundStyle(VelvetColor.textSecondary)

                Picker("Texte à travailler", selection: $aiField) {
                    Text("Présentation").tag("description")
                    Text("Notre histoire").tag("story")
                    Text("Recherche").tag("search_text")
                }
                .pickerStyle(.segmented)

                TextEditor(text: $aiSource)
                    .font(VelvetTypography.body(size: 14))
                    .foregroundStyle(VelvetColor.ivory)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 110)
                    .padding(10)
                    .background(VelvetColor.ivory.opacity(0.04))
                    .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 15, style: .continuous)
                            .stroke(VelvetColor.borderSubtle, lineWidth: 1)
                    }

                VelvetPrimaryButton(
                    "Générer avec Velvet IA",
                    isLoading: isGenerating,
                    isDisabled: aiSource.trimmingCharacters(in: .whitespacesAndNewlines).count < 18
                ) {
                    Task { await generate() }
                }

                if !aiProposal.isEmpty {
                    Text(aiProposal)
                        .font(VelvetTypography.brand(size: 17))
                        .foregroundStyle(VelvetColor.ivory)
                        .lineSpacing(5)
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(VelvetColor.champagneGold.opacity(0.06))
                        .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))

                    Button {
                        applyAIProposal()
                    } label: {
                        Label("Utiliser cette proposition", systemImage: "checkmark.circle.fill")
                            .font(VelvetTypography.body(size: 13, weight: .semibold))
                            .foregroundStyle(VelvetColor.champagneGold)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func editorTitle(_ title: String) -> some View {
        Text(title)
            .font(VelvetTypography.title(size: 21))
            .foregroundStyle(VelvetColor.ivory)
    }

    private func profileTextEditor(
        _ title: String,
        text: Binding<String>,
        prompt: String
    ) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title.uppercased())
                .font(VelvetTypography.caption(size: 9, weight: .semibold))
                .tracking(1.1)
                .foregroundStyle(VelvetColor.champagneGold)
            ZStack(alignment: .topLeading) {
                if text.wrappedValue.isEmpty {
                    Text(prompt)
                        .font(VelvetTypography.body(size: 14))
                        .foregroundStyle(VelvetColor.textSecondary)
                        .padding(14)
                        .allowsHitTesting(false)
                }
                TextEditor(text: text)
                    .font(VelvetTypography.body(size: 14))
                    .foregroundStyle(VelvetColor.ivory)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 120)
                    .padding(8)
            }
            .background(VelvetColor.ivory.opacity(0.04))
            .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 15, style: .continuous)
                    .stroke(VelvetColor.borderSubtle, lineWidth: 1)
            }
        }
    }

    private func split(_ value: String) -> [String] {
        value
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    @MainActor
    private func generate() async {
        isGenerating = true
        defer { isGenerating = false }
        do {
            aiProposal = try await appState.session.generateProfileCopy(
                purpose: aiField,
                source: aiSource,
                profileType: profile.profileType,
                relationshipSince: profile.relationshipSince,
                practices: split(practicesText),
                values: split(valuesText)
            ).text
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }

    private func applyAIProposal() {
        switch aiField {
        case "story": story = aiProposal
        case "search_text": searchText = aiProposal
        default: description = aiProposal
        }
    }

    @MainActor
    private func save() async {
        isSaving = true
        defer { isSaving = false }
        do {
            let request = ProfileUpsertRequest(
                profileType: profile.profileType,
                displayName: displayName.trimmingCharacters(in: .whitespacesAndNewlines),
                city: city.trimmingCharacters(in: .whitespacesAndNewlines),
                description: description.trimmingCharacters(in: .whitespacesAndNewlines),
                story: story.trimmingCharacters(in: .whitespacesAndNewlines),
                searchText: searchText.trimmingCharacters(in: .whitespacesAndNewlines),
                practices: split(practicesText),
                valuesList: split(valuesText),
                favoritePlaces: split(placesText),
                person: ProfileUpsertRequest.Person(
                    firstName: firstName.trimmingCharacters(in: .whitespacesAndNewlines),
                    genderIdentity: genderIdentity.trimmingCharacters(in: .whitespacesAndNewlines),
                    birthYear: birthYear,
                    professionPrivate: professionPrivate,
                    childrenStatus: childrenStatus.trimmingCharacters(in: .whitespacesAndNewlines)
                )
            )
            _ = try await appState.session.saveProfile(request)
            await appState.refreshProfile()
            dismiss()
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }
}
