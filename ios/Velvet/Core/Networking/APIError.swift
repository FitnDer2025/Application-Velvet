import Foundation

enum APIError: Error, Equatable {
    case invalidConfiguration
    case invalidResponse
    case unauthorized
    case server(code: String, status: Int)
    case transport(String)
}

private struct ServerError: Decodable {
    let error: String?
}

enum ErrorMessage {
    private static let messages: [String: String] = [
        "credentials_required": "Saisis ton e-mail et ton mot de passe.",
        "invalid_credentials_or_unconfirmed_email": "Identifiants incorrects ou e-mail non confirmé.",
        "human_verification_required": "Confirme que tu es bien une personne.",
        "human_verification_failed": "La vérification de sécurité a expiré. Recommence.",
        "required_consents_missing": "Les quatre validations sont obligatoires.",
        "member_access_required": "Ce compte ne possède pas encore l’accès Membre.",
        "profile_identity_required": "Ajoute un nom de profil et une présentation d’au moins 20 caractères.",
        "first_names_required": "Le prénom est obligatoire.",
        "gender_identity_required": "Choisis une identité de genre.",
        "profile_persistence_failed": "Le profil n’a pas pu être confirmé. Réessaie.",
        "authentication_required": "Ta session a expiré. Reconnecte-toi.",
        "email_password_invitation_required": "L’e-mail, le mot de passe et le code d’invitation sont obligatoires.",
        "password_too_short": "Le mot de passe doit contenir au moins 12 caractères.",
        "password_too_weak": "Ajoute une majuscule, une minuscule, un chiffre et un symbole.",
        "invalid_partner_email": "L’adresse du ou de la partenaire est invalide.",
        "partner_email_must_be_different": "Utilise une adresse différente de la tienne.",
        "invalid_photo_file": "Choisis une image JPEG, PNG ou WebP de moins de 4 Mo.",
        "verification_provider_not_configured": "Le prestataire de vérification n’est pas encore configuré.",
        "admission_required": "Cette fonction est réservée aux membres admis.",
        "account_deletion_not_configured": "La suppression doit encore être activée côté serveur.",
        "account_deletion_confirmation_required": "Écris SUPPRIMER pour confirmer."
    ]

    static func text(for error: Error) -> String {
        if let apiError = error as? APIError {
            switch apiError {
            case .invalidConfiguration:
                return "L’adresse du service Velvet n’est pas configurée."
            case .invalidResponse:
                return "Velvet a reçu une réponse inattendue."
            case .unauthorized:
                return "Ta session a expiré. Reconnecte-toi."
            case let .server(code, _):
                return messages[code] ?? "Velvet ne peut pas terminer cette action pour le moment."
            case let .transport(message):
                return message
            }
        }
        return "Une erreur est survenue. Réessaie dans quelques instants."
    }
}

extension APIError {
    static func from(data: Data, status: Int, decoder: JSONDecoder) -> APIError {
        if status == 401 {
            return .unauthorized
        }
        let code = (try? decoder.decode(ServerError.self, from: data).error) ?? "server_error"
        return .server(code: code, status: status)
    }
}
