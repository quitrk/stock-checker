// Constants.swift
// StockIQ

import Foundation

enum Constants {

    // MARK: - Limits

    static let maxWatchlistsPerUser = 20
    static let maxSymbolsPerWatchlist = 100

    // MARK: - System Watchlists

    static let systemUserId = "system"

    enum SystemWatchlist {
        static let xbiId = "system-watchlist-xbi"
        static let ibbId = "system-watchlist-ibb"
    }

    // MARK: - Cache

    static let checklistCacheDuration: TimeInterval = 24 * 60 * 60 // 24 hours

    // MARK: - UI

    enum Layout {
        static let defaultPadding: CGFloat = 16
        static let smallPadding: CGFloat = 8
        static let cornerRadius: CGFloat = 12
        static let iconSize: CGFloat = 24
    }
}

// MARK: - Validation

enum Validation {

    static func isValidSymbol(_ symbol: String) -> Bool {
        let trimmed = symbol.trimmingCharacters(in: .whitespaces)
        return !trimmed.isEmpty && trimmed.count <= 10
    }

    static func isValidWatchlistName(_ name: String) -> Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    static func isValidDateString(_ date: String) -> Bool {
        let pattern = #"^\d{4}-\d{2}-\d{2}$"#
        return date.range(of: pattern, options: .regularExpression) != nil
    }

    static func formatSymbol(_ symbol: String) -> String {
        symbol.uppercased().trimmingCharacters(in: .whitespaces)
    }
}
