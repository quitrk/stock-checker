// AnalystSection.swift
// StockIQ

import SwiftUI

struct AnalystSection: View {
    let analystData: AnalystData
    let currentPrice: Double

    @State private var isExpanded = false

    private var upside: Double? {
        guard let target = analystData.targetPrice, currentPrice > 0 else { return nil }
        return (target - currentPrice) / currentPrice * 100
    }

    private var uniqueRatings: [AnalystRating] {
        var seen = Set<String>()
        return analystData.recentRatings.filter { rating in
            if seen.contains(rating.firm) { return false }
            seen.insert(rating.firm)
            return true
        }
    }

    var body: some View {
        if analystData.targetPrice == nil && analystData.recommendationKey == nil && analystData.recentRatings.isEmpty {
            EmptyView()
        } else {
            DisclosureGroup(isExpanded: $isExpanded) {
                VStack(alignment: .leading, spacing: 12) {
                    // Target price
                    if let target = analystData.targetPrice {
                        HStack {
                            Text("Median Target")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text(target.asCurrency)
                                .fontWeight(.semibold)
                            if let upside = upside {
                                Text("(\(upside >= 0 ? "+" : "")\(String(format: "%.1f", upside))%)")
                                    .font(.caption)
                                    .foregroundStyle(upside >= 0 ? .green : .red)
                            }
                        }
                    }

                    // Price range
                    if let low = analystData.targetPriceLow, let high = analystData.targetPriceHigh {
                        HStack {
                            Text("Range")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text("\(low.asCurrency) - \(high.asCurrency)")
                                .fontWeight(.medium)
                        }
                    }

                    // Consensus
                    if let recommendation = analystData.recommendationKey {
                        HStack {
                            Text("Consensus")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text(formatRecommendation(recommendation))
                                .fontWeight(.semibold)
                                .foregroundStyle(recommendationColor(recommendation))
                            if let count = analystData.numberOfAnalysts {
                                Text("(\(count) analysts)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }

                    // Recent ratings
                    if !uniqueRatings.isEmpty {
                        Divider()
                        Text("Recent Rating Changes")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        ForEach(uniqueRatings.prefix(5)) { rating in
                            HStack {
                                Text(rating.firm)
                                    .font(.caption)
                                    .lineLimit(1)
                                Spacer()
                                Text(rating.action)
                                    .font(.caption2)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(actionColor(rating.action).opacity(0.2))
                                    .foregroundStyle(actionColor(rating.action))
                                    .clipShape(Capsule())
                                Text(rating.toGrade)
                                    .font(.caption)
                                    .fontWeight(.medium)
                            }
                        }
                    }
                }
                .padding(.top, 8)
            } label: {
                HStack {
                    Text("Analyst Ratings")
                        .font(.headline)
                    Spacer()
                    if let recommendation = analystData.recommendationKey {
                        Text(formatRecommendation(recommendation))
                            .font(.caption)
                            .foregroundStyle(recommendationColor(recommendation))
                    }
                    if let target = analystData.targetPrice {
                        Text("\(target.asCurrency) target")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding()
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal)
        }
    }

    private func formatRecommendation(_ key: String) -> String {
        key.split(separator: "_")
            .map { $0.capitalized }
            .joined(separator: " ")
    }

    private func recommendationColor(_ key: String) -> Color {
        switch key.lowercased() {
        case "strong_buy", "strongbuy": return .green
        case "buy": return .green.opacity(0.8)
        case "hold": return .orange
        case "sell": return .red.opacity(0.8)
        case "strong_sell", "strongsell": return .red
        default: return .secondary
        }
    }

    private func actionColor(_ action: String) -> Color {
        switch action.lowercased() {
        case "upgrade", "initiated", "reiterated": return .green
        case "downgrade": return .red
        case "main", "maintains": return .orange
        default: return .secondary
        }
    }
}

#Preview {
    AnalystSection(
        analystData: AnalystData(
            targetPrice: 200,
            targetPriceLow: 150,
            targetPriceHigh: 250,
            targetPriceMean: 195,
            numberOfAnalysts: 32,
            recommendationKey: "buy",
            recommendationMean: 2.1,
            recentRatings: [
                AnalystRating(firm: "Morgan Stanley", toGrade: "Overweight", fromGrade: "Equal-Weight", action: "Upgrade", date: "2024-01-15"),
                AnalystRating(firm: "Goldman Sachs", toGrade: "Buy", fromGrade: nil, action: "Initiated", date: "2024-01-10")
            ],
            summary: nil
        ),
        currentPrice: 178.50
    )
    .padding()
    .background(Color.groupedBackground)
}
