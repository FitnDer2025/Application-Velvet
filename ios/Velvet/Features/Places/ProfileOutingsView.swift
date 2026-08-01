import SwiftUI

struct ProfileVenuePlanningSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: VelvetStore

    let profile: MemberProfile
    let onSave: (PlanStateResponse) -> Void

    @State private var query = ""
    @State private var selectedVenueID: UUID?
    @State private var visitDate = Date().addingTimeInterval(24 * 3600)
    @State private var isWorking = false

    private var venues: [Venue] {
        (store.directory?.venueDirectory ?? [])
            .filter { venue in
                let category = "\(venue.kind ?? "") \(venue.categoryPrimary ?? "")"
                    .lowercased()
                let isClub = category.contains("club")
                    || category.contains("spa")
                    || category.contains("bar")
                let matchesQuery = query.isEmpty
                    || venue.name.localizedCaseInsensitiveContains(query)
                    || (venue.city ?? "").localizedCaseInsensitiveContains(query)
                return isClub && matchesQuery
            }
            .sorted {
                let left = $0.distanceKm ?? .greatestFiniteMagnitude
                let right = $1.distanceKm ?? .greatestFiniteMagnitude
                return left == right
                    ? $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
                    : left < right
            }
    }

    private var selectedVenue: Venue? {
        guard let selectedVenueID else { return nil }
        return venues.first(where: { $0.id == selectedVenueID })
            ?? store.directory?.venueDirectory.first(where: { $0.id == selectedVenueID })
    }

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()

                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        VelvetPageHeader(
                            "Depuis ton profil",
                            title: "Renseigner une sortie",
                            subtitle: "Choisis le club et la date. Cette sortie sera visible sur ta fiche et dans l’actualité des membres autorisés."
                        )

                        VelvetSearchField(
                            prompt: "Nom du club ou ville…",
                            text: $query
                        )

                        DatePicker(
                            "Date de la sortie",
                            selection: $visitDate,
                            in: Calendar.current.startOfDay(for: Date())...,
                            displayedComponents: .date
                        )
                        .datePickerStyle(.compact)
                        .tint(VelvetColor.champagneGold)
                        .foregroundStyle(VelvetColor.ivory)
                        .padding(15)
                        .background(VelvetColor.panelRaised.opacity(0.82))
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .stroke(VelvetColor.borderSubtle, lineWidth: 0.8)
                        }

                        if venues.isEmpty {
                            VelvetEmptyState(
                                symbol: "building.2",
                                title: "Aucun établissement correspondant",
                                message: "Essaie un autre nom ou une autre ville."
                            )
                        } else {
                            LazyVStack(spacing: 10) {
                                ForEach(venues) { venue in
                                    venueRow(venue)
                                }
                            }
                        }
                    }
                    .padding(20)
                    .padding(.bottom, 100)
                }
            }
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: 5) {
                    VelvetPrimaryButton(
                        confirmationLabel,
                        isLoading: isWorking,
                        isDisabled: selectedVenueID == nil
                    ) {
                        Task { await save() }
                    }

                    Text(profile.profileType == .couple
                         ? "Le texte public sera affiché au pluriel."
                         : "Le texte public sera affiché au singulier.")
                        .font(VelvetTypography.caption(size: 9))
                        .foregroundStyle(VelvetColor.textSecondary)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 11)
                .background(.ultraThinMaterial)
                .background(VelvetColor.velvetBlack.opacity(0.84))
            }
            .navigationTitle("Nouvelle sortie")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Annuler", action: dismiss.callAsFunction)
                        .foregroundStyle(VelvetColor.champagneGold)
                }
            }
            .toolbarBackground(VelvetColor.velvetBlack.opacity(0.92), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
        }
    }

    private var confirmationLabel: String {
        guard let selectedVenue else { return profile.attendanceFirstPersonLabel }
        return "\(profile.attendanceFirstPersonLabel) · \(selectedVenue.name)"
    }

    private func venueRow(_ venue: Venue) -> some View {
        Button {
            selectedVenueID = venue.id
        } label: {
            HStack(spacing: 13) {
                Image(systemName: selectedVenueID == venue.id
                      ? "checkmark.circle.fill"
                      : "building.2.crop.circle")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(VelvetColor.champagneGold)
                    .frame(width: 44, height: 44)
                    .background(VelvetColor.champagneGold.opacity(0.08))
                    .clipShape(Circle())

                VStack(alignment: .leading, spacing: 4) {
                    Text(venue.name)
                        .font(VelvetTypography.body(size: 14, weight: .semibold))
                        .foregroundStyle(VelvetColor.ivory)
                        .lineLimit(1)
                    Text([venue.categoryPrimary ?? venue.kind, venue.city]
                        .compactMap { $0 }
                        .joined(separator: " · "))
                        .font(VelvetTypography.caption(size: 10))
                        .foregroundStyle(VelvetColor.textSecondary)
                        .lineLimit(1)
                }

                Spacer()

                if let distance = venue.distanceKm {
                    Text("\(distance.formatted(.number.precision(.fractionLength(0...1)))) km")
                        .font(VelvetTypography.caption(size: 9, weight: .semibold))
                        .foregroundStyle(VelvetColor.champagneGold)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                selectedVenueID == venue.id
                    ? VelvetColor.champagneGold.opacity(0.09)
                    : VelvetColor.panelRaised.opacity(0.74)
            )
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(
                        selectedVenueID == venue.id
                            ? VelvetColor.champagneGold.opacity(0.42)
                            : VelvetColor.borderSubtle,
                        lineWidth: 0.9
                    )
            }
        }
        .buttonStyle(.plain)
    }

    @MainActor
    private func save() async {
        guard let selectedVenueID else { return }
        isWorking = true
        defer { isWorking = false }

        do {
            let result = try await store.service.addVenueVisit(
                venueID: selectedVenueID,
                visitDate: visitDate.profileOutingISODate
            )
            onSave(result)
            dismiss()
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }
}

struct OwnProfileOutingsPanel: View {
    let profile: MemberProfile
    let visits: [VenueVisit]
    let add: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("MES PROCHAINES SORTIES")
                        .font(VelvetTypography.caption(size: 8, weight: .semibold))
                        .tracking(1.35)
                        .foregroundStyle(VelvetColor.champagneGold)
                    Text(visits.isEmpty ? "Ton agenda club" : nextTitle)
                        .font(VelvetTypography.title(size: 20))
                        .foregroundStyle(VelvetColor.ivory)
                        .lineLimit(1)
                }

                Spacer()

                Button(action: add) {
                    Label("Ajouter", systemImage: "plus")
                        .font(VelvetTypography.caption(size: 10, weight: .semibold))
                        .foregroundStyle(VelvetColor.velvetBlack)
                        .padding(.horizontal, 12)
                        .frame(height: 36)
                        .background(VelvetColor.champagneGold)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }

            if visits.isEmpty {
                Text("Renseigne directement ici le club et la date de ta prochaine sortie.")
                    .font(VelvetTypography.body(size: 11))
                    .foregroundStyle(VelvetColor.textSecondary)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 9) {
                        ForEach(visits.prefix(5)) { visit in
                            HStack(spacing: 7) {
                                Image(systemName: "sparkles")
                                    .foregroundStyle(VelvetColor.champagneGold)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(visit.venueDirectory?.name ?? "Établissement Velvet")
                                        .font(VelvetTypography.body(size: 11, weight: .semibold))
                                        .foregroundStyle(VelvetColor.ivory)
                                        .lineLimit(1)
                                    Text("\(profile.attendanceFirstPersonLabel) · \(visit.visitDate.profileOutingDateLabel)")
                                        .font(VelvetTypography.caption(size: 8))
                                        .foregroundStyle(VelvetColor.textSecondary)
                                        .lineLimit(1)
                                }
                            }
                            .padding(.horizontal, 11)
                            .frame(height: 48)
                            .background(VelvetColor.ivory.opacity(0.035))
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                    }
                }
            }
        }
        .padding(15)
        .background {
            LinearGradient(
                colors: [
                    VelvetColor.velvetBurgundy.opacity(0.30),
                    VelvetColor.panelRaised.opacity(0.76)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(VelvetColor.champagneGold.opacity(0.18), lineWidth: 0.8)
        }
    }

    private var nextTitle: String {
        visits.first?.venueDirectory?.name ?? "Prochaine sortie"
    }
}

struct MemberNextOutingBanner: View {
    let profile: MemberProfile
    let visit: VenueVisit

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "calendar.badge.clock")
                .font(.system(size: 17, weight: .medium))
                .foregroundStyle(VelvetColor.champagneGold)
                .frame(width: 42, height: 42)
                .background(VelvetColor.champagneGold.opacity(0.09))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 3) {
                Text(profile.attendanceThirdPersonLabel.uppercased())
                    .font(VelvetTypography.caption(size: 8, weight: .semibold))
                    .tracking(1.1)
                    .foregroundStyle(VelvetColor.champagneGold)
                Text(visit.venueDirectory?.name ?? "Établissement Velvet")
                    .font(VelvetTypography.body(size: 14, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                    .lineLimit(1)
                Text(visit.visitDate.profileOutingDateLabel)
                    .font(VelvetTypography.caption(size: 10))
                    .foregroundStyle(VelvetColor.textSecondary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(VelvetColor.champagneGold.opacity(0.70))
        }
        .padding(14)
        .background(.ultraThinMaterial)
        .background(VelvetColor.velvetBurgundy.opacity(0.24))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(VelvetColor.champagneGold.opacity(0.20), lineWidth: 0.8)
        }
    }
}

extension MemberProfile {
    var attendanceFirstPersonLabel: String {
        profileType == .couple ? "Nous y serons" : "J’y serai"
    }

    var attendanceThirdPersonLabel: String {
        profileType == .couple ? "Ils y seront" : "Sera présent(e)"
    }
}

extension String {
    var profileOutingDateLabel: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: self) else { return self }
        return date.formatted(
            .dateTime.weekday(.wide).day().month(.wide).locale(Locale(identifier: "fr_FR"))
        )
    }

    var profileOutingDateValue: Date? {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: self)
    }
}

private extension Date {
    var profileOutingISODate: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: self)
    }
}
