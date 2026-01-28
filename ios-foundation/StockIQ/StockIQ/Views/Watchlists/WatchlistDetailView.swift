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
    @State private var filterText = ""
    @State private var showCatalysts = false
    @State private var catalysts: [CatalystEvent] = []
    @State private var isLoadingCatalysts = false
    @State private var isAddingSymbol = false
    @State private var validatedSymbol: String?
    @State private var isValidatingSymbol = false

    private var filteredAndSortedStocks: [WatchlistStock] {
        guard let stocks = watchlist?.stocks else { return [] }

        // Filter
        let filtered = filterText.isEmpty ? stocks : stocks.filter { stock in
            stock.symbol.localizedCaseInsensitiveContains(filterText) ||
            stock.companyName.localizedCaseInsensitiveContains(filterText)
        }

        // Sort
        let sorted = filtered.sorted { a, b in
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
                    Button("Try Again") {
                        Task { await loadWatchlist() }
                    }
                    .buttonStyle(.bordered)
                }
            } else if watchlist != nil {
                List {
                    if filteredAndSortedStocks.isEmpty && !filterText.isEmpty && isOwner {
                        // No matches - offer to add the symbol if valid
                        if isValidatingSymbol {
                            HStack {
                                ProgressView()
                                    .controlSize(.small)
                                Text("Checking \(filterText.uppercased())...")
                                    .foregroundStyle(.secondary)
                            }
                        } else if let symbol = validatedSymbol, symbol == filterText.uppercased() {
                            Button {
                                Task { await addSymbol(symbol) }
                            } label: {
                                HStack {
                                    Image(systemName: "plus.circle.fill")
                                        .foregroundStyle(.blue)
                                    Text("Add \(symbol) to watchlist")
                                    Spacer()
                                    if isAddingSymbol {
                                        ProgressView()
                                            .controlSize(.small)
                                    }
                                }
                            }
                            .disabled(isAddingSymbol)
                        } else if filterText.count >= 1 {
                            Text("No matching symbols")
                                .foregroundStyle(.secondary)
                        }
                    }

                    ForEach(filteredAndSortedStocks) { stock in
                        Button {
                            selectedSymbol = stock.symbol
                        } label: {
                            StockRow(stock: stock, showWeight: watchlist?.isSystemWatchlist ?? false)
                        }
                        .buttonStyle(.plain)
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            if isOwner {
                                Button(role: .destructive) {
                                    Task { await removeSymbol(stock.symbol) }
                                } label: {
                                    Label("Remove", systemImage: "trash")
                                }
                            }
                        }
                    }
                }
                .refreshable {
                    await loadWatchlist()
                }
                .searchable(text: $filterText, prompt: isOwner ? "Filter or add symbols" : "Filter symbols")
            } else {
                ContentUnavailableView("No stocks", systemImage: "list.bullet")
            }
        }
        .navigationTitle(watchlistName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button {
                    showCatalysts = true
                    Task { await loadCatalysts() }
                } label: {
                    Image(systemName: "calendar")
                }
            }
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
        .sheet(isPresented: $showCatalysts) {
            NavigationStack {
                Group {
                    if isLoadingCatalysts {
                        ProgressView()
                    } else if catalysts.isEmpty {
                        ContentUnavailableView("No Catalysts", systemImage: "calendar.badge.exclamationmark")
                    } else {
                        ScrollView {
                            CatalystsSection(catalystEvents: catalysts, embedded: true, onSelectSymbol: { symbol in
                                showCatalysts = false
                                selectedSymbol = symbol
                            })
                                .padding()
                        }
                    }
                }
                .navigationTitle("Catalysts")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Done") { showCatalysts = false }
                    }
                }
            }
            .presentationDetents([.medium, .large])
        }
        .task {
            await loadWatchlist()
        }
        .onChange(of: filterText) { _, newValue in
            validatedSymbol = nil
            let symbol = newValue.uppercased().trimmingCharacters(in: .whitespaces)
            guard !symbol.isEmpty,
                  filteredAndSortedStocks.isEmpty,
                  isOwner else {
                isValidatingSymbol = false
                return
            }

            isValidatingSymbol = true
            Task {
                await validateSymbol(symbol)
            }
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

    private func removeSymbol(_ symbol: String) async {
        do {
            _ = try await api.removeSymbol(from: watchlistId, symbol: symbol)
            await loadWatchlist()
        } catch {
            // Could show error toast here
        }
    }

    private func addSymbol(_ symbol: String) async {
        isAddingSymbol = true
        do {
            _ = try await api.addSymbol(to: watchlistId, symbol: symbol)
            filterText = ""
            validatedSymbol = nil
            await loadWatchlist()
        } catch {
            // Could show error toast here
        }
        isAddingSymbol = false
    }

    private func validateSymbol(_ symbol: String) async {
        isValidatingSymbol = true
        do {
            // Try to fetch the checklist - if it succeeds, the symbol is valid
            _ = try await api.getChecklist(symbol: symbol)
            // Only set if filter text still matches
            if filterText.uppercased() == symbol {
                validatedSymbol = symbol
            }
        } catch {
            // Symbol doesn't exist or error - don't offer to add
            if filterText.uppercased() == symbol {
                validatedSymbol = nil
            }
        }
        isValidatingSymbol = false
    }

    private func loadCatalysts() async {
        isLoadingCatalysts = true
        do {
            catalysts = try await api.getWatchlistCatalysts(id: watchlistId)
        } catch {
            catalysts = []
        }
        isLoadingCatalysts = false
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
                .accessibilityHidden(true)
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(stock.symbol), \(stock.companyName)")
        .accessibilityValue("\(String(format: "$%.2f", stock.price)), \(stock.isPriceUp ? "up" : "down") \(String(format: "%.2f%%", abs(stock.priceChangePercent)))")
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
                    Button("Try Again") {
                        Task { await loadChecklist() }
                    }
                    .buttonStyle(.bordered)
                }
            } else if let result = result {
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
