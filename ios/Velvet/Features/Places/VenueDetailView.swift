import SwiftUI

struct VenueDetailView: View {
    @EnvironmentObject private var store: VelvetStore
    let venue: Venue

    @State private var favorite = false
    @State private var visited = false
    @State private var planning = false
    @State private var plannedDate = Date().addingTimeInterval(24 * 3600)
    @State private var showsPlanningSheet = false
    @State private var isWorking = false

    private var currentProfile: MemberProfile? {
        guard let profileID = store.engagementState.currentProfileId else { return nil }
        return store.directory?.profiles.first(where: { $0.id == profileID })
    }

    private var attendanceAction: String {
        currentProfile?.profileType == .couple ? "Nous y serons" : "J’y serai"
    }

    private var visitedLabel: String {
        currentProfile?.profileType == .couple ? "Nous y sommes déjà allés" : "J’y suis déjà allé·e"
    }

    var body: some View {
        ZStack {
            VelvetBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    VelvetPageHeader(
                        venue.verificationStatus == "verified"
                            ? "Établissement vérifié"
                            : "Lieu Velvet",
                        title: venue.name,
                        subtitle: [venue.categoryPrimary ?? venue.kind, venue.city]
                            .compactMap { $0 }
                            .joined(separator: " · ")
                    )

                    VelvetCard {
                        VStack(alignment: .leading, spacing: 14) {
                            if let address = venue.addressPublic, !address.isEmpty {
                                Label(address, systemImage: "mappin.and.ellipse")
                                    .foregroundStyle(VelvetColor.ivory)
                            }
                            if let website = venue.website, let url = URL(string: website) {
                                Link(destination: url) {
                                    Label("Site de l’établissement", systemImage: "safari")
                                        .foregroundStyle(VelvetColor.champagneGold)
                                }
                            }
                            Text("Choisis une date de sortie : elle sera visible sur ta fiche et dans l’actualité des membres concernés.")
                                .font(VelvetTypography.body(size: 12))
                                .foregroundStyle(VelvetColor.textSecondary)
                        }
                    }

                    Button { showsPlanningSheet = true } label: {
                        HStack(spacing: 14) {
                            Image(systemName: "calendar.badge.plus")
                                .font(.system(size: 19, weight: .semibold))
                                .foregroundStyle(VelvetColor.velvetBlack)
                                .frame(width: 48, height: 48)
                                .background(VelvetColor.champagneGold)
                                .clipShape(Circle())
                            VStack(alignment: .leading, spacing: 4) {
                                Text(attendanceAction)
                                    .font(VelvetTypography.title(size: 22))
                                    .foregroundStyle(VelvetColor.ivory)
                                Text("Renseigner la date de cette prochaine sortie")
                                    .font(VelvetTypography.body(size: 11))
                                    .foregroundStyle(VelvetColor.textSecondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .foregroundStyle(VelvetColor.champagneGold)
                        }
                        .padding(16)
                        .background(VelvetColor.champagneGold.opacity(0.07))
                        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 22, style: .continuous)
                                .stroke(VelvetColor.champagneGold.opacity(0.22), lineWidth: 0.9)
                        }
                    }
                    .buttonStyle(.plain)

                    VelvetCard {
                        VStack(alignment: .leading, spacing: 15) {
                            Text("MON LIEN AVEC CE LIEU")
                                .font(VelvetTypography.caption(size: 9, weight: .semibold))
                                .tracking(1.4)
                                .foregroundStyle(VelvetColor.champagneGold)

                            relationshipToggle(
                                "Favori",
                                icon: "heart",
                                relation: "favorite",
                                value: $favorite
                            )
                            relationshipToggle(
                                visitedLabel,
                                icon: "checkmark.circle",
                                relation: "visited",
                                value: $visited
                            )
                        }
                    }

                    VelvetPrimaryButton(
                        currentProfile?.profileType == .couple
                            ? "Ajouter notre visite aujourd’hui"
                            : "Ajouter ma visite aujourd’hui",
                        isLoading: isWorking
                    ) {
                        Task { await addVisit() }
                    }
                }
                .padding(20)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showsPlanningSheet) {
            NavigationStack {
                ZStack {
                    VelvetBackground()
                    VStack(alignment: .leading, spacing: 22) {
                        VelvetPageHeader(
                            "Prochaine sortie",
                            title: attendanceAction,
                            subtitle: venue.name
                        )
                        DatePicker(
                            "Date de la sortie",
                            selection: $plannedDate,
                            in: Calendar.current.startOfDay(for: Date())...,
                            displayedComponents: [.date]
                        )
                        .datePickerStyle(.graphical)
                        .tint(VelvetColor.champagneGold)
                        .padding(14)
                        .background(VelvetColor.panelRaised.opacity(0.72))
                        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))

                        VelvetPrimaryButton(attendanceAction, isLoading: isWorking) {
                            Task { await savePlannedOuting() }
                        }
                        Spacer()
                    }
                    .padding(20)
                }
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Annuler") { showsPlanningSheet = false }
                            .foregroundStyle(VelvetColor.champagneGold)
                    }
                }
            }
            .presentationDetents([.large])
        }
    }

    private func relationshipToggle(
        _ title: String,
        icon: String,
        relation: String,
        value: Binding<Bool>
    ) -> some View {
        Toggle(isOn: value) {
            Label(title, systemImage: icon)
                .font(VelvetTypography.body(size: 14))
        }
        .tint(VelvetColor.champagneGold)
        .onChange(of: value.wrappedValue) { _, enabled in
            Task { await saveRelationship(relation, enabled: enabled) }
        }
    }

    @MainActor
    private func saveRelationship(_ relation: String, enabled: Bool) async {
        do {
            _ = try await store.service.setVenueRelationship(
                venueID: venue.id,
                relation: relation,
                enabled: enabled
            )
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }

    @MainActor
    private func savePlannedOuting() async {
        isWorking = true
        defer { isWorking = false }
        do {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.dateFormat = "yyyy-MM-dd"
            _ = try await store.service.setVenueRelationship(
                venueID: venue.id,
                relation: "planning",
                enabled: true,
                visitDate: formatter.string(from: plannedDate)
            )
            planning = true
            showsPlanningSheet = false
            await store.load()
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }

    @MainActor
    private func addVisit() async {
        isWorking = true
        defer { isWorking = false }
        do {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.dateFormat = "yyyy-MM-dd"
            _ = try await store.service.addVenueVisit(
                venueID: venue.id,
                visitDate: formatter.string(from: Date())
            )
            visited = true
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }
}
