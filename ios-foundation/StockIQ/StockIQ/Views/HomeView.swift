// HomeView.swift
// StockIQ

import SwiftUI

struct HomeView: View {
    @Environment(APIClient.self) var api

    var body: some View {
        NavigationStack {
            SearchView()
                .navigationTitle("StockIQ")
        }
    }
}

#Preview {
    HomeView()
        .environment(APIClient(config: .development))
}
