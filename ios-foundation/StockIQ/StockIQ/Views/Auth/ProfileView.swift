// ProfileView.swift
// StockIQ

import SwiftUI

struct ProfileView: View {
    @Environment(APIClient.self) private var api
    @Environment(AuthManager.self) private var authManager
    @Environment(\.dismiss) private var dismiss

    @State private var showLogoutConfirmation = false
    @State private var showDeleteConfirmation = false
    @State private var isDeleting = false
    @State private var deleteError: String?

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

                // Legal Section
                Section {
                    Link(destination: URL(string: "https://stockiq.me/privacy")!) {
                        HStack {
                            Image(systemName: "hand.raised")
                                .accessibilityHidden(true)
                            Text("Privacy Policy")
                            Spacer()
                            Image(systemName: "arrow.up.right")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .accessibilityHidden(true)
                        }
                    }
                    .foregroundStyle(.primary)

                    Link(destination: URL(string: "https://stockiq.me/terms")!) {
                        HStack {
                            Image(systemName: "doc.text")
                                .accessibilityHidden(true)
                            Text("Terms of Service")
                            Spacer()
                            Image(systemName: "arrow.up.right")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .accessibilityHidden(true)
                        }
                    }
                    .foregroundStyle(.primary)
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

                // Danger Zone
                Section {
                    Button(role: .destructive) {
                        showDeleteConfirmation = true
                    } label: {
                        HStack {
                            if isDeleting {
                                ProgressView()
                                    .padding(.trailing, 4)
                            } else {
                                Image(systemName: "trash")
                                    .accessibilityHidden(true)
                            }
                            Text("Delete Account")
                        }
                    }
                    .disabled(isDeleting)
                    .accessibilityLabel("Delete Account")
                    .accessibilityHint("Double tap to permanently delete your account and all data")
                } footer: {
                    Text("This will permanently delete your account, watchlists, and all associated data.")
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
                        Haptics.medium()
                        await authManager.logout()
                        Haptics.success()
                        dismiss()
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Are you sure you want to sign out?")
            }
            .confirmationDialog(
                "Delete Account",
                isPresented: $showDeleteConfirmation,
                titleVisibility: .visible
            ) {
                Button("Delete Account", role: .destructive) {
                    Task {
                        await deleteAccount()
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This action cannot be undone. Your account, watchlists, and all data will be permanently deleted.")
            }
            .alert("Error", isPresented: .constant(deleteError != nil)) {
                Button("OK") {
                    deleteError = nil
                }
            } message: {
                if let error = deleteError {
                    Text(error)
                }
            }
        }
    }

    private func deleteAccount() async {
        isDeleting = true
        deleteError = nil
        Haptics.warning()

        do {
            try await authManager.deleteAccount()
            Haptics.success()
            dismiss()
        } catch {
            Haptics.error()
            deleteError = "Failed to delete account. Please try again."
        }

        isDeleting = false
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
