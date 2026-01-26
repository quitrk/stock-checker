// APIClient.swift
// StockIQ

import Foundation
import Observation

// MARK: - Configuration

struct APIConfig: Sendable {
    let baseURL: URL

    static let production = APIConfig(
        baseURL: URL(string: "https://your-app.vercel.app")!
    )

    static let development = APIConfig(
        baseURL: URL(string: "http://localhost:3002")!
    )
}

// MARK: - API Client

@MainActor
@Observable
final class APIClient {

    // MARK: - Observable State

    private(set) var isAuthenticated = false
    private(set) var currentUser: User?

    // MARK: - Public

    var baseURL: URL { config.baseURL }

    // MARK: - Private

    private let config: APIConfig
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder
    private var sessionToken: String?

    // MARK: - Init

    init(config: APIConfig = .production) {
        self.config = config
        self.session = URLSession.shared
        self.decoder = JSONDecoder()
        self.encoder = JSONEncoder()
    }

    // MARK: - Auth

    func checkAuth() async throws -> AuthResponse {
        let response: AuthResponse = try await get("/api/auth/me")
        currentUser = response.user
        isAuthenticated = response.isAuthenticated
        return response
    }

    func setSession(_ token: String) {
        sessionToken = token
        isAuthenticated = true
    }

    func logout() async {
        let _: Empty? = try? await post("/api/auth/logout", body: Empty())
        sessionToken = nil
        currentUser = nil
        isAuthenticated = false
    }

    // MARK: - Checklist

    func getChecklist(symbol: String, refresh: Bool = false) async throws -> ChecklistResult {
        var path = "/api/checklist/\(symbol.uppercased())"
        if refresh { path += "?refresh=true" }
        return try await get(path)
    }

    // MARK: - Watchlists

    func getWatchlists() async throws -> [WatchlistSummary] {
        let response: WatchlistsResponse = try await get("/api/watchlist")
        return response.watchlists
    }

    func getDefaultWatchlists() async throws -> [WatchlistSummary] {
        let response: WatchlistsResponse = try await get("/api/watchlist/defaults")
        return response.watchlists
    }

    func getWatchlist(id: String) async throws -> (watchlist: WatchlistWithStocks, isOwner: Bool) {
        let response: WatchlistResponse = try await get("/api/watchlist/\(id)")
        return (response.watchlist, response.isOwner)
    }

    func createWatchlist(name: String) async throws -> Watchlist {
        let response: SingleWatchlistResponse = try await post(
            "/api/watchlist",
            body: ["name": name]
        )
        return response.watchlist
    }

    func renameWatchlist(id: String, name: String) async throws -> Watchlist {
        let response: SingleWatchlistResponse = try await put(
            "/api/watchlist/\(id)",
            body: ["name": name]
        )
        return response.watchlist
    }

    func deleteWatchlist(id: String) async throws {
        let _: Empty = try await delete("/api/watchlist/\(id)")
    }

    func addSymbol(to watchlistId: String, symbol: String) async throws -> Watchlist {
        let response: SingleWatchlistResponse = try await post(
            "/api/watchlist/\(watchlistId)/symbols",
            body: ["symbol": symbol.uppercased()]
        )
        return response.watchlist
    }

    func removeSymbol(from watchlistId: String, symbol: String) async throws -> Watchlist {
        let response: SingleWatchlistResponse = try await delete(
            "/api/watchlist/\(watchlistId)/symbols/\(symbol.uppercased())"
        )
        return response.watchlist
    }

    func updateSymbolDate(
        watchlistId: String,
        symbol: String,
        addedAt: String?
    ) async throws -> Watchlist {
        struct UpdateBody: Encodable {
            let addedAt: String?
        }
        let response: SingleWatchlistResponse = try await put(
            "/api/watchlist/\(watchlistId)/symbols/\(symbol.uppercased())",
            body: UpdateBody(addedAt: addedAt)
        )
        return response.watchlist
    }

    func getWatchlistCatalysts(id: String) async throws -> [CatalystEvent] {
        let response: CatalystsResponse = try await get("/api/watchlist/\(id)/catalysts")
        return response.catalysts
    }

    // MARK: - HTTP Methods

    private func get<T: Decodable>(_ path: String) async throws -> T {
        try await request(path, method: "GET", body: nil as Empty?)
    }

    private func post<T: Decodable>(_ path: String, body: some Encodable) async throws -> T {
        try await request(path, method: "POST", body: body)
    }

    private func put<T: Decodable>(_ path: String, body: some Encodable) async throws -> T {
        try await request(path, method: "PUT", body: body)
    }

    private func delete<T: Decodable>(_ path: String) async throws -> T {
        try await request(path, method: "DELETE", body: nil as Empty?)
    }

    private func request<T: Decodable>(
        _ path: String,
        method: String,
        body: (some Encodable)?
    ) async throws -> T {
        guard let url = URL(string: path, relativeTo: config.baseURL) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let token = sessionToken {
            request.setValue("stock_session=\(token)", forHTTPHeaderField: "Cookie")
        }

        if let body = body {
            request.httpBody = try encoder.encode(body)
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.networkError(error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        switch http.statusCode {
        case 200...299:
            break
        case 401:
            sessionToken = nil
            isAuthenticated = false
            throw APIError.unauthorized
        case 404:
            throw APIError.notFound
        case 429:
            let retry = http.value(forHTTPHeaderField: "Retry-After").flatMap(Double.init)
            throw APIError.rateLimited(retryAfter: retry)
        default:
            let err = try? decoder.decode(ErrorResponse.self, from: data)
            throw APIError.httpError(statusCode: http.statusCode, message: err?.error)
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }
}

// MARK: - Helpers

private struct Empty: Codable {}
