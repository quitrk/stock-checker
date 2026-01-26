// Watchlist.swift
// StockIQ

import Foundation

// MARK: - Watchlist

struct Watchlist: Codable, Identifiable {
    let id: String
    let userId: String
    let name: String
    var items: [WatchlistItem]
    let createdAt: String
    let updatedAt: String
    let isSystem: Bool?

    var isSystemWatchlist: Bool { isSystem ?? false }
    var symbolCount: Int { items.count }
    var symbols: [String] { items.map(\.symbol) }
}

// MARK: - Watchlist Summary (for list views)

struct WatchlistSummary: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let items: [WatchlistItem]
    let updatedAt: String
    let isSystem: Bool?

    var isSystemWatchlist: Bool { isSystem ?? false }
    var symbolCount: Int { items.count }
}

// MARK: - Watchlist Item

struct WatchlistItem: Codable, Identifiable, Hashable {
    let symbol: String
    var addedAt: String?
    var historicalPrice: Double?

    var id: String { symbol }

    var addedDate: Date? {
        guard let addedAt = addedAt else { return nil }
        return DateFormatter.apiDate.date(from: addedAt)
    }
}

// MARK: - Watchlist Stock (with quote data)

struct WatchlistStock: Codable, Identifiable {
    let symbol: String
    let companyName: String
    let price: Double
    let priceChange: Double
    let priceChangePercent: Double
    let logoUrl: String?
    let weight: Double?
    let historicalPrice: Double?
    let historicalChangePercent: Double?
    let addedAt: String?

    var id: String { symbol }
    var isPriceUp: Bool { priceChange >= 0 }

    var logoURL: URL? {
        guard let urlString = logoUrl else { return nil }
        return URL(string: urlString)
    }

    /// Weight formatted as percentage (for ETF holdings)
    var weightPercent: Double? {
        guard let w = weight else { return nil }
        return w * 100
    }
}

// MARK: - Watchlist with Stocks

struct WatchlistWithStocks: Codable, Identifiable {
    let id: String
    let userId: String
    let name: String
    let items: [WatchlistItem]
    let createdAt: String
    let updatedAt: String
    let isSystem: Bool?
    let stocks: [WatchlistStock]

    var isSystemWatchlist: Bool { isSystem ?? false }
}

// MARK: - API Responses

struct WatchlistsResponse: Codable {
    let watchlists: [WatchlistSummary]
}

struct WatchlistResponse: Codable {
    let watchlist: WatchlistWithStocks
    let isOwner: Bool
}

struct SingleWatchlistResponse: Codable {
    let watchlist: Watchlist
}
