// StockIQApp.swift
// StockIQ

import SwiftUI

@main
struct StockIQApp: App {
    @State private var api: APIClient
    @State private var authManager: AuthManager
    @State private var isInitialized = false

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
            ZStack {
                ContentView()
                    .environment(api)
                    .environment(authManager)
                    .opacity(isInitialized ? 1 : 0)

                if !isInitialized {
                    SplashScreen()
                }
            }
            .task {
                await authManager.restoreSession()
                withAnimation(.easeOut(duration: 0.3)) {
                    isInitialized = true
                }
            }
        }
    }
}

// MARK: - Splash Screen

struct SplashScreen: View {
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                Color("LaunchBackground")
                    .ignoresSafeArea()

                // Logo stays centered (matches storyboard)
                Image("LaunchLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 160, height: 160)
                    .position(x: geometry.size.width / 2, y: geometry.size.height / 2)

                // Spinner positioned below the logo
                ProgressView()
                    .controlSize(.large)
                    .tint(.white)
                    .position(x: geometry.size.width / 2, y: geometry.size.height / 2 + 100)
            }
        }
        .ignoresSafeArea()
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
