// WatchlistsView.swift
// StockIQ

import SwiftUI

struct WatchlistsView: View {
    @Environment(APIClient.self) private var api
    @Environment(AuthManager.self) private var authManager

    @State private var userWatchlists: [WatchlistSummary] = []
    @State private var defaultWatchlists: [WatchlistSummary] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showAuthSheet = false

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && userWatchlists.isEmpty && defaultWatchlists.isEmpty {
                    ProgressView()
                } else if let error = errorMessage, userWatchlists.isEmpty && defaultWatchlists.isEmpty {
                    ContentUnavailableView {
                        Label("Error", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(error)
                    } actions: {
                        Button("Retry") {
                            Task { await loadWatchlists() }
                        }
                    }
                } else {
                    List {
                        // User watchlists (if authenticated)
                        if api.isAuthenticated && !userWatchlists.isEmpty {
                            Section("My Watchlists") {
                                ForEach(userWatchlists) { watchlist in
                                    NavigationLink(value: watchlist) {
                                        WatchlistRow(watchlist: watchlist)
                                    }
                                }
                            }
                        }

                        // Default/system watchlists
                        if !defaultWatchlists.isEmpty {
                            Section("ETF Holdings") {
                                ForEach(defaultWatchlists) { watchlist in
                                    NavigationLink(value: watchlist) {
                                        WatchlistRow(watchlist: watchlist)
                                    }
                                }
                            }
                        }
                    }
                    .refreshable {
                        await loadWatchlists()
                    }
                }
            }
            .navigationTitle("Watchlists")
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
                }
            }
            .navigationDestination(for: WatchlistSummary.self) { watchlist in
                WatchlistDetailView(watchlistId: watchlist.id, watchlistName: watchlist.name)
            }
            .sheet(isPresented: $showAuthSheet) {
                if api.isAuthenticated {
                    ProfileView()
                } else {
                    LoginView()
                }
            }
        }
        .task {
            await loadWatchlists()
        }
        .onChange(of: api.isAuthenticated) { _, _ in
            Task { await loadWatchlists() }
        }
    }

    private func loadWatchlists() async {
        isLoading = true
        errorMessage = nil

        // Load default watchlists (always available)
        do {
            defaultWatchlists = try await api.getDefaultWatchlists()
        } catch {
            // Ignore - defaults are optional
        }

        // Load user watchlists if authenticated
        if api.isAuthenticated {
            do {
                userWatchlists = try await api.getWatchlists()
            } catch {
                // Don't set errorMessage - we still have defaults
            }
        } else {
            userWatchlists = []
        }

        isLoading = false
    }
}

// MARK: - Watchlist Row

struct WatchlistRow: View {
    let watchlist: WatchlistSummary

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(watchlist.name)
                    .font(.headline)
                Text("\(watchlist.symbolCount) symbols")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if watchlist.isSystemWatchlist {
                Image(systemName: "building.columns")
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    WatchlistsView()
        .environment(APIClient(config: .development))
        .environment(AuthManager(apiClient: APIClient(config: .development)))
}
