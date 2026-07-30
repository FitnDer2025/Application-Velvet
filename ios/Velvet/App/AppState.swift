import Foundation
import Combine

@MainActor
final class AppState: ObservableObject {
    enum Phase {
        case launching
        case signedOut
        case consentRequired(Account)
        case onboarding(Account)
        case home(MemberProfile)

        var id: String {
            switch self {
            case .launching: "launching"
            case .signedOut: "signedOut"
            case .consentRequired: "consentRequired"
            case .onboarding: "onboarding"
            case .home: "home"
            }
        }
    }

    @Published private(set) var phase: Phase = .launching
    @Published private(set) var isWorking = false
    @Published var alertMessage: String?

    let session: SessionService

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

    func completeOnboarding(_ request: ProfileUpsertRequest) async {
        await perform {
            let response = try await session.saveProfile(request)
            phase = .home(response.profile)
        }
    }

    func logout() async {
        await perform(showErrors: false) {
            await session.logout()
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
            phase = .home(memberProfile)
        } else {
            phase = .onboarding(account)
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
