// StockHeader.swift
// StockIQ

import SwiftUI

struct StockHeader: View {
    let result: ChecklistResult
    var baseURL: URL = APIConfig.development.baseURL

    @AppStorage("defaultStock") private var defaultStock: String = ""

    private var isDefault: Bool {
        defaultStock == result.symbol
    }

    var body: some View {
        VStack(spacing: 16) {
            companyInfo
            Divider()
            priceInfo
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.05), radius: 2, y: 1)
        .padding(.horizontal)
    }

    // MARK: - Company Info

    private var companyInfo: some View {
        HStack(alignment: .top, spacing: 12) {
            StockLogo(url: result.logoURL(relativeTo: baseURL), symbol: result.symbol)

            VStack(alignment: .leading, spacing: 4) {
                Text(result.symbol)
                    .font(.title2)
                    .fontWeight(.bold)

                Text(result.companyName)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)

                if !result.industry.isEmpty {
                    Text(result.industry)
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }

            Spacer()

            Button {
                Haptics.light()
                if isDefault {
                    defaultStock = ""
                } else {
                    defaultStock = result.symbol
                }
            } label: {
                Image(systemName: isDefault ? "pin.fill" : "pin")
                    .font(.title2)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel(isDefault ? "Remove as default" : "Set as default")

            AddToWatchlistButton(symbol: result.symbol)
        }
    }

    // MARK: - Price Info

    private var priceInfo: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Price")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Text(result.price.asCurrency)
                    .font(.title)
                    .fontWeight(.semibold)

                PriceChange(
                    change: result.priceChange,
                    changePercent: result.priceChangePercent
                )
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text("Market Cap")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Text(result.marketCap.asCompactCurrency)
                    .font(.title)
                    .fontWeight(.semibold)
            }
        }
    }
}

#Preview {
    StockHeader(result: .preview)
        .padding()
        .background(Color.groupedBackground)
}

// MARK: - Preview Helper

extension ChecklistResult {
    static var preview: ChecklistResult {
        ChecklistResult(
            symbol: "AAPL",
            companyName: "Apple Inc.",
            industry: "Consumer Electronics",
            price: 178.52,
            priceChange: 2.34,
            priceChangePercent: 1.33,
            marketCap: 2_800_000_000_000,
            logoUrl: nil,
            categories: [],
            overallStatus: .safe,
            timestamp: "",
            errors: [],
            news: [],
            newsSummary: nil,
            catalystEvents: [],
            analystData: nil,
            shortInterestData: nil,
            fdaHistory: nil
        )
    }
}
