// StockIQApp.swift
// StockIQ

import SwiftUI

@main
struct StockIQApp: App {
    @State private var api = APIClient(config: .development)

    var body: some Scene {
        WindowGroup {
            HomeView()
                .environment(api)
        }
    }
}
