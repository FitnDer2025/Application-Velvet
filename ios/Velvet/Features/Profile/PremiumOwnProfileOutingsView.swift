import SwiftUI

struct PremiumOwnProfileOutingsView: View {
    @EnvironmentObject private var store: VelvetStore
    let profile: MemberProfile

    @State private var plans: PlanStateResponse?
    @State private var showsPlanner = false

    private var upcomingVisits: [VenueVisit] {
        (plans?.venueVisits ?? [])
            .filter { $0.profileId == profile.id }
            .filter {
                guard let date = $0.visitDate.profileOutingDateValue else { return true }
                return date >= Calendar.current.startOfDay(for: Date())
            }
            .sorted {
                ($0.visitDate.profileOutingDateValue ?? .distantFuture)
                    < ($1.visitDate.profileOutingDateValue ?? .distantFuture)
            }
    }

    var body: some View {
        VStack(spacing: 0) {
            OwnProfileOutingsPanel(
                profile: profile,
                visits: upcomingVisits,
                add: { showsPlanner = true }
            )
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 6)
            .background(VelvetColor.velvetBlack.opacity(0.94))

            PremiumOwnProfileView(profile: profile)
        }
        .sheet(isPresented: $showsPlanner) {
            ProfileVenuePlanningSheet(profile: profile) { updated in
                plans = updated
            }
            .environmentObject(store)
        }
        .task {
            plans = try? await store.service.plans()
        }
    }
}
