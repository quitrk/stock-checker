// Checklist.swift
// StockIQ

import Foundation

// MARK: - Checklist Result

struct ChecklistResult: Codable, Identifiable {
    let symbol: String
    let companyName: String
    let industry: String
    let price: Double
    let priceChange: Double
    let priceChangePercent: Double
    let marketCap: Double
    let logoUrl: String?
    let categories: [ChecklistCategory]
    let overallStatus: ChecklistStatus
    let timestamp: String
    let errors: [String]
    let news: [NewsItem]
    let newsSummary: String?
    let catalystEvents: [CatalystEvent]
    let analystData: AnalystData?
    let shortInterestData: ShortInterestData?
    let fdaHistory: FDAHistory?

    var id: String { symbol }

    var isPriceUp: Bool { priceChange >= 0 }

    /// Resolve logo URL against a base URL (for relative paths like /api/logo/AAPL)
    func logoURL(relativeTo baseURL: URL) -> URL? {
        guard let urlString = logoUrl else { return nil }
        // Handle both absolute and relative URLs
        if urlString.hasPrefix("http") {
            return URL(string: urlString)
        }
        return URL(string: urlString, relativeTo: baseURL)
    }
}

// MARK: - Category

struct ChecklistCategory: Codable, Identifiable {
    let id: String
    let name: String
    let description: String
    let items: [ChecklistItem]
    let status: ChecklistStatus
    let summaryItemId: String?

    var summaryItem: ChecklistItem? {
        guard let summaryId = summaryItemId else { return nil }
        return items.first { $0.id == summaryId }
    }
}

// MARK: - Item

struct ChecklistItem: Codable, Identifiable {
    let id: String
    let label: String
    let description: String
    let value: JSONValue?
    let displayValue: String
    let status: ChecklistStatus
    let thresholds: Thresholds?

    struct Thresholds: Codable {
        let safe: String
        let warning: String
        let danger: String
    }
}

// MARK: - Analyst Data

struct AnalystData: Codable {
    let targetPrice: Double?
    let targetPriceLow: Double?
    let targetPriceHigh: Double?
    let targetPriceMean: Double?
    let numberOfAnalysts: Int?
    let recommendationKey: String?
    let recommendationMean: Double?
    let recentRatings: [AnalystRating]
    let summary: String?
}

struct AnalystRating: Codable, Identifiable {
    let firm: String
    let toGrade: String
    let fromGrade: String?
    let action: String
    let date: String

    var id: String { "\(firm)-\(date)" }
}

// MARK: - Short Interest Data

struct ShortInterestData: Codable {
    let shortPercentOfFloat: Double?
    let sharesShort: Int?
    let shortRatio: Double?
    let sharesShortPriorMonth: JSONValue? // Can be Int or String from API
    let dateShortInterest: String?

    var sharesShortPriorMonthValue: Int? {
        sharesShortPriorMonth?.intValue
    }
}

// MARK: - News Item

struct NewsItem: Codable, Identifiable {
    let title: String
    let publisher: String
    let link: String
    let publishedAt: String

    var id: String { link }

    var url: URL? { URL(string: link) }

    var publishedDate: Date? {
        ISO8601DateFormatter().date(from: publishedAt)
    }
}
