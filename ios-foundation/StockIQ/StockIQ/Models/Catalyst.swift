// Catalyst.swift
// StockIQ

import Foundation

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
    let metadata: [String: JSONValue]?

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
