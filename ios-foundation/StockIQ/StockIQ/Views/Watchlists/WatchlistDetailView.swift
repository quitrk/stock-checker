// WatchlistDetailView.swift
// StockIQ

import SwiftUI

enum SortOption: String, CaseIterable {
    case symbol = "Symbol"
    case price = "Price"
    case change = "Change"
    case weight = "Weight"
}

struct WatchlistDetailView: View {
    @Environment(APIClient.self) private var api

    let watchlistId: String
    let watchlistName: String

    @State private var watchlist: WatchlistWithStocks?
    @State private var isOwner = false
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var selectedSymbol: String?
    @State private var sortBy: SortOption = .symbol
    @State private var sortAscending = true

    private var sortedStocks: [WatchlistStock] {
        guard let stocks = watchlist?.stocks else { return [] }

        let sorted = stocks.sorted { a, b in
            switch sortBy {
            case .symbol:
                return a.symbol < b.symbol
            case .price:
                return a.price < b.price
            case .change:
                return a.priceChangePercent < b.priceChangePercent
            case .weight:
                return (a.weight ?? 0) < (b.weight ?? 0)
            }
        }

        return sortAscending ? sorted : sorted.reversed()
    }

    var body: some View {
        Group {
            if isLoading && watchlist == nil {
                ProgressView()
            } else if let error = errorMessage, watchlist == nil {
                ContentUnavailableView {
                    Label("Error", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") {
                        Task { await loadWatchlist() }
                    }
                }
            } else if watchlist != nil {
                List {
                    ForEach(sortedStocks) { stock in
                        Button {
                            selectedSymbol = stock.symbol
                        } label: {
                            StockRow(stock: stock, showWeight: watchlist?.isSystemWatchlist ?? false)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .refreshable {
                    await loadWatchlist()
                }
            } else {
                ContentUnavailableView("No stocks", systemImage: "list.bullet")
            }
        }
        .navigationTitle(watchlistName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Menu {
                    Picker("Sort by", selection: $sortBy) {
                        ForEach(SortOption.allCases, id: \.self) { option in
                            if option == .weight && watchlist?.isSystemWatchlist != true {
                                // Skip weight for non-system watchlists
                            } else {
                                Text(option.rawValue).tag(option)
                            }
                        }
                    }

                    Divider()

                    Button {
                        sortAscending.toggle()
                    } label: {
                        Label(
                            sortAscending ? "Ascending" : "Descending",
                            systemImage: sortAscending ? "arrow.up" : "arrow.down"
                        )
                    }
                } label: {
                    Image(systemName: "arrow.up.arrow.down")
                }
            }
        }
        .task {
            await loadWatchlist()
        }
        .navigationDestination(item: $selectedSymbol) { symbol in
            StockDetailView(symbol: symbol)
        }
    }

    private func loadWatchlist() async {
        isLoading = true
        errorMessage = nil

        do {
            let result = try await api.getWatchlist(id: watchlistId)
            watchlist = result.watchlist
            isOwner = result.isOwner
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }
}

// MARK: - Stock Row

struct StockRow: View {
    @Environment(APIClient.self) private var api

    let stock: WatchlistStock
    let showWeight: Bool

    private var logoURL: URL? {
        guard let logoPath = stock.logoUrl else { return nil }
        // If it's already a full URL, use it directly
        if logoPath.hasPrefix("http") {
            return URL(string: logoPath)
        }
        // Otherwise, combine with base URL
        return api.baseURL.appendingPathComponent(logoPath)
    }

    var body: some View {
        HStack(spacing: 12) {
            // Logo (lazy loaded)
            LazyStockLogo(url: logoURL, symbol: stock.symbol, size: 40)

            // Symbol & Name
            VStack(alignment: .leading, spacing: 2) {
                Text(stock.symbol)
                    .font(.headline)
                Text(stock.companyName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            // Weight (for ETF holdings)
            if showWeight, let weight = stock.weightPercent {
                Text(String(format: "%.2f%%", weight))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(width: 60, alignment: .trailing)
            }

            // Price & Change
            VStack(alignment: .trailing, spacing: 2) {
                Text(String(format: "$%.2f", stock.price))
                    .font(.subheadline)
                    .fontWeight(.medium)

                HStack(spacing: 2) {
                    Image(systemName: stock.isPriceUp ? "arrow.up.right" : "arrow.down.right")
                        .font(.caption2)
                    Text(String(format: "%.2f%%", abs(stock.priceChangePercent)))
                        .font(.caption)
                }
                .foregroundStyle(stock.isPriceUp ? .green : .red)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Stock Detail View (placeholder for navigation)

struct StockDetailView: View {
    @Environment(APIClient.self) private var api

    let symbol: String

    @State private var result: ChecklistResult?
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
            } else if let error = errorMessage {
                ContentUnavailableView {
                    Label("Error", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") {
                        Task { await loadChecklist() }
                    }
                }
            } else if let result = result {
                ScrollView {
                    VStack(spacing: 16) {
                        StockHeader(result: result)
                        ChecklistView(categories: result.categories)
                    }
                    .padding()
                }
            }
        }
        .navigationTitle(symbol)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadChecklist()
        }
    }

    private func loadChecklist() async {
        isLoading = true
        errorMessage = nil

        do {
            result = try await api.getChecklist(symbol: symbol)
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }
}

#Preview {
    NavigationStack {
        WatchlistDetailView(watchlistId: "XBI", watchlistName: "XBI Holdings")
    }
    .environment(APIClient(config: .development))
}
