// SearchView.swift
// StockIQ

import SwiftUI

struct SearchView: View {
    @Environment(APIClient.self) private var api

    @AppStorage("defaultStock") private var defaultStock: String = ""

    @State private var searchText = ""
    @State private var isLoading = false
    @State private var result: ChecklistResult?
    @State private var errorMessage: String?
    @State private var hasLoadedDefault = false

    var body: some View {
        VStack(spacing: 0) {
            SearchBar(text: $searchText) {
                Task { await search() }
            } onClear: {
                result = nil
                errorMessage = nil
            }

            if isLoading {
                Spacer()
                ProgressView("Loading...")
                Spacer()
            } else if let error = errorMessage {
                Spacer()
                ContentUnavailableView {
                    Label("Error", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Try Again") {
                        Task { await search() }
                    }
                    .buttonStyle(.bordered)
                }
                Spacer()
            } else if let result {
                ScrollView {
                    VStack(spacing: 16) {
                        StockHeader(result: result)
                        ChecklistView(categories: result.categories)

                        // Analyst ratings
                        if let analystData = result.analystData {
                            AnalystSection(analystData: analystData, currentPrice: result.price)
                        }

                        // Catalysts
                        if !result.catalystEvents.isEmpty {
                            CatalystsSection(catalystEvents: result.catalystEvents, currentSymbol: result.symbol)
                        }

                        // News
                        if !result.news.isEmpty {
                            NewsSection(news: result.news, summary: result.newsSummary)
                        }
                    }
                    .padding(.vertical)
                }
            } else {
                Spacer()
                ContentUnavailableView {
                    Label("Search for a Stock", systemImage: "magnifyingglass")
                } description: {
                    Text("Enter a ticker symbol to view stock information")
                }
                Spacer()
            }
        }
        .background(Color.groupedBackground)
        .task {
            guard !hasLoadedDefault, !defaultStock.isEmpty else { return }
            hasLoadedDefault = true
            searchText = defaultStock
            await search()
            if result != nil {
                searchText = ""
            }
        }
    }

    private func search() async {
        let symbol = searchText.trimmingCharacters(in: .whitespaces).uppercased()
        guard !symbol.isEmpty else { return }

        isLoading = true
        errorMessage = nil
        result = nil

        do {
            result = try await api.getChecklist(symbol: symbol)
        } catch let error as APIError {
            errorMessage = error.localizedDescription
        } catch {
            errorMessage = "An unexpected error occurred"
        }

        isLoading = false
    }
}

#Preview("Light") {
    NavigationStack {
        SearchView()
            .navigationTitle("StockIQ")
    }
    .environment(APIClient(config: .development))
}

#Preview("Dark") {
    NavigationStack {
        SearchView()
            .navigationTitle("StockIQ")
    }
    .environment(APIClient(config: .development))
    .preferredColorScheme(.dark)
}
