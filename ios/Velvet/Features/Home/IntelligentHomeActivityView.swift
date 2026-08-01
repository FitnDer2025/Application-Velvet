import SwiftUI

struct IntelligentHomeActivityView: View {
    @EnvironmentObject private var store: VelvetStore
    let profile: MemberProfile

    @State private var plans: PlanStateResponse?

    private struct OutingActivity: Identifiable {
        let visit: VenueVisit
        let member: MemberProfile
        var id: UUID { visit.id }
    }

    private var activities: [OutingActivity] {
        (plans?.venueVisits ?? [])
            .compactMap { visit -> OutingActivity? in
                guard
                    visit.profileId != profile.id,
                    let memberID = visit.profileId,
                    let member = store.directory?.profiles.first(where: { $0.id == memberID })
                else { return nil }

                if let date = visit.visitDate.profileOutingDateValue,
                   date < Calendar.current.startOfDay(for: Date()) {
                    return nil
                }

                return OutingActivity(visit: visit, member: member)
            }
            .sorted {
                ($0.visit.visitDate.profileOutingDateValue ?? .distantFuture)
                    < ($1.visit.visitDate.profileOutingDateValue ?? .distantFuture)
            }
    }

    var body: some View {
        VStack(spacing: 0) {
            if !activities.isEmpty {
                activityPanel
                    .padding(.horizontal, 16)
                    .padding(.top, 10)
                    .padding(.bottom, 5)
                    .background(VelvetColor.velvetBlack.opacity(0.94))
            }

            IntelligentHomeView(profile: profile)
        }
        .task { await pollPlans() }
    }

    private var activityPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("ACTUALITÉ")
                        .font(VelvetTypography.caption(size: 8, weight: .semibold))
                        .tracking(1.5)
                        .foregroundStyle(VelvetColor.champagneGold)
                    Text("Prochaines sorties de la communauté")
                        .font(VelvetTypography.title(size: 18))
                        .foregroundStyle(VelvetColor.ivory)
                }
                Spacer()
                Text("\(activities.count)")
                    .font(VelvetTypography.title(size: 18))
                    .foregroundStyle(VelvetColor.textSecondary)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 9) {
                    ForEach(activities.prefix(8)) { activity in
                        NavigationLink {
                            MemberDetailView(profile: activity.member)
                        } label: {
                            activityCard(activity)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(14)
        .background {
            LinearGradient(
                colors: [
                    VelvetColor.velvetBurgundy.opacity(0.31),
                    VelvetColor.panelRaised.opacity(0.78)
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

    private func activityCard(_ activity: OutingActivity) -> some View {
        HStack(spacing: 10) {
            VelvetRemoteImage(
                url: activity.member.profileGalleryPhotos
                    .first(where: { $0.isPrimary == true })?.previewUrl
                    ?? activity.member.profileGalleryPhotos.first?.previewUrl,
                symbol: activity.member.profileType == .couple ? "person.2.fill" : "person.fill"
            )
            .frame(width: 42, height: 42)
            .clipShape(Circle())
            .overlay(Circle().stroke(VelvetColor.champagneGold.opacity(0.22), lineWidth: 0.8))

            VStack(alignment: .leading, spacing: 3) {
                Text(activity.member.displayName)
                    .font(VelvetTypography.body(size: 11, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                    .lineLimit(1)
                Text(activity.member.attendanceThirdPersonLabel)
                    .font(VelvetTypography.caption(size: 8, weight: .semibold))
                    .foregroundStyle(VelvetColor.champagneGold)
                Text(activity.visit.venueDirectory?.name ?? "Établissement Velvet")
                    .font(VelvetTypography.caption(size: 9))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .lineLimit(1)
                Text(activity.visit.visitDate.profileOutingDateLabel)
                    .font(VelvetTypography.caption(size: 8))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .lineLimit(1)
            }
        }
        .padding(10)
        .frame(width: 215, height: 76, alignment: .leading)
        .background(.ultraThinMaterial)
        .background(VelvetColor.velvetBlack.opacity(0.36))
        .clipShape(RoundedRectangle(cornerRadius: 17, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 17, style: .continuous)
                .stroke(VelvetColor.borderSubtle, lineWidth: 0.7)
        }
    }

    private func pollPlans() async {
        plans = try? await store.service.plans()
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(30))
            guard !Task.isCancelled else { return }
            if let refreshed = try? await store.service.plans() {
                plans = refreshed
            }
        }
    }
}
