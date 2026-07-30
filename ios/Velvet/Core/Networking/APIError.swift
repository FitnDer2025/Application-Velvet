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
        "authentication_required": "Ta session a expiré. Reconnecte-toi."
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
