// Color+StockIQ.swift
// StockIQ

import SwiftUI

extension Color {

    // MARK: - Price Colors

    static let priceUp = Color.green
    static let priceDown = Color.red
    static let priceNeutral = Color.secondary

    static func forPriceChange(_ change: Double) -> Color {
        if change > 0 { return .priceUp }
        if change < 0 { return .priceDown }
        return .priceNeutral
    }

    // MARK: - Status Colors

    static let statusSafe = Color.green
    static let statusWarning = Color.orange
    static let statusDanger = Color.red
    static let statusUnavailable = Color.secondary

    static func forStatus(_ status: ChecklistStatus) -> Color {
        status.color
    }

    // MARK: - App Colors

    static let appPrimary = Color.blue
    static let appSecondary = Color.indigo
    static let cardBackground = Color(.systemBackground)
    static let groupedBackground = Color(.systemGroupedBackground)
}

// MARK: - View Modifiers

extension View {

    /// Apply color based on price change
    func priceColor(_ change: Double) -> some View {
        foregroundColor(Color.forPriceChange(change))
    }

    /// Apply color based on checklist status
    func statusColor(_ status: ChecklistStatus) -> some View {
        foregroundColor(status.color)
    }
}
