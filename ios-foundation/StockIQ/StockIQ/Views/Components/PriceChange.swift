// PriceChange.swift
// StockIQ

import SwiftUI

struct PriceChange: View {
    let change: Double
    let changePercent: Double

    private var isUp: Bool { change >= 0 }

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: isUp ? "arrow.up.right" : "arrow.down.right")
            Text(changePercent.asPercent)
        }
        .font(.subheadline)
        .foregroundStyle(Color.forPriceChange(change))
    }
}

#Preview {
    VStack(spacing: 16) {
        PriceChange(change: 2.34, changePercent: 1.33)
        PriceChange(change: -1.50, changePercent: -0.85)
        PriceChange(change: 0, changePercent: 0)
    }
    .padding()
}
