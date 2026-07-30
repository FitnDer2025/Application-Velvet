import Foundation

struct EmptyBody: Encodable, Sendable {}

final class APIClient: @unchecked Sendable {
    private let baseURL: URL
    private let session: URLSession
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    init(
        baseURL: URL? = APIClient.configuredBaseURL(),
        session: URLSession? = nil
    ) {
        self.baseURL = baseURL ?? URL(string: "https://invalid.velvet.local")!

        if let session {
            self.session = session
        } else {
            let configuration = URLSessionConfiguration.default
            configuration.httpCookieStorage = .shared
            configuration.httpCookieAcceptPolicy = .always
            configuration.httpShouldSetCookies = true
            configuration.waitsForConnectivity = true
            configuration.timeoutIntervalForRequest = 30
            configuration.timeoutIntervalForResource = 60
            self.session = URLSession(configuration: configuration)
        }

        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        self.encoder = encoder

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601
        self.decoder = decoder
    }

    func get<Response: Decodable & Sendable>(
        _ path: String,
        as type: Response.Type = Response.self
    ) async throws -> Response {
        try await request(path: path, method: "GET", body: Optional<EmptyBody>.none, as: type)
    }

    func post<Body: Encodable & Sendable, Response: Decodable & Sendable>(
        _ path: String,
        body: Body,
        as type: Response.Type = Response.self
    ) async throws -> Response {
        try await request(path: path, method: "POST", body: body, as: type)
    }

    func postWithoutResponse<Body: Encodable & Sendable>(
        _ path: String,
        body: Body
    ) async throws {
        let _: Acknowledgement = try await request(
            path: path,
            method: "POST",
            body: body,
            as: Acknowledgement.self
        )
    }

    private func request<Body: Encodable & Sendable, Response: Decodable & Sendable>(
        path: String,
        method: String,
        body: Body?,
        as type: Response.Type
    ) async throws -> Response {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw APIError.invalidConfiguration
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Velvet-iOS/0.1", forHTTPHeaderField: "X-Velvet-Client")

        if let body {
            request.httpBody = try encoder.encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.invalidResponse
            }
            guard 200..<300 ~= httpResponse.statusCode else {
                throw APIError.from(data: data, status: httpResponse.statusCode, decoder: decoder)
            }
            return try decoder.decode(type, from: data)
        } catch let error as APIError {
            throw error
        } catch let error as DecodingError {
            throw APIError.transport("La réponse de Velvet n’a pas pu être lue : \(error.localizedDescription)")
        } catch {
            throw APIError.transport("Connexion impossible. Vérifie ton réseau puis réessaie.")
        }
    }

    private static func configuredBaseURL() -> URL? {
        guard
            let value = Bundle.main.object(forInfoDictionaryKey: "VelvetAPIBaseURL") as? String,
            let url = URL(string: value),
            url.scheme == "https"
        else {
            return nil
        }
        return url
    }
}

private struct Acknowledgement: Decodable, Sendable {
    let ok: Bool?
}
