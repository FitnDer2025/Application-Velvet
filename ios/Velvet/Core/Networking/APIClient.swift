import Foundation

struct EmptyBody: Encodable, Sendable {}

struct MultipartPart: Sendable {
    let name: String
    let fileName: String?
    let mimeType: String?
    let data: Data

    static func field(_ name: String, value: String) -> MultipartPart {
        MultipartPart(name: name, fileName: nil, mimeType: nil, data: Data(value.utf8))
    }

    static func file(_ name: String, fileName: String, mimeType: String, data: Data) -> MultipartPart {
        MultipartPart(name: name, fileName: fileName, mimeType: mimeType, data: data)
    }
}

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
        // Les handlers Cloudflare existants lisent les corps métier en camelCase.
        // Les rares contrats snake_case (settings) construisent leurs clés explicitement.
        encoder.keyEncodingStrategy = .useDefaultKeys
        self.encoder = encoder

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601
        self.decoder = decoder
    }

    func get<Response: Decodable & Sendable>(
        _ path: String,
        query: [URLQueryItem] = [],
        as type: Response.Type = Response.self
    ) async throws -> Response {
        try await request(
            path: path,
            query: query,
            method: "GET",
            body: Optional<EmptyBody>.none,
            as: type
        )
    }

    func post<Body: Encodable & Sendable, Response: Decodable & Sendable>(
        _ path: String,
        body: Body,
        as type: Response.Type = Response.self
    ) async throws -> Response {
        try await request(path: path, method: "POST", body: body, as: type)
    }

    func patch<Body: Encodable & Sendable, Response: Decodable & Sendable>(
        _ path: String,
        body: Body,
        as type: Response.Type = Response.self
    ) async throws -> Response {
        try await request(path: path, method: "PATCH", body: body, as: type)
    }

    func delete<Response: Decodable & Sendable>(
        _ path: String,
        query: [URLQueryItem] = [],
        as type: Response.Type = Response.self
    ) async throws -> Response {
        try await request(
            path: path,
            query: query,
            method: "DELETE",
            body: Optional<EmptyBody>.none,
            as: type
        )
    }

    func upload<Response: Decodable & Sendable>(
        _ path: String,
        parts: [MultipartPart],
        as type: Response.Type = Response.self
    ) async throws -> Response {
        let boundary = "Velvet-\(UUID().uuidString)"
        var data = Data()
        for part in parts {
            data.append(Data("--\(boundary)\r\n".utf8))
            var disposition = "Content-Disposition: form-data; name=\"\(part.name)\""
            if let fileName = part.fileName {
                disposition += "; filename=\"\(fileName)\""
            }
            data.append(Data("\(disposition)\r\n".utf8))
            if let mimeType = part.mimeType {
                data.append(Data("Content-Type: \(mimeType)\r\n".utf8))
            }
            data.append(Data("\r\n".utf8))
            data.append(part.data)
            data.append(Data("\r\n".utf8))
        }
        data.append(Data("--\(boundary)--\r\n".utf8))

        return try await dataRequest(
            path: path,
            method: "POST",
            contentType: "multipart/form-data; boundary=\(boundary)",
            body: data,
            as: type
        )
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
        query: [URLQueryItem] = [],
        method: String,
        body: Body?,
        as type: Response.Type
    ) async throws -> Response {
        guard
            let rawURL = URL(string: path, relativeTo: baseURL),
            var components = URLComponents(url: rawURL, resolvingAgainstBaseURL: true)
        else {
            throw APIError.invalidConfiguration
        }
        if !query.isEmpty {
            components.queryItems = (components.queryItems ?? []) + query
        }
        guard let url = components.url else { throw APIError.invalidConfiguration }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Velvet-iOS/0.1", forHTTPHeaderField: "X-Velvet-Client")

        if let body {
            request.httpBody = try encoder.encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        return try await execute(request, as: type)
    }

    private func dataRequest<Response: Decodable & Sendable>(
        path: String,
        method: String,
        contentType: String,
        body: Data,
        as type: Response.Type
    ) async throws -> Response {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw APIError.invalidConfiguration
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Velvet-iOS/0.2", forHTTPHeaderField: "X-Velvet-Client")
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        request.httpBody = body
        return try await execute(request, as: type)
    }

    private func execute<Response: Decodable & Sendable>(
        _ request: URLRequest,
        as type: Response.Type
    ) async throws -> Response {
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
