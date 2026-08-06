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
        "profile_required": "Ton profil Zwit est introuvable. Reconnecte-toi puis réessaie.",
        "profile_read_failed": "Ton profil n’a pas pu être actualisé. Tire l’écran vers le bas pour réessayer.",
        "profile_write_failed": "Les modifications du profil n’ont pas pu être enregistrées. Réessaie.",
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
        "invalid_photo": "Cette photo n’est plus disponible ou son identifiant est invalide.",
        "invalid_photo_file": "Choisis une image JPEG, PNG ou WebP de moins de 4 Mo.",
        "photos_read_failed": "Tes photos et albums n’ont pas pu être chargés. Ferme puis rouvre la gestion des médias.",
        "photo_not_found": "Cette photo a déjà été supprimée ou n’est plus disponible.",
        "photo_owner_required": "Cette photo appartient au profil partagé mais ne pouvait pas être supprimée depuis ce compte.",
        "photo_storage_delete_failed": "La photo n’a pas pu être supprimée du stockage sécurisé. Réessaie dans quelques instants.",
        "photo_delete_failed": "La suppression de la photo n’a pas abouti. Réessaie dans quelques instants.",
        "album_read_failed": "Tes albums n’ont pas pu être actualisés. Tire l’écran vers le bas pour réessayer.",
        "album_creation_failed": "L’album n’a pas pu être créé. Réessaie.",
        "album_media_delete_failed": "La photo de l’album n’a pas pu être supprimée. Réessaie.",
        "home_intelligence_failed": "Zwit Intelligence n’a pas pu actualiser ta sélection. Ferme ce message puis tire l’écran vers le bas pour réessayer.",
        "location_consent_and_coordinates_required": "Autorise la localisation approximative pour activer le classement par proximité.",
        "location_write_failed": "La localisation approximative n’a pas pu être enregistrée. Zwit reste utilisable sans classement par proximité.",
        "verification_provider_not_configured": "Le prestataire de vérification n’est pas encore configuré.",
        "admission_required": "Cette fonction est réservée aux membres admis.",
        "account_deletion_not_configured": "La suppression doit encore être activée côté serveur.",
        "account_deletion_confirmation_required": "Écris SUPPRIMER pour confirmer."
    ]

    static func text(for error: Error) -> String {
        if let apiError = error as? APIError {
            switch apiError {
            case .invalidConfiguration:
                return "L’adresse du service Zwit n’est pas configurée."
            case .invalidResponse:
                return "Zwit a reçu une réponse inattendue. Ferme cet écran puis réessaie."
            case .unauthorized:
                return "Ta session a expiré. Reconnecte-toi."
            case let .server(code, _):
                return messages[code] ?? "Cette fonction n’a pas répondu correctement. Ferme ce message puis réessaie."
            case let .transport(message):
                return message
            }
        }
        return "Une erreur est survenue. Réessaie dans quelques instants."
    }
}

extension APIError {
    static func from(data: Data, status: Int, decoder: JSONDecoder) -> APIError {
        let code = (try? decoder.decode(ServerError.self, from: data).error) ?? "server_error"
        if status == 401 && code == "authentication_required" {
            return .unauthorized
        }
        return .server(code: code, status: status)
    }
}
