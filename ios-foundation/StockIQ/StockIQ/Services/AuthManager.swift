// AuthManager.swift
// StockIQ

import Foundation
import UIKit
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

    // MARK: - Apple Sign-In

    private var appleSignInContinuation: CheckedContinuation<Void, Never>?

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

    // MARK: - Apple Sign-In

    /// Handle the result from SwiftUI's SignInWithAppleButton
    func handleAppleSignInResult(_ result: Result<ASAuthorization, Error>) async {
        isAuthenticating = true
        authError = nil

        switch result {
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
                authError = "Invalid credential type"
                isAuthenticating = false
                return
            }
            await handleAppleCredential(credential)

        case .failure(let error):
            isAuthenticating = false
            // Don't show error for user cancellation
            if let authError = error as? ASAuthorizationError,
               authError.code == .canceled {
                return
            }
            authError = error.localizedDescription
        }
    }

    /// Programmatic Apple Sign-In (for use outside SwiftUI button)
    func signInWithApple() async {
        isAuthenticating = true
        authError = nil

        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.email, .fullName]

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self

        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            appleSignInContinuation = continuation
            controller.performRequests()
        }
    }

    private func handleAppleCredential(_ credential: ASAuthorizationAppleIDCredential) async {
        defer {
            isAuthenticating = false
            appleSignInContinuation?.resume()
            appleSignInContinuation = nil
        }

        guard let identityToken = credential.identityToken,
              let tokenString = String(data: identityToken, encoding: .utf8) else {
            authError = "Failed to get identity token"
            return
        }

        // Build user info (only available on first sign-in)
        let name = [credential.fullName?.givenName, credential.fullName?.familyName]
            .compactMap { $0 }
            .joined(separator: " ")

        do {
            let response = try await apiClient.authenticateWithApple(
                identityToken: tokenString,
                name: name.isEmpty ? nil : name,
                email: credential.email
            )

            try keychain.saveSession(response.sessionId)
            apiClient.setSession(response.sessionId)
            _ = try await apiClient.checkAuth()
        } catch {
            authError = "Authentication failed"
            keychain.deleteSession()
        }
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

        // Parse: stockiqme://auth/callback?session=xxx&status=success
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
        if let anchor = presentationAnchor {
            return anchor
        }
        // Get the first window scene and its key window
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene {
            if let window = windowScene.windows.first {
                return window
            }
            // Fallback using window scene
            return UIWindow(windowScene: windowScene)
        }
        // Should not happen - return empty window with first available scene
        let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene
        return UIWindow(windowScene: scene!)
    }
}

// MARK: - ASAuthorizationControllerDelegate

extension AuthManager: ASAuthorizationControllerDelegate {
    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            authError = "Invalid credential type"
            isAuthenticating = false
            appleSignInContinuation?.resume()
            appleSignInContinuation = nil
            return
        }

        Task {
            await handleAppleCredential(credential)
        }
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        // Don't show error for user cancellation
        if let authError = error as? ASAuthorizationError,
           authError.code == .canceled {
            isAuthenticating = false
            appleSignInContinuation?.resume()
            appleSignInContinuation = nil
            return
        }

        self.authError = error.localizedDescription
        isAuthenticating = false
        appleSignInContinuation?.resume()
        appleSignInContinuation = nil
    }
}

// MARK: - ASAuthorizationControllerPresentationContextProviding

extension AuthManager: ASAuthorizationControllerPresentationContextProviding {
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if let anchor = presentationAnchor {
            return anchor
        }
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene {
            if let window = windowScene.windows.first {
                return window
            }
            return UIWindow(windowScene: windowScene)
        }
        let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene
        return UIWindow(windowScene: scene!)
    }
}
