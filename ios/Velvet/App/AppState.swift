import Foundation
import Combine

@MainActor
final class AppState: ObservableObject {
    enum Phase {
        case launching
        case signedOut
        case consentRequired(Account)
        case onboarding(Account)
        case profileSetup(MemberProfile)
        case home(MemberProfile)
        case passwordReset(RecoveryTokens)

        var id: String {
            switch self {
            case .launching: "launching"
            case .signedOut: "signedOut"
            case .consentRequired: "consentRequired"
            case .onboarding: "onboarding"
            case .profileSetup: "profileSetup"
            case .home: "home"
            case .passwordReset: "passwordReset"
            }
        }
    }

    @Published private(set) var phase: Phase = .launching
    @Published private(set) var isWorking = false
    @Published var alertMessage: String?

    let session: SessionService
    private var pendingCheckinToken: String?

    init(session: SessionService = SessionService()) {
        self.session = session
    }

    func restoreSession() async {
        guard case .launching = phase else { return }
        await perform(showErrors: false) {
            do {
                let account = try await session.restore()
                try await route(account: account)
            } catch APIError.unauthorized {
                phase = .signedOut
            }
        }
    }

    func login(email: String, password: String, turnstileToken: String?) async {
        await perform {
            let account = try await session.login(
                email: email,
                password: password,
                turnstileToken: turnstileToken
            )
            try await route(account: account)
        }
    }

    func grantConsents() async {
        await perform {
            let account = try await session.grantConsents()
            try await route(account: account)
        }
    }

    func restoreAfterSignUp() async {
        await perform {
            let account = try await session.restore()
            try await route(account: account)
        }
    }

    func completeOnboarding(_ request: ProfileUpsertRequest) async {
        await perform {
            let response = try await session.saveProfile(request)
            phase = response.profile.isAdmitted ? .home(response.profile) : .profileSetup(response.profile)
            if response.profile.isAdmitted {
                await redeemPendingCheckinIfPossible()
            }
        }
    }

    func refreshProfile() async {
        await perform {
            guard let profile = try await session.profile().profile else {
                throw APIError.transport("Le profil Zwit est introuvable.")
            }
            phase = profile.isAdmitted ? .home(profile) : .profileSetup(profile)
            if profile.isAdmitted {
                await redeemPendingCheckinIfPossible()
            }
        }
    }

    func continueToPreview(_ profile: MemberProfile) {
        phase = .home(profile)
    }

    func handle(url: URL) {
        if let token = ZwitCheckinDeepLink.token(from: url) {
            pendingCheckinToken = token
            if case .home = phase {
                Task { await redeemPendingCheckinIfPossible() }
            }
            return
        }
        if let tokens = RecoveryTokens(url: url) {
            phase = .passwordReset(tokens)
            return
        }
        _ = NotificationService.handleDeepLink(url)
    }

    func updatePassword(_ password: String, tokens: RecoveryTokens) async {
        await perform {
            try await session.updatePassword(password, tokens: tokens)
            let account = try await session.restore()
            try await route(account: account)
        }
    }

    func logout() async {
        await perform(showErrors: false) {
            await NotificationService.detachCurrentDevice()
            await session.logout()
            VelvetNotificationSnapshotStore.clear()
            pendingCheckinToken = nil
            phase = .signedOut
        }
    }

    private func route(account: Account) async throws {
        if account.status == .pendingConsent {
            phase = .consentRequired(account)
            return
        }

        let profile = try await session.profile()
        if let memberProfile = profile.profile {
            phase = memberProfile.isAdmitted ? .home(memberProfile) : .profileSetup(memberProfile)
            await NotificationService.registerIfAuthorized()
            if memberProfile.isAdmitted {
                await redeemPendingCheckinIfPossible()
            }
        } else {
            phase = .onboarding(account)
        }
    }

    private func redeemPendingCheckinIfPossible() async {
        guard case .home = phase, let token = pendingCheckinToken else { return }
        do {
            let result = try await session.redeemCheckin(token: token)
            pendingCheckinToken = nil
            alertMessage = "Présence confirmée · \(result.checkin.eventTitle). Ton Passeport Zwit vient d’être mis à jour."
        } catch APIError.unauthorized {
            // Le deep-link reste en mémoire pendant cette session et sera repris après reconnexion.
            phase = .signedOut
        } catch {
            pendingCheckinToken = nil
            alertMessage = ErrorMessage.text(for: error)
        }
    }

    private func perform(
        showErrors: Bool = true,
        operation: () async throws -> Void
    ) async {
        isWorking = true
        defer { isWorking = false }

        do {
            try await operation()
        } catch APIError.unauthorized {
            phase = .signedOut
            if showErrors {
                alertMessage = "Ta session a expiré. Reconnecte-toi."
            }
        } catch {
            if showErrors {
                alertMessage = ErrorMessage.text(for: error)
            } else {
                phase = .signedOut
            }
        }
    }
}
