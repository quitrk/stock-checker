// APIError.swift
// StockIQ

import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(statusCode: Int, message: String?)
    case decodingError(Error)
    case networkError(Error)
    case unauthorized
    case notFound
    case rateLimited(retryAfter: TimeInterval?)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .httpError(let code, let message):
            return message ?? "Server error (\(code))"
        case .decodingError:
            return "Failed to parse response"
        case .networkError(let error):
            return error.localizedDescription
        case .unauthorized:
            return "Please sign in to continue"
        case .notFound:
            return "Not found"
        case .rateLimited(let retryAfter):
            if let seconds = retryAfter {
                return "Too many requests. Try again in \(Int(seconds))s"
            }
            return "Too many requests. Please wait."
        }
    }
}

struct ErrorResponse: Codable {
    let error: String
    let message: String?
}
