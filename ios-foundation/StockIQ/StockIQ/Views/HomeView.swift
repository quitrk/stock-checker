// HomeView.swift
// StockIQ

import SwiftUI

struct HomeView: View {
    @Environment(APIClient.self) var api

    @State private var showAuthSheet = false

    var body: some View {
        NavigationStack {
            SearchView()
                .navigationTitle("StockIQ")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button {
                            showAuthSheet = true
                        } label: {
                            if let user = api.currentUser, let avatarURL = user.avatarURL {
                                AsyncImage(url: avatarURL) { image in
                                    image
                                        .resizable()
                                        .aspectRatio(contentMode: .fill)
                                } placeholder: {
                                    Image(systemName: "person.circle.fill")
                                        .foregroundStyle(.secondary)
                                }
                                .frame(width: 32, height: 32)
                                .clipShape(Circle())
                            } else {
                                Image(systemName: "person.circle")
                                    .font(.title3)
                            }
                        }
                        .accessibilityLabel(api.isAuthenticated ? "Profile" : "Sign in")
                        .accessibilityHint(api.isAuthenticated ? "View your profile" : "Sign in to your account")
                    }
                }
                .sheet(isPresented: $showAuthSheet) {
                    if api.isAuthenticated {
                        ProfileView()
                    } else {
                        LoginView()
                    }
                }
        }
    }
}

#Preview {
    HomeView()
        .environment(APIClient(config: .development))
        .environment(AuthManager(apiClient: APIClient(config: .development)))
}
