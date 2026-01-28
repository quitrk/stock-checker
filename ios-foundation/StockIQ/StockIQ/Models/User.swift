// User.swift
// StockIQ

import Foundation

struct User: Codable, Identifiable {
    let id: String
    let email: String
    let name: String
    let avatar: String?
    let provider: AuthProvider
    let providerId: String
    let createdAt: String

    var avatarURL: URL? {
        guard let urlString = avatar else { return nil }
        return URL(string: urlString)
    }

    var initials: String {
        let components = name.split(separator: " ")
        if components.count >= 2 {
            return "\(components[0].prefix(1))\(components[1].prefix(1))".uppercased()
        }
        return String(name.prefix(2)).uppercased()
    }
}

struct Session: Codable {
    let id: String
    let userId: String
    let createdAt: String
    let expiresAt: String

    var isExpired: Bool {
        guard let expiresDate = ISO8601DateFormatter().date(from: expiresAt) else {
            return true
        }
        return expiresDate < Date()
    }
}

struct AuthResponse: Codable {
    let user: User?
    let isAuthenticated: Bool
}

// MARK: - Apple Sign-In

struct AppleAuthRequest: Encodable {
    let identityToken: String
    let name: String?
    let email: String?
}

struct AppleAuthResponse: Decodable {
    let sessionId: String
}
