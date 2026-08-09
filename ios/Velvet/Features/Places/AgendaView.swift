import SwiftUI

struct AgendaView: View {
    @EnvironmentObject private var store: VelvetStore
    @State private var state: PlanStateResponse?
    @State private var showsCreation = false
    @State private var isLoading = false

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("MON AGENDA")
                        .font(VelvetTypography.caption(size: 9, weight: .semibold))
                        .tracking(1.5)
                        .foregroundStyle(VelvetColor.champagneGold)
                    Text("Prochains projets")
                        .font(VelvetTypography.title(size: 24))
                        .foregroundStyle(VelvetColor.ivory)
                }
                Spacer()
                Button {
                    showsCreation = true
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(VelvetColor.velvetBlack)
                        .frame(width: 40, height: 40)
                        .background(VelvetColor.champagneGold)
                        .clipShape(Circle())
                }
                .accessibilityLabel("Ajouter un projet")
            }

            if isLoading && state == nil {
                ProgressView()
                    .tint(VelvetColor.champagneGold)
                    .frame(maxWidth: .infinity, minHeight: 160)
            } else if let state,
                      state.travelPlans.isEmpty,
                      state.venueVisits.isEmpty,
                      state.eventPlans.isEmpty {
                VelvetEmptyState(
                    symbol: "calendar.badge.plus",
                    title: "Ton agenda est libre",
                    message: "Ajoute un voyage, une visite d’établissement ou inscris-toi à une sortie."
                )
            } else {
                if let plans = state?.travelPlans, !plans.isEmpty {
                    agendaSection("Voyages & séjours", plans: plans)
                }
                if let visits = state?.venueVisits, !visits.isEmpty {
                    visitsSection(visits)
                }
                if let eventPlans = state?.eventPlans, !eventPlans.isEmpty {
                    VelvetCard {
                        Label(
                            "\(eventPlans.count) sortie\(eventPlans.count > 1 ? "s" : "") Zwit inscrite\(eventPlans.count > 1 ? "s" : "")",
                            systemImage: "sparkles"
                        )
                        .font(VelvetTypography.body(size: 14, weight: .semibold))
                        .foregroundStyle(VelvetColor.ivory)
                    }
                }
            }
        }
        .task { await load() }
        .refreshable { await load() }
        .sheet(isPresented: $showsCreation) {
            TravelPlanCreationView { updated in
                state = updated
            }
            .environmentObject(store)
        }
    }

    private func agendaSection(_ title: String, plans: [TravelPlan]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle(title)
            ForEach(plans) { plan in
                VelvetCard {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(plan.title)
                                    .font(VelvetTypography.title(size: 20))
                                    .foregroundStyle(VelvetColor.ivory)
                                Label(plan.locationLabel, systemImage: "mappin.and.ellipse")
                                    .font(VelvetTypography.body(size: 12))
                                    .foregroundStyle(VelvetColor.textSecondary)
                            }
                            Spacer()
                            Button(role: .destructive) {
                                Task { await delete(plan.id, type: "travel_plan") }
                            } label: {
                                Image(systemName: "trash")
                            }
                        }
                        Label(
                            "\(plan.startsOn.velvetShortDate) – \(plan.endsOn.velvetShortDate)",
                            systemImage: "calendar"
                        )
                        .font(VelvetTypography.caption(size: 11, weight: .semibold))
                        .foregroundStyle(VelvetColor.champagneGold)
                        if let notes = plan.notes, !notes.isEmpty {
                            Text(notes)
                                .font(VelvetTypography.body(size: 12))
                                .foregroundStyle(VelvetColor.textSecondary)
                        }
                    }
                }
            }
        }
    }

    private func visitsSection(_ visits: [VenueVisit]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Visites d’établissements")
            ForEach(visits) { visit in
                HStack(spacing: 13) {
                    Image(systemName: "building.2")
                        .foregroundStyle(VelvetColor.champagneGold)
                        .frame(width: 42, height: 42)
                        .background(VelvetColor.champagneGold.opacity(0.08))
                        .clipShape(Circle())
                    VStack(alignment: .leading, spacing: 3) {
                        Text(visit.venueDirectory?.name ?? "Établissement Zwit")
                            .font(VelvetTypography.body(size: 14, weight: .semibold))
                            .foregroundStyle(VelvetColor.ivory)
                        Text(visit.visitDate.velvetShortDate)
                            .font(VelvetTypography.caption(size: 10))
                            .foregroundStyle(VelvetColor.textSecondary)
                    }
                    Spacer()
                    Button(role: .destructive) {
                        Task { await delete(visit.id, type: "venue_visit") }
                    } label: {
                        Image(systemName: "xmark.circle")
                    }
                }
                .padding(15)
                .background(VelvetColor.panelRaised.opacity(0.74))
                .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.medium))
            }
        }
    }

    private func sectionTitle(_ title: String) -> some View {
        Text(title.uppercased())
            .font(VelvetTypography.caption(size: 9, weight: .semibold))
            .tracking(1.3)
            .foregroundStyle(VelvetColor.textSecondary)
    }

    @MainActor
    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            state = try await store.service.plans()
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }

    @MainActor
    private func delete(_ id: UUID, type: String) async {
        do {
            state = try await store.service.deletePlan(id: id, type: type)
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }
}

private struct TravelPlanCreationView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: VelvetStore
    let onSave: (PlanStateResponse) -> Void

    @State private var title = ""
    @State private var location = ""
    @State private var startsOn = Date()
    @State private var endsOn = Date()
    @State private var notes = ""
    @State private var isWorking = false

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()
                ScrollView {
                    VelvetCard {
                        VStack(alignment: .leading, spacing: 16) {
                            VelvetSectionHeader(
                                "Nouveau projet",
                                title: "Ajouter un séjour",
                                subtitle: "Seules les informations que tu renseignes sont enregistrées."
                            )
                            VelvetField(
                                title: "Titre",
                                prompt: "Week-end à Paris",
                                text: $title,
                                contentType: nil
                            )
                            VelvetField(
                                title: "Lieu",
                                prompt: "Paris",
                                text: $location,
                                contentType: .addressCity
                            )
                            DatePicker("Du", selection: $startsOn, displayedComponents: .date)
                                .tint(VelvetColor.champagneGold)
                            DatePicker(
                                "Au",
                                selection: $endsOn,
                                in: startsOn...,
                                displayedComponents: .date
                            )
                            .tint(VelvetColor.champagneGold)
                            VelvetField(
                                title: "Note facultative",
                                prompt: "Une envie, une adresse…",
                                text: $notes,
                                contentType: nil
                            )
                            VelvetPrimaryButton(
                                "Ajouter à mon agenda",
                                isLoading: isWorking,
                                isDisabled: title.count < 2 || location.count < 2
                            ) {
                                Task { await save() }
                            }
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Nouveau projet")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Annuler", action: dismiss.callAsFunction)
                }
            }
        }
    }

    @MainActor
    private func save() async {
        isWorking = true
        defer { isWorking = false }
        do {
            let result = try await store.service.addTravelPlan(
                title: title,
                location: location,
                startsOn: startsOn.velvetISODate,
                endsOn: endsOn.velvetISODate,
                notes: notes.isEmpty ? nil : notes
            )
            onSave(result)
            dismiss()
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }
}

private extension Date {
    var velvetISODate: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: self)
    }
}

private extension String {
    var velvetShortDate: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: self) else { return self }
        return date.formatted(
            .dateTime.day().month(.abbreviated).year().locale(Locale(identifier: "fr_FR"))
        )
    }
}
