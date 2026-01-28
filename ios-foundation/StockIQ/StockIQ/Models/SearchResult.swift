// SearchResult.swift
// StockIQ

import Foundation

enum SearchResultType: String, Codable {
    case equity = "EQUITY"
    case etf = "ETF"
    case index = "INDEX"

    var displayName: String {
        switch self {
        case .equity: return "Stock"
        case .etf: return "ETF"
        case .index: return "Index"
        }
    }
}

struct SearchResult: Codable, Identifiable, Equatable {
    let symbol: String
    let name: String
    let type: SearchResultType
    let exchange: String

    var id: String { symbol }
}

struct SearchResponse: Codable {
    let results: [SearchResult]
}
