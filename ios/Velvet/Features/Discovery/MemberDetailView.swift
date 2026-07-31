import SwiftUI

/// Point d’entrée historique conservé pour Maps, Recherche et les notifications.
/// La fiche complète est désormais portée par PremiumMemberDetailView afin de
/// garantir la même richesse fonctionnelle que la version Web.
struct MemberDetailView: View {
    let profile: MemberProfile

    var body: some View {
        PremiumMemberDetailView(profile: profile)
    }
}
