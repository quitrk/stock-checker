// ProfileView.swift
// StockIQ

import SwiftUI

struct ProfileView: View {
    @Environment(APIClient.self) private var api
    @Environment(AuthManager.self) private var authManager
    @Environment(\.dismiss) private var dismiss

    @State private var showLogoutConfirmation = false

    var body: some View {
        NavigationStack {
            List {
                // User Info Section
                if let user = api.currentUser {
                    Section {
                        HStack(spacing: 16) {
                            // Avatar
                            AsyncImage(url: user.avatarURL) { image in
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                            } placeholder: {
                                Text(user.initials)
                                    .font(.title2)
                                    .fontWeight(.semibold)
                                    .foregroundStyle(.white)
                                    .frame(width: 60, height: 60)
                                    .background(Color.accentColor)
                            }
                            .frame(width: 60, height: 60)
                            .clipShape(Circle())
                            .accessibilityLabel("Profile picture")

                            // Name & Email
                            VStack(alignment: .leading, spacing: 4) {
                                Text(user.name)
                                    .font(.headline)
                                Text(user.email)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 8)
                    }

                    // Account Info Section
                    Section("Account") {
                        LabeledContent("Provider", value: user.provider.rawValue.capitalized)
                        LabeledContent("Member since", value: formatDate(user.createdAt))
                    }
                }

                // Actions Section
                Section {
                    Button(role: .destructive) {
                        showLogoutConfirmation = true
                    } label: {
                        HStack {
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                                .accessibilityHidden(true)
                            Text("Sign Out")
                        }
                    }
                    .accessibilityLabel("Sign Out")
                    .accessibilityHint("Double tap to sign out of your account")
                }
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .confirmationDialog(
                "Sign Out",
                isPresented: $showLogoutConfirmation,
                titleVisibility: .visible
            ) {
                Button("Sign Out", role: .destructive) {
                    Task {
                        await authManager.logout()
                        dismiss()
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Are you sure you want to sign out?")
            }
        }
    }

    private func formatDate(_ isoString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        // Try with fractional seconds first
        if let date = formatter.date(from: isoString) {
            return formatDisplayDate(date)
        }

        // Try without fractional seconds
        formatter.formatOptions = [.withInternetDateTime]
        if let date = formatter.date(from: isoString) {
            return formatDisplayDate(date)
        }

        return isoString
    }

    private func formatDisplayDate(_ date: Date) -> String {
        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .medium
        displayFormatter.timeStyle = .none
        return displayFormatter.string(from: date)
    }
}

#Preview {
    ProfileView()
        .environment(APIClient(config: .development))
        .environment(AuthManager(apiClient: APIClient(config: .development)))
}
