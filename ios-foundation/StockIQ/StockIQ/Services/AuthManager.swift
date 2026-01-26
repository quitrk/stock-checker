// AuthManager.swift
// StockIQ

import Foundation
import AuthenticationServices
import Observation

@MainActor
@Observable
final class AuthManager: NSObject {

    // MARK: - State

    private(set) var isAuthenticating = false
    private(set) var authError: String?

    // MARK: - Dependencies

    private let apiClient: APIClient
    private let keychain = KeychainService.shared

    // MARK: - OAuth

    private var webAuthSession: ASWebAuthenticationSession?
    private weak var presentationAnchor: ASPresentationAnchor?

    // MARK: - Init

    init(apiClient: APIClient) {
        self.apiClient = apiClient
        super.init()
    }

    // MARK: - Session Restoration

    func restoreSession() async {
        guard let token = keychain.getSession() else { return }

        apiClient.setSession(token)

        do {
            let response = try await apiClient.checkAuth()
            if !response.isAuthenticated {
                keychain.deleteSession()
                await apiClient.logout()
            }
        } catch {
            keychain.deleteSession()
            await apiClient.logout()
        }
    }

    // MARK: - OAuth Flow

    func signInWithGoogle(from anchor: ASPresentationAnchor) async {
        await performOAuthFlow(provider: "google", anchor: anchor)
    }

    private func performOAuthFlow(provider: String, anchor: ASPresentationAnchor) async {
        isAuthenticating = true
        authError = nil
        presentationAnchor = anchor

        let authURL = apiClient.baseURL.appendingPathComponent("api/auth/\(provider)")
        var components = URLComponents(url: authURL, resolvingAgainstBaseURL: true)!
        components.queryItems = [URLQueryItem(name: "platform", value: "ios")]

        guard let url = components.url else {
            authError = "Invalid auth URL"
            isAuthenticating = false
            return
        }

        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            webAuthSession = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: "stockiqme"
            ) { [weak self] callbackURL, error in
                Task { @MainActor in
                    defer { continuation.resume() }
                    await self?.handleOAuthCallback(callbackURL: callbackURL, error: error)
                }
            }

            webAuthSession?.presentationContextProvider = self
            webAuthSession?.prefersEphemeralWebBrowserSession = false
            webAuthSession?.start()
        }
    }

    private func handleOAuthCallback(callbackURL: URL?, error: Error?) async {
        defer { isAuthenticating = false }

        if let error = error as? ASWebAuthenticationSessionError,
           error.code == .canceledLogin {
            return
        }

        guard let callbackURL = callbackURL else {
            authError = error?.localizedDescription ?? "Authentication failed"
            return
        }

        // Parse: stockiq://auth/callback?session=xxx&status=success
        guard let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
              let status = components.queryItems?.first(where: { $0.name == "status" })?.value else {
            authError = "Invalid callback URL"
            return
        }

        if status == "error" {
            let errorMsg = components.queryItems?.first(where: { $0.name == "error" })?.value
            authError = errorMsg ?? "Authentication failed"
            return
        }

        guard let sessionId = components.queryItems?.first(where: { $0.name == "session" })?.value else {
            authError = "No session received"
            return
        }

        do {
            try keychain.saveSession(sessionId)
            apiClient.setSession(sessionId)
            _ = try await apiClient.checkAuth()
        } catch {
            authError = "Failed to save session"
            keychain.deleteSession()
        }
    }

    // MARK: - Logout

    func logout() async {
        await apiClient.logout()
        keychain.deleteSession()
    }
}

// MARK: - ASWebAuthenticationPresentationContextProviding

extension AuthManager: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        presentationAnchor ?? ASPresentationAnchor()
    }
}
