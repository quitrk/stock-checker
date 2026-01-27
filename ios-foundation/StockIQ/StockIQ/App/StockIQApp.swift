// StockIQApp.swift
// StockIQ

import SwiftUI

@main
struct StockIQApp: App {
    @State private var api: APIClient
    @State private var authManager: AuthManager

    init() {
        #if DEBUG
        let apiClient = APIClient(config: .development)
        #else
        let apiClient = APIClient(config: .production)
        #endif
        _api = State(initialValue: apiClient)
        _authManager = State(initialValue: AuthManager(apiClient: apiClient))
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(api)
                .environment(authManager)
                .task {
                    await authManager.restoreSession()
                }
        }
    }
}

// MARK: - Content View

struct ContentView: View {
    @Environment(APIClient.self) private var api

    var body: some View {
        Group {
            if api.isAuthenticated {
                TabView {
                    HomeView()
                        .tabItem {
                            Label("Search", systemImage: "magnifyingglass")
                        }

                    WatchlistsView()
                        .tabItem {
                            Label("Watchlists", systemImage: "list.bullet")
                        }
                }
            } else {
                HomeView()
            }
        }
        .animation(.easeInOut, value: api.isAuthenticated)
    }
}
