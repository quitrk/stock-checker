// Catalyst.swift
// StockIQ

import Foundation

// MARK: - Earnings History Entry

struct EarningsHistoryEntry: Codable, Identifiable {
    let date: String
    let beat: Bool?
    let priceMove: Double?

    var id: String { date }

    var quarter: String {
        guard let eventDate = DateFormatter.apiDate.date(from: date) else { return "" }
        let month = Calendar.current.component(.month, from: eventDate)
        let q = (month - 1) / 3 + 1
        return "Q\(q)"
    }
}

// MARK: - FDA History

struct FDAHistory: Codable {
    let totalApproved: Int
    let totalRejected: Int
    let totalPriority: Int
    let recentDecisions: [FDAHistoryEntry]

    var total: Int { totalApproved + totalRejected }

    var approvalRate: Int {
        guard total > 0 else { return 0 }
        return Int(round(Double(totalApproved) / Double(total) * 100))
    }

    var priorityRate: Int {
        guard total > 0 else { return 0 }
        return Int(round(Double(totalPriority) / Double(total) * 100))
    }
}

struct FDAHistoryEntry: Codable, Identifiable {
    let date: String
    let approved: Bool
    let drugName: String
    let reviewPriority: String?
    let url: String?

    var id: String { "\(date)-\(drugName)" }

    var year: String {
        guard let eventDate = DateFormatter.apiDate.date(from: date) else { return "" }
        let year = Calendar.current.component(.year, from: eventDate)
        return "\(year)"
    }

    var isPriority: Bool {
        reviewPriority == "PRIORITY"
    }

    var fdaURL: URL? {
        guard let urlString = url else { return nil }
        return URL(string: urlString)
    }
}

// MARK: - Catalyst Event

struct CatalystEvent: Codable, Identifiable {
    let id: String
    let symbol: String
    let eventType: CatalystEventType
    let date: String
    let dateEnd: String?
    let isEstimate: Bool
    let title: String
    let description: String?
    let source: CatalystSource
    let sourceUrl: String?
    // Earnings
    let earningsHistory: [EarningsHistoryEntry]?
    let epsEstimate: Double?
    let revenueEstimate: Double?
    // Insider transactions
    let insiderName: String?
    let insiderRelation: String?
    let insiderShares: Double?
    let insiderValue: Double?
    // SEC filings
    let secForm: String?
    let secItemCode: String?
    // Clinical trials
    let trialPhases: [String]?

    var eventDate: Date? {
        DateFormatter.apiDate.date(from: date)
    }

    var eventEndDate: Date? {
        guard let dateEnd = dateEnd else { return nil }
        return DateFormatter.apiDate.date(from: dateEnd)
    }

    var isFuture: Bool {
        guard let eventDate = eventDate else { return false }
        return eventDate > Date()
    }

    var isPast: Bool { !isFuture }

    var sourceURL: URL? {
        guard let urlString = sourceUrl else { return nil }
        return URL(string: urlString)
    }
}

// MARK: - API Response

struct CatalystsResponse: Codable {
    let catalysts: [CatalystEvent]
}
