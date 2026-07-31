import SwiftUI

struct VenueDetailView: View {
    @EnvironmentObject private var store: VelvetStore
    let venue: Venue

    @State private var favorite = false
    @State private var visited = false
    @State private var planning = false
    @State private var isWorking = false

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
                                    Label(
                                        "Site de l’établissement",
                                        systemImage: "safari"
                                    )
                                    .foregroundStyle(VelvetColor.champagneGold)
                                }
                            }
                            Text("La fiche établissement reste distincte de la carte : tu peux la consulter, l’ajouter aux favoris et planifier une visite.")
                                .font(VelvetTypography.body(size: 12))
                                .foregroundStyle(VelvetColor.textSecondary)
                        }
                    }

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
                                "J’y suis déjà allé",
                                icon: "checkmark.circle",
                                relation: "visited",
                                value: $visited
                            )
                            relationshipToggle(
                                "J’aimerais y aller",
                                icon: "calendar.badge.plus",
                                relation: "planning",
                                value: $planning
                            )
                        }
                    }

                    VelvetPrimaryButton(
                        "Ajouter une visite aujourd’hui",
                        isLoading: isWorking
                    ) {
                        Task { await addVisit() }
                    }
                }
                .padding(20)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
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
            planning = true
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }
}

