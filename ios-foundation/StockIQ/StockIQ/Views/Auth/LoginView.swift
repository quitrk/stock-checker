// LoginView.swift
// StockIQ

import SwiftUI
import AuthenticationServices

struct LoginView: View {
    @Environment(AuthManager.self) private var authManager
    @Environment(APIClient.self) private var api
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        GeometryReader { geometry in
            VStack(spacing: 32) {
                Spacer()

                // App Logo & Title
                VStack(spacing: 16) {
                    Image("AppLogo")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 120, height: 120)
                        .clipShape(RoundedRectangle(cornerRadius: 24))
                        .accessibilityLabel("StockIQ app logo")

                    Text("StockIQ")
                        .font(.largeTitle)
                        .fontWeight(.bold)

                    Text("Your intelligent stock research assistant")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }

                Spacer()

                // Auth Buttons
                VStack(spacing: 12) {
                    // Apple Sign In
                    SignInWithAppleButton(.signIn) { request in
                        request.requestedScopes = [.email, .fullName]
                    } onCompletion: { result in
                        Task {
                            await authManager.handleAppleSignInResult(result)
                        }
                    }
                    .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
                    .frame(height: 50)
                    .cornerRadius(8)
                    .disabled(authManager.isAuthenticating)

                    // Google Sign In
                    Button {
                        if let anchor = getAnchor() {
                            Task {
                                await authManager.signInWithGoogle(from: anchor)
                            }
                        }
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "g.circle.fill")
                                .font(.title3)
                            Text("Sign in with Google")
                                .fontWeight(.medium)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(Color(.systemBackground))
                        .foregroundStyle(.primary)
                        .cornerRadius(8)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color(.systemGray4), lineWidth: 1)
                        )
                    }
                    .disabled(authManager.isAuthenticating)
                    .accessibilityLabel("Continue with Google")
                    .accessibilityHint("Sign in using your Google account")
                }
                .padding(.horizontal, 24)

                // Loading Indicator
                if authManager.isAuthenticating {
                    ProgressView()
                        .padding()
                }

                // Error Message
                if let error = authManager.authError {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }

                Spacer()

                // Legal Links
                HStack(spacing: 16) {
                    Link("Privacy Policy", destination: URL(string: "https://stockiq.me/privacy")!)
                    Text("·")
                        .foregroundStyle(.secondary)
                    Link("Terms of Service", destination: URL(string: "https://stockiq.me/terms")!)
                }
                .font(.caption)
                .padding(.bottom, 24)
            }
            .frame(width: geometry.size.width)
        }
        .background(Color(.systemGroupedBackground))
        .onChange(of: api.isAuthenticated) { _, isAuthenticated in
            if isAuthenticated {
                dismiss()
            }
        }
    }

    private func getAnchor() -> ASPresentationAnchor? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }
    }
}

#Preview {
    LoginView()
        .environment(APIClient(config: .development))
        .environment(AuthManager(apiClient: APIClient(config: .development)))
}
